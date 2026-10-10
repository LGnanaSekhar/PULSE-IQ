"""Multi-college API. Every protected database read/write is tenant scoped."""
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
import os, re, uuid
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, insert, update, delete, func, text
from sqlalchemy.exc import SQLAlchemyError,IntegrityError
from .settings import Settings,ROOT
from .tenant_db import (metadata,colleges,accounts,sessions,roster,subjects,entries,observations,
                        actions,connections,logs,now,engine_for)
from .tenant_auth import identity,login,passwords,public,digest,roles,COOKIE
from .tenant_data import visible_ids,authorized_student,list_roster,academic,sync_records,audit
from .tenant_connectors import validate_config,discover,fetch,encrypt,decrypt,ConnectorError
from .repository import clean
from .scoring import simulate,component_breakdown,CONFIG
from .validation import InvalidSnapshot

EMAIL_RE=re.compile(r'^[^\s@]+@([a-z0-9.-]+)$',re.I)
STATUS=('Planned','In progress','Reviewed','Closed')

def uid():return str(uuid.uuid4())
def email_domain(email):
    m=EMAIL_RE.fullmatch(email.strip().lower());return m.group(1) if m else ''
def permitted_domain(email,domain):return email_domain(email)==domain

class LoginData(BaseModel):
    email:str=Field(min_length=3,max_length=250)
    password:str=Field(min_length=1,max_length=200)
class AccountData(BaseModel):
    email:str=Field(min_length=3,max_length=250)
    full_name:str=Field(min_length=1,max_length=150)
    password:str=Field(min_length=12,max_length=200)
    role:str
    departments:list[str]=Field(default_factory=list)
    student_id:str|None=None
class StudentData(BaseModel):
    student_id:str=Field(min_length=1,max_length=100)
    full_name:str=Field(min_length=1,max_length=150)
    email:str|None=None
    department:str=Field(min_length=1,max_length=100)
    semester:int=Field(ge=1,le=12)
    section:str=Field(default='A',min_length=1,max_length=50)
class AssignmentData(BaseModel):
    faculty_id:str
    department:str=Field(min_length=1,max_length=100)
    semester:int=Field(ge=1,le=12)
    section:str=Field(min_length=1,max_length=50)
    subject:str=Field(min_length=1,max_length=150)
class EntryData(BaseModel):
    student_id:str
    assignment_id:str
    kind:str
    period_end:date
    attended:int|None=None
    held:int|None=None
    marks_pct:float|None=None
    status:str='draft'
class ActionData(BaseModel):
    student_id:str
    owner:str=Field(min_length=1,max_length=150)
    action:str=Field(min_length=1,max_length=2000)
    due_date:date
    note:str=Field(default='',max_length=2000)
class ActionUpdate(BaseModel):
    owner:str=Field(min_length=1,max_length=150)
    action:str=Field(min_length=1,max_length=2000)
    due_date:date
    status:str
    note:str=Field(default='',max_length=2000)
    version:int=Field(ge=1)
class SourceData(BaseModel):
    name:str=Field(min_length=1,max_length=150)
    kind:str
    details:dict
    mapping:dict
class MappingData(BaseModel):
    mapping:dict
class Scenario(BaseModel):
    changes:dict[str,float]

