# PULSEIQ 3.0 — Multi-College Student Success Platform

A single deployable **React + FastAPI + Neon PostgreSQL** application with three server-authorized portals: **College Admin**, **Faculty**, and **Student**. This project is rebuilt from the supplied PULSEIQ v2 ZIP; its explainable scoring engine and demo data generator remain in `backend/scoring.py` and `backend/seed.py`.

## First deployment (Render + Neon)

1. Extract the ZIP. Push the `PULSEIQ_UPGRADED` folder to a **private** GitHub repository. Do not upload `.env` or passwords.
2. Create (or reuse) a **Neon PostgreSQL** database. Copy its *pooled* connection string, including `sslmode=require`.
3. In Render, **New → Blueprint**, connect the GitHub repo, and choose `render.yaml`. You may instead create a Docker Web Service using the included `Dockerfile`.
4. Set these Render environment variables:

   | Variable | Example or purpose |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled Postgres connection string |
   | `APP_SECRET` | Random stable secret; Blueprint generates it |
   | `BOOTSTRAP_ADMIN_PASSWORD` | Strong first college admin password (12+ characters) |
   | `BOOTSTRAP_COLLEGE_NAME` | `Example Engineering College` |
   | `BOOTSTRAP_COLLEGE_DOMAIN` | `example.edu` — verified by **you** before provisioning |
   | `BOOTSTRAP_ADMIN_EMAIL` | `admin@example.edu` |
   | `COOKIE_SECURE` | `true` for Render HTTPS |
   | `SEED_DEMO` | `false` for real setup; `true` only for fictional demo students |
   | `IMPORT_LEGACY_V2` | `false`, unless you explicitly migrate a previous v2 database snapshot |

5. Deploy. Open the Render URL and sign in with the **bootstrap college admin email** and password. First launch creates `pi3_*` tables and the first college. **Do not use `admin` as username**; v3 uses institutional email.
6. Admin portal → **Students** to add/bulk import students (JSON) or **Data connections** to connect institution databases and map columns. Admin portal → **Faculty & access** to create faculty/student accounts, assign subjects/classes. Faculty portal → **Class records** to publish attendance and marks. Students see only their own academic records.

You **do not need separate Neons for separate colleges**. Each college has a distinct `college_id` and mapping/credentials. Each institution's original database remains its own system.

## Redeploying over your original PULSEIQ v2 Neon database

- v3 **creates new `pi3_*` tables**; v2 tables are not destroyed or overwritten. Your former v2 `admin` account does not become a v3 college login.
- To import the legacy v2 student snapshot and interventions into your first v3 college, set `IMPORT_LEGACY_V2=true` **only on first launch while the new college roster is empty**. Then set it back to `false`. If you already seeded the new college or added students, this migration will not run.
- Recreate users with institutional email addresses and role assignments; v2 username accounts are intentionally **not** migrated, because role/tenant permissions changed.
- Export/backup existing Neon data first. Verify on a Neon branch before production deployment.

## Roles and permissions

| Feature | College admin | Faculty | Student |
| --- | --- | --- | --- |
| College identity shown from email domain | Yes | Yes | Yes |
| Add students and create users | Yes | No | No |
| Connect, inspect, preview, map, and sync source databases | Yes | No | No |
| Assign faculty to subject / semester / section | Yes | No | No |
| View students | Entire own college | Own assigned classes | Own student record |
| Enter draft/published attendance & marks | Yes, for college's assigned subjects | Own assigned subjects only | Read published entries only |
| Review analytics and action board | College | Assigned students | Own record/action status |
| Read another college's records | Never | Never | Never |

**The email domain only identifies the college; it never assigns faculty/admin privileges.** Only an existing authorized admin can create accounts. More colleges must be provisioned from a trusted server terminal, not via open web sign-up.

## Add a second college

In a trusted server shell with the same `DATABASE_URL` and `APP_SECRET`, run:

```bash
python -m scripts.add_college --name "Second College" --domain secondcollege.edu --admin-email admin@secondcollege.edu
```

The script prompts securely for that college's initial admin password. You must verify control of `secondcollege.edu` out of band before provisioning. The college appears automatically during login email resolution. A developer may also run the script from their local machine with Render-equivalent environment settings and database network access.

## Integrations

Admin portal → Data connections → Add integration. Store a *read-only* source account; passwords are encrypted with a Fernet key derived from `APP_SECRET` and are never sent back to the browser. **Keep `APP_SECRET` unchanged** across redeployments or existing integration credentials cannot be decrypted.

- **PostgreSQL:** `postgresql+psycopg://readonly:password@host:5432/college?sslmode=require`
- **MySQL/MariaDB:** `mysql+pymysql://readonly:password@host:3306/college`
- **SQL Server:** `mssql+pymssql://readonly:password@host/college` (optional connector driver)
- **Oracle:** `oracle+oracledb://readonly:password@host:1521/?service_name=XE` (optional connector driver)
- **MongoDB:** URI plus database name
- **HTTPS API:** Public HTTPS URL returning arrays named `students`, `academic`, `attendance`, etc.

The administrator uses **Inspect tables → Map fields → Preview mapped data → Sync**. Every college maintains separate mapping JSON, which maps canonical keys like `students.student_id` to their database columns. Example: `connectors/mapping.json` and `docs/INSTITUTION_CONNECTIONS.md`.

Connections require the college's approval, correct read-only credentials, and network access. An arbitrary database cannot be auto-connected without its permission, schema details, drivers, and mapping. API URLs must be public HTTPS; local/private API hosts are blocked. Institution database writes are **not** performed; faculty updates stay in PULSEIQ and are not overwritten by re-sync.

## Developer checks

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest -q
cd frontend
npm ci
npm run build
```

Local tests use SQLite **only** for tests; production requires Neon PostgreSQL. Docker builds React using `npm ci`, then serves it through FastAPI at the same Render URL. Old tests and documents are preserved in `tests_v2_reference/` and `docs_v2_reference/` and are **not** v3 regression tests.

## Verification and limitations

- The new v3 backend **was exercised with tests for logins, CSRF, permissions, data isolation between two colleges, faculty class boundaries, drafts/publishing, roster import, and intervention updates**.
- Frontend TSX syntax transpilation was checked; a complete `npm ci`/Vite build was **not** possible in the offline file-building environment. Render's Docker build will install dependencies and perform full TypeScript/Vite compilation; monitor its build logs.
- This is a runnable hackathon/prototype foundation, **not an audited student information system**. Before use with real student data, obtain data-sharing authorization, conduct privacy/security review, validate user provisioning and email-domain ownership, enable backups, apply proper production migrations, and consider PostgreSQL row-level security, SSO, record retention, stronger role recovery, and production observability.
- Scoring engine is `rules_v1`, **not a trained ML model** and should not autonomously make high-stakes academic decisions. The baseline React student risk dashboard is implemented anew; not every v2 staff-screen component is present.
- Real-time scheduled connector sync and institute-side write-back are not implemented; admins initiate source sync. Driver and network configuration varies by database vendor.

## Folder map

| Path | Use |
| --- | --- |
| `backend/api_v3.py` | v3 API, account/role authorizations, actions, sync |
| `backend/tenant_db.py` | Multi-college schema |
| `backend/tenant_auth.py` | Role-scoped login, sessions, CSRF |
| `backend/tenant_data.py` | Student scope, scores, faculty overrides and sync |
| `backend/tenant_connectors.py` | Encrypted college-specific database credentials/inspection |
| `backend/scoring.py`, `backend/validation.py` | Existing explainable model and canonical record validation |
| `frontend/src/main.tsx` | Three React dashboards and forms |
| `tests/` | v3 regression tests |
| `scripts/add_college.py` | Trusted multi-college provisioning |
| `Dockerfile`, `render.yaml`, `.env.example` | Cloud redeployment |
| `docs/` | Current data mapping, setup and API notes |
| `docs_v2_reference/`, `tests_v2_reference/` | Previous iteration materials |