def create_app(settings=None,engine=None):
    settings=settings or Settings.from_env()
    engine=engine or engine_for(settings.database_url)

    @asynccontextmanager
    async def lifecycle(app):
        metadata.create_all(engine)
        with engine.begin() as c:
            if c.dialect.name=='postgresql':c.execute(text('SELECT pg_advisory_xact_lock(763928452)'))
            college_name=os.environ.get('BOOTSTRAP_COLLEGE_NAME','Demo College' if settings.environment=='test' else '').strip()
            admin_email=os.environ.get('BOOTSTRAP_ADMIN_EMAIL','admin@demo.edu' if settings.environment=='test' else '').strip().lower()
            domain=os.environ.get('BOOTSTRAP_COLLEGE_DOMAIN',email_domain(admin_email)).strip().lower()
            if c.execute(select(func.count()).select_from(colleges)).scalar_one()==0:
                if not college_name or not admin_email or not domain or not permitted_domain(admin_email,domain) or len(settings.admin_password)<12:
                    raise RuntimeError('Set BOOTSTRAP_COLLEGE_NAME, BOOTSTRAP_COLLEGE_DOMAIN, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (12+ characters).')
                cid=uid();c.execute(insert(colleges).values(id=cid,name=college_name,domain=domain,created_at=now()))
                c.execute(insert(accounts).values(id=uid(),college_id=cid,email=admin_email,full_name='College Administrator',password_hash=passwords.hash(settings.admin_password),role='admin',departments=[],student_id=None,active=True))
        if os.environ.get('IMPORT_LEGACY_V2','false').lower()=='true':
            from sqlalchemy import inspect
            if inspect(engine).has_table('students'):
                from .repository import records_from_database
                from .tenant_data import sync_records
                with engine.connect() as c:
                    first=c.execute(select(colleges.c.id).order_by(colleges.c.created_at).limit(1)).scalar_one()
                    total=c.execute(select(func.count()).select_from(roster).where(roster.c.college_id==first)).scalar_one()
                if total==0:
                    old_records,_=records_from_database(engine)
                    if old_records['students']:
                        sync_records(engine,{'id':None,'college_id':first},old_records,'legacy PULSEIQ v2 snapshot')
                        # Preserve v2 interventions for roster identities that were copied.
                        from .db import interventions as old_actions
                        with engine.begin() as c:
                            admin_id=c.execute(select(accounts.c.id).where(accounts.c.college_id==first,accounts.c.role=='admin').limit(1)).scalar_one()
                            ids={r['student_id']:r['id'] for r in c.execute(select(roster.c.student_id,roster.c.id).where(roster.c.college_id==first)).mappings()}
                            for a in c.execute(select(old_actions)).mappings():
                                if a['student_id'] in ids:
                                    c.execute(insert(actions).values(id=uid(),college_id=first,roster_id=ids[a['student_id']],owner=a['owner_alias'],action=a['action'],status=a['status'],due_date=a['due_date'],note=a['review_note'],version=a['version'],updated_by=admin_id,updated_at=a['updated_at']))
        if settings.seed_demo:
            from .seed import generate
            from .tenant_data import sync_records
            with engine.connect() as c:
                college=c.execute(select(colleges.c.id).order_by(colleges.c.created_at).limit(1)).scalar_one()
                total=c.execute(select(func.count()).select_from(roster).where(roster.c.college_id==college)).scalar_one()
            if total==0:
                demo=generate(settings.demo_students)
                for s in demo['students']:
                    s['full_name']='Demo Student '+s['student_id'][-4:]
                    s['section']='A' if int(s['student_id'][-4:])%2 else 'B'
                sync_records(engine,{'id':None,'college_id':college},demo,'fictional demo (not real student data)')
        yield
        engine.dispose()

    app=FastAPI(title='PULSEIQ Campus Platform',version='3.0.0',lifespan=lifecycle,
        docs_url='/api/docs' if settings.environment=='test' or os.environ.get('ENABLE_API_DOCS')=='true' else None,
        openapi_url='/api/openapi.json' if settings.environment=='test' or os.environ.get('ENABLE_API_DOCS')=='true' else None,
        redoc_url=None)
    app.state.engine=engine;app.state.settings=settings

    @app.middleware('http')
    async def security(request,call_next):
        if request.method not in ('GET','HEAD','OPTIONS') and request.headers.get('origin'):
            if urlsplit(request.headers['origin']).netloc!=request.headers.get('host'):
                return JSONResponse({'detail':'Cross-origin changes are not allowed.'},status_code=403)
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['X-Frame-Options']='DENY'
        response.headers['Referrer-Policy']='same-origin'
        if request.url.path.startswith('/api/'):response.headers['Cache-Control']='no-store'
        return response

    @app.exception_handler(SQLAlchemyError)
    async def db_fail(request,exc):
        return JSONResponse({'detail':'Database operation failed; check connection or constraints.'},status_code=503)

    @app.get('/health')
    def health():
        with engine.connect() as c:c.execute(text('SELECT 1'))
        return {'status':'ok','version':'3.0.0'}

    @app.get('/api/colleges/resolve')
    def resolve(email:str=Query(min_length=3,max_length=250)):
        domain=email_domain(email)
        with engine.connect() as c:
            name=c.execute(select(colleges.c.name).where(colleges.c.domain==domain)).scalar_one_or_none()
        return {'recognized':bool(name),'college_name':name}

    @app.post('/api/auth/login')
    def sign_in(body:LoginData,request:Request,response:Response):
        token,result=login(engine,settings,body.email,body.password,request.client.host if request.client else 'unknown')
        response.set_cookie(COOKIE,token,max_age=28800,httponly=True,secure=settings.cookie_secure,samesite='strict',path='/')
        return result

    @app.get('/api/auth/me')
    def me(user=Depends(identity)):
        return {'user':{k:v for k,v in user.items() if k!='csrf_token'},'csrf_token':user['csrf_token']}

    @app.post('/api/auth/logout')
    def sign_out(request:Request,response:Response,user=Depends(identity)):
        with engine.begin() as c:c.execute(delete(sessions).where(sessions.c.token_hash==digest(request.cookies.get(COOKIE,''),settings.app_secret)))
        response.delete_cookie(COOKIE,path='/',secure=settings.cookie_secure,samesite='strict')
        return {'ok':True}

    @app.get('/api/college')
    def college(user=Depends(identity)):
        with engine.connect() as c:
            c_row=c.execute(select(colleges).where(colleges.c.id==user['college_id'])).mappings().first()
        return {'name':c_row['name'],'domain':c_row['domain'],'user':user}

    @app.get('/api/students')
    def get_students(user=Depends(identity)):
        return {'items':list_roster(engine,user)}

    @app.get('/api/analytics')
    def analytics(period:str|None=None,department:str|None=None,semester:int|None=None,stale_days:int=Query(365,ge=0,le=3650),user=Depends(identity)):
        rows,periods,selected=academic(engine,user,period,stale_days)
        if department:rows=[r for r in rows if r['department']==department]
        if semester:rows=[r for r in rows if r['semester']==semester]
        return {'items':[{'student_id':r['student_id'],'full_name':r['full_name'],'department':r['department'],'semester':r['semester'],'section':r['section'],'overall_score':r['overall_score'],'score_status':r['score_status'],'academic_flag':r['academic_flag'],'placement_flag':r['placement_flag'],'coverage':r['coverage'],'segments':r['segments'],'attendance_pct':round(100*r['classes_attended']/r['classes_held'],1) if r.get('classes_held') else None,'marks_pct':r.get('marks_pct')} for r in rows],
                'periods':periods,'period':selected,'total':len(rows),'support_needed':sum(r['academic_flag']=='Support needed' or r['placement_flag']=='Support needed' for r in rows),'scoring':CONFIG}

    @app.get('/api/students/{student_id}')
    def student_profile(student_id:str,period:str|None=None,user=Depends(identity)):
        with engine.connect() as c:authorized_student(c,user,student_id)
        rows,periods,selected=academic(engine,user,period)
        match=next((r for r in rows if r['student_id']==student_id),None)
        if not match:raise HTTPException(404,'Student not found.')
        try:components=clean(component_breakdown(match).to_dict('records'))
        except Exception:components=[]
        with engine.connect() as c:
            item=authorized_student(c,user,student_id)
            visible_actions=c.execute(select(actions).where(actions.c.college_id==user['college_id'],actions.c.roster_id==item['id']).order_by(actions.c.due_date)).mappings().all()
            visible_entries=c.execute(select(entries,subjects.c.subject).join(subjects,entries.c.assignment_id==subjects.c.id).where(entries.c.college_id==user['college_id'],entries.c.roster_id==item['id'],entries.c.status=='published')).mappings().all()
        return {'record':match,'components':components,'periods':periods,'period':selected,'actions':clean([dict(r) for r in visible_actions]),'faculty_records':clean([dict(r) for r in visible_entries])}

    @app.post('/api/students/{student_id}/scenario')
    def scenario(student_id:str,body:Scenario,user=Depends(identity)):
        with engine.connect() as c:authorized_student(c,user,student_id)
        rows,_,_=academic(engine,user)
        record=next((r for r in rows if r['student_id']==student_id),None)
        if record is None:raise HTTPException(404,'Student not found.')
        allowed={'marks_pct':'academic','classes_attended':'attendance','assignments_completed':'lms','coding_pct':'placement','aptitude_pct':'placement','interview_pct':'placement'}
        if any(k not in allowed or record.get(k) is None or not record.get(allowed[k]+'__fresh') for k in body.changes):
            raise HTTPException(400,'Only observed, fresh fields may be simulated.')
        try:result=simulate(record,body.changes)
        except (ValueError,TypeError) as exc:raise HTTPException(400,str(exc))
        return {'scenario':clean(result),'notice':'What-if only; student records were not changed.'}

    @app.get('/api/admin/accounts')
    def list_accounts(user=Depends(identity)):
        roles(user,'admin')
        with engine.connect() as c:
            r=c.execute(select(accounts).where(accounts.c.college_id==user['college_id']).order_by(accounts.c.role,accounts.c.email)).mappings().all()
        return {'items':[{k:x[k] for k in ('id','email','full_name','role','departments','student_id','active')} for x in r]}

    @app.post('/api/admin/accounts',status_code=201)
    def add_account(body:AccountData,user=Depends(identity)):
        roles(user,'admin')
        if body.role not in ('admin','faculty','student'):raise HTTPException(400,'Role must be admin, faculty or student.')
        email=body.email.strip().lower()
        with engine.begin() as c:
            domain=c.execute(select(colleges.c.domain).where(colleges.c.id==user['college_id'])).scalar_one()
            if not permitted_domain(email,domain):raise HTTPException(400,f'Account email must use @{domain}.')
            if body.role=='student':
                if not body.student_id:raise HTTPException(400,'Student account requires a student ID.')
                match=c.execute(select(roster).where(roster.c.college_id==user['college_id'],roster.c.student_id==body.student_id,roster.c.active==True)).mappings().first()
                if not match:raise HTTPException(400,'Add this student to the college roster first.')
                if c.execute(select(accounts.c.id).where(accounts.c.college_id==user['college_id'],accounts.c.student_id==body.student_id,accounts.c.role=='student')).first():raise HTTPException(409,'Student already has an account.')
            elif body.student_id:raise HTTPException(400,'Only students may have a linked student ID.')
            if c.execute(select(accounts.c.id).where(accounts.c.email==email)).first():raise HTTPException(409,'Email already registered.')
            record=dict(id=uid(),college_id=user['college_id'],email=email,full_name=body.full_name.strip(),password_hash=passwords.hash(body.password),role=body.role,departments=body.departments if body.role=='faculty' else [],student_id=body.student_id if body.role=='student' else None,active=True)
            c.execute(insert(accounts).values(**record));audit(c,user,'account.created',{'role':body.role,'email':email})
        return {k:record[k] for k in ('id','email','full_name','role','student_id')}

    @app.patch('/api/admin/accounts/{account_id}/toggle')
    def toggle_account(account_id:str,user=Depends(identity)):
        roles(user,'admin')
        with engine.begin() as c:
            target=c.execute(select(accounts).where(accounts.c.id==account_id,accounts.c.college_id==user['college_id'])).mappings().first()
            if not target:raise HTTPException(404,'User not found.')
            if target['id']==user['id']:raise HTTPException(400,'Cannot disable your own account.')
            c.execute(update(accounts).where(accounts.c.id==account_id,accounts.c.college_id==user['college_id']).values(active=not target['active']))
            if target['active']:c.execute(delete(sessions).where(sessions.c.user_id==account_id))
            audit(c,user,'account.toggled',{'account_id':account_id,'active':not target['active']})
        return {'active':not target['active']}

    @app.post('/api/admin/students')
    def upsert_student(body:StudentData,user=Depends(identity)):
        roles(user,'admin')
        if body.email and not EMAIL_RE.fullmatch(body.email):raise HTTPException(400,'Provide a valid email.')
        with engine.begin() as c:
            old=c.execute(select(roster.c.id).where(roster.c.college_id==user['college_id'],roster.c.student_id==body.student_id)).scalar_one_or_none()
            data=body.model_dump();data.update(email=body.email.strip().lower() if body.email else None,active=True)
            if old:c.execute(update(roster).where(roster.c.id==old).values(**data))
            else:c.execute(insert(roster).values(id=uid(),college_id=user['college_id'],**data))
            audit(c,user,'roster.saved',{'student_id':body.student_id})
        return {'ok':True,'student_id':body.student_id}

    @app.post('/api/admin/students/bulk')
    def bulk_students(items:list[StudentData],user=Depends(identity)):
        """Bulk add/upsert JSON roster. Entire batch is atomic and tenant scoped."""
        roles(user,'admin')
        if not items or len(items)>5000:raise HTTPException(400,'Provide between 1 and 5,000 student records.')
        identifiers=[x.student_id for x in items]
        if len(set(identifiers))!=len(identifiers):raise HTTPException(400,'Duplicate student IDs in the import.')
        if any(x.email and not EMAIL_RE.fullmatch(x.email) for x in items):raise HTTPException(400,'Invalid email in imported roster.')
        with engine.begin() as c:
            existing={r['student_id']:r['id'] for r in c.execute(select(roster.c.id,roster.c.student_id).where(roster.c.college_id==user['college_id'])).mappings()}
            for student in items:
                data=student.model_dump();data.update(email=student.email.strip().lower() if student.email else None,active=True)
                if student.student_id in existing:
                    c.execute(update(roster).where(roster.c.id==existing[student.student_id],roster.c.college_id==user['college_id']).values(**data))
                else:c.execute(insert(roster).values(id=uid(),college_id=user['college_id'],**data))
            audit(c,user,'roster.bulk',{'count':len(items)})
        return {'ok':True,'count':len(items)}

    @app.get('/api/assignments')
    def list_assignments(user=Depends(identity)):
        roles(user,'admin','faculty')
        with engine.connect() as c:
            q=select(subjects,accounts.c.full_name.label('faculty_name'),accounts.c.email.label('faculty_email')).join(accounts,accounts.c.id==subjects.c.faculty_id).where(subjects.c.college_id==user['college_id'])
            if user['role']=='faculty':q=q.where(subjects.c.faculty_id==user['id'])
            result=[dict(r) for r in c.execute(q.order_by(subjects.c.department,subjects.c.subject)).mappings()]
        return {'items':clean(result)}

    @app.post('/api/admin/assignments',status_code=201)
    def add_assignment(body:AssignmentData,user=Depends(identity)):
        roles(user,'admin')
        with engine.begin() as c:
            target=c.execute(select(accounts).where(accounts.c.id==body.faculty_id,accounts.c.college_id==user['college_id'],accounts.c.role=='faculty',accounts.c.active==True)).mappings().first()
            if not target:raise HTTPException(400,'Choose a faculty member from your own college.')
            row=dict(id=uid(),college_id=user['college_id'],**body.model_dump())
            if c.execute(select(subjects.c.id).where(subjects.c.college_id==user['college_id'],subjects.c.faculty_id==body.faculty_id,subjects.c.department==body.department,subjects.c.semester==body.semester,subjects.c.section==body.section,subjects.c.subject==body.subject)).first():raise HTTPException(409,'That assignment already exists.')
            c.execute(insert(subjects).values(**row));audit(c,user,'faculty.assigned',{'faculty_id':body.faculty_id,'subject':body.subject})
        return row

    @app.get('/api/entries')
    def list_entries(user=Depends(identity)):
        roles(user,'admin','faculty')
        with engine.connect() as c:
            q=select(entries,roster.c.student_id,roster.c.full_name,subjects.c.subject).join(roster,entries.c.roster_id==roster.c.id).join(subjects,entries.c.assignment_id==subjects.c.id).where(entries.c.college_id==user['college_id'])
            if user['role']=='faculty':q=q.where(subjects.c.faculty_id==user['id'])
            result=[dict(r) for r in c.execute(q.order_by(entries.c.updated_at.desc()).limit(250)).mappings()]
        return {'items':clean(result)}

    @app.post('/api/entries')
    def save_entry(body:EntryData,user=Depends(identity)):
        roles(user,'admin','faculty')
        if body.kind not in ('marks','attendance') or body.status not in ('draft','published'):
            raise HTTPException(400,'Invalid entry kind or status.')
        if body.period_end>date.today():raise HTTPException(400,'Reporting date cannot be in the future.')
        if body.kind=='attendance' and (body.attended is None or body.held is None or not 0<=body.attended<=body.held):raise HTTPException(400,'Attendance must satisfy 0 <= attended <= held.')
        if body.kind=='marks' and (body.marks_pct is None or not 0<=body.marks_pct<=100):raise HTTPException(400,'Marks percentage must be 0 to 100.')
        with engine.begin() as c:
            r=authorized_student(c,user,body.student_id)
            assignment=c.execute(select(subjects).where(subjects.c.id==body.assignment_id,subjects.c.college_id==user['college_id'])).mappings().first()
            if not assignment or (user['role']=='faculty' and assignment['faculty_id']!=user['id']):raise HTTPException(403,'Not assigned to this subject.')
            if (r['department'],r['semester'],r['section'])!=(assignment['department'],assignment['semester'],assignment['section']):raise HTTPException(400,'Student is not enrolled in this assigned class.')
            old=c.execute(select(entries.c.id).where(entries.c.roster_id==r['id'],entries.c.assignment_id==body.assignment_id,entries.c.kind==body.kind,entries.c.period_end==body.period_end)).scalar_one_or_none()
            values=dict(attended=body.attended if body.kind=='attendance' else None,held=body.held if body.kind=='attendance' else None,marks_pct=body.marks_pct if body.kind=='marks' else None,status=body.status,updated_by=user['id'],updated_at=now())
            if old:c.execute(update(entries).where(entries.c.id==old,entries.c.college_id==user['college_id']).values(**values))
            else:c.execute(insert(entries).values(id=uid(),college_id=user['college_id'],roster_id=r['id'],assignment_id=body.assignment_id,kind=body.kind,period_end=body.period_end,**values))
            audit(c,user,'academic.entry.saved',{'student_id':body.student_id,'kind':body.kind,'status':body.status,'subject':assignment['subject']})
        return {'ok':True,'status':body.status}

    @app.get('/api/actions')
    def list_actions(user=Depends(identity)):
        with engine.connect() as c:
            ids=visible_ids(c,user)
            if not ids:return {'items':[]}
            records=c.execute(select(actions,roster.c.student_id,roster.c.full_name).join(roster,actions.c.roster_id==roster.c.id).where(actions.c.college_id==user['college_id'],actions.c.roster_id.in_(ids)).order_by(actions.c.due_date)).mappings().all()
        return {'items':clean([dict(x) for x in records])}

    @app.post('/api/actions')
    def make_action(body:ActionData,user=Depends(identity)):
        roles(user,'admin','faculty')
        with engine.begin() as c:
            r=authorized_student(c,user,body.student_id)
            item=dict(id=uid(),college_id=user['college_id'],roster_id=r['id'],owner=body.owner,action=body.action,status='Planned',due_date=body.due_date,note=body.note,version=1,updated_by=user['id'],updated_at=now())
            c.execute(insert(actions).values(**item));audit(c,user,'action.created',{'student_id':body.student_id})
        return clean(item)

    @app.patch('/api/actions/{action_id}')
    def edit_action(action_id:str,body:ActionUpdate,user=Depends(identity)):
        roles(user,'admin','faculty')
        if body.status not in STATUS:raise HTTPException(400,'Unknown action status.')
        if body.status in ('Reviewed','Closed') and not body.note.strip():raise HTTPException(400,'Review note required to close or review.')
        with engine.begin() as c:
            old=c.execute(select(actions).where(actions.c.id==action_id,actions.c.college_id==user['college_id'])).mappings().first()
            if not old or old['roster_id'] not in visible_ids(c,user):raise HTTPException(404,'Action not found in your classes.')
            if old['version']!=body.version:raise HTTPException(409,'Action changed. Refresh before editing.')
            result=c.execute(update(actions).where(actions.c.id==action_id,actions.c.college_id==user['college_id'],actions.c.version==body.version).values(**body.model_dump(exclude={'version'}),version=body.version+1,updated_by=user['id'],updated_at=now()))
            if result.rowcount!=1:raise HTTPException(409,'Action changed. Refresh before editing.')
            audit(c,user,'action.updated',{'action_id':action_id,'status':body.status})
        return {'ok':True,'version':body.version+1}

    @app.get('/api/admin/connections')
    def get_connections(user=Depends(identity)):
        roles(user,'admin')
        with engine.connect() as c:rows=c.execute(select(connections).where(connections.c.college_id==user['college_id']).order_by(connections.c.created_at.desc())).mappings().all()
        return {'items':[{'id':x['id'],'name':x['name'],'kind':x['kind'],'mapping':x['mapping'],'created_at':clean(x['created_at']),'configured':True} for x in rows]}

    @app.post('/api/admin/connections')
    def create_connection(body:SourceData,user=Depends(identity)):
        roles(user,'admin')
        try:validate_config(body.kind,body.details,body.mapping)
        except ConnectorError as e:raise HTTPException(400,str(e))
        with engine.begin() as c:
            pk=uid()
            c.execute(insert(connections).values(id=pk,college_id=user['college_id'],name=body.name,kind=body.kind,encrypted_dsn=encrypt(settings.app_secret,body.details),mapping=body.mapping,created_at=now()))
            audit(c,user,'connection.created',{'connection_id':pk,'kind':body.kind})
        return {'id':pk,'name':body.name,'kind':body.kind}

    def get_connection(user,source_id):
        with engine.connect() as c:
            row=c.execute(select(connections).where(connections.c.id==source_id,connections.c.college_id==user['college_id'])).mappings().first()
        if not row:raise HTTPException(404,'Connection not found.')
        return row,decrypt(settings.app_secret,row['encrypted_dsn'])

    @app.get('/api/admin/connections/{source_id}/discover')
    def inspect_connection(source_id:str,user=Depends(identity)):
        roles(user,'admin');source,details=get_connection(user,source_id)
        try:return {'tables':discover(source['kind'],details)}
        except Exception:raise HTTPException(502,'Could not inspect this source. Check credentials, driver, network access and read permissions.')

    @app.put('/api/admin/connections/{source_id}/mapping')
    def update_mapping(source_id:str,body:MappingData,user=Depends(identity)):
        roles(user,'admin');source,details=get_connection(user,source_id)
        try:validate_config(source['kind'],details,body.mapping)
        except ConnectorError as e:raise HTTPException(400,str(e))
        with engine.begin() as c:
            c.execute(update(connections).where(connections.c.id==source_id,connections.c.college_id==user['college_id']).values(mapping=body.mapping))
            audit(c,user,'connection.mapping.saved',{'connection_id':source_id})
        return {'ok':True}

    @app.delete('/api/admin/connections/{source_id}')
    def delete_connection(source_id:str,user=Depends(identity)):
        roles(user,'admin')
        with engine.begin() as c:
            outcome=c.execute(delete(connections).where(connections.c.id==source_id,connections.c.college_id==user['college_id']))
            if outcome.rowcount==0:raise HTTPException(404,'Connection not found.')
            audit(c,user,'connection.deleted',{'connection_id':source_id})
        return {'ok':True}

    @app.get('/api/admin/connections/{source_id}/preview')
    def preview_connection(source_id:str,user=Depends(identity)):
        roles(user,'admin');source,details=get_connection(user,source_id)
        try:
            from .validation import validate_records
            raw=fetch(source['kind'],details,source['mapping'],settings.database_url)
            normalized,warnings=validate_records(raw)
            return {'counts':{k:len(rows) for k,rows in normalized.items()},'sample':{k:clean(rows[:2]) for k,rows in normalized.items()},'warnings':warnings[:20]}
        except InvalidSnapshot as exc:raise HTTPException(400,{'message':'Mapped source validation failed','report':exc.report[:30]})
        except ConnectorError as exc:raise HTTPException(400,str(exc))
        except Exception:raise HTTPException(502,'Could not preview mapped data. Verify mapping and network access.')

    @app.post('/api/admin/connections/{source_id}/sync')
    def sync_connection(source_id:str,user=Depends(identity)):
        roles(user,'admin')
        source,details=get_connection(user,source_id)
        try:
            raw=fetch(source['kind'],details,source['mapping'],settings.database_url)
            return sync_records(engine,user,raw,source['name'])
        except InvalidSnapshot as e:raise HTTPException(400,{'message':'Source validation failed; existing data preserved.','report':e.report[:30]})
        except ConnectorError as e:raise HTTPException(400,str(e))
        except Exception:raise HTTPException(502,'Connection or sync failed. Verify connection, field mapping and institutional network access.')

    @app.get('/api/admin/audit')
    def audit_history(user=Depends(identity)):
        roles(user,'admin')
        with engine.connect() as c:records=c.execute(select(logs).where(logs.c.college_id==user['college_id']).order_by(logs.c.at.desc()).limit(100)).mappings().all()
        return {'items':clean([dict(r) for r in records])}

    dist=ROOT/'frontend'/'dist'
    if (dist/'assets').exists():app.mount('/assets',StaticFiles(directory=dist/'assets'),name='assets')
    @app.get('/{path:path}',include_in_schema=False)
    def web(path:str):
        if path.startswith(('api/','assets/')):raise HTTPException(404,'Not found.')
        if not (dist/'index.html').exists():return JSONResponse({'detail':'Frontend build not found. Build using Dockerfile.'},status_code=503)
        return FileResponse(dist/'index.html')
    return app
