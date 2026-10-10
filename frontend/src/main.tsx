import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  Activity,
  LayoutDashboard,
  Users,
  Columns3,
  Database,
  FlaskConical,
  LogOut,
  RefreshCw,
  ArrowUpRight,
  Check,
  ShieldCheck,
  ChevronRight,
  Search,
  Plus,
  X,
  Clock,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { api, query, setCsrf } from "./api";
import "./styles.css";

type User = {
  id: string;
  username: string;
  role: string;
  departments: string[];
};
type Student = {
  student_id: string;
  department: string;
  semester: number;
  overall_score: number | null;
  coverage: number;
  score_status: string;
  academic_flag: string;
  placement_flag: string;
  support_request: boolean;
  segments: string[];
  [key: string]: any;
};
type Action = {
  id: string;
  student_id: string;
  owner_alias: string;
  action: string;
  rationale: string;
  due_date: string;
  status: string;
  review_note: string;
  version: number;
  department: string;
  semester: number;
};
const STATUSES = ["Planned", "In progress", "Reviewed", "Closed"];
const SEGMENTS = [
  "All",
  "Strong academics with placement gap",
  "Academic support",
  "Placement support",
  "Dual support",
  "Currently on track",
  "Insufficient evidence",
  "Support requested",
];
const fmt = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));
const short = (v: string) =>
  v === "Strong academics with placement gap"
    ? "Strong academics, placement gap"
    : v;
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  icon: any;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice">
      <ShieldCheck size={17} />
      <span>{children}</span>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setCsrf(r.csrf_token);
      onLogin(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <div className="login-story">
        <div className="wordmark">
          <Activity /> PULSE<span>IQ</span>
        </div>
        <span className="eyebrow">STUDENT SUCCESS INTELLIGENCE</span>
        <h1>
          A clearer view.
          <br />
          An earlier conversation.
          <br />
          <em>A better next step.</em>
        </h1>
        <p>
          Connect institutional records to practical support. Give faculty the
          evidence they need and a shared place to follow through.
        </p>
        <div className="login-points">
          <div>
            <Database />
            Database-connected records
          </div>
          <div>
            <BookOpen />
            Explainable support indicators
          </div>
          <div>
            <Columns3 />
            Persistent intervention workflow
          </div>
        </div>
        <small>Designed for faculty, placement teams and administrators.</small>
      </div>
      <div className="login-right">
        <form className="login-form" onSubmit={submit}>
          <div className="login-icon">
            <GraduationCap size={30} />
          </div>
          <span className="eyebrow">YOUR CAMPUS WORKSPACE</span>
          <h2>Welcome to PULSEIQ</h2>
          <p>Sign in with your institutional staff account.</p>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
          <small>
            First deployment: use admin and the bootstrap password configured in
            Render. Your administrator creates other staff accounts.
          </small>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [meta, setMeta] = useState<any>(null),
    [cohort, setCohort] = useState<any>(null),
    [actions, setActions] = useState<Action[]>([]);
  const [page, setPage] = useState("Overview"),
    [period, setPeriod] = useState(""),
    [analysis, setAnalysis] = useState(""),
    [freshDays, setFreshDays] = useState(30),
    [department, setDepartment] = useState(""),
    [semester, setSemester] = useState(""),
    [segment, setSegment] = useState("All");
  const [selected, setSelected] = useState(""),
    [profile, setProfile] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [search, setSearch] = useState(""),
    [tablePage, setTablePage] = useState(0);
  const [quality, setQuality] = useState<any>(null),
    [staff, setStaff] = useState<User[]>([]),
    [edit, setEdit] = useState<Action | null>(null),
    [events, setEvents] = useState<any[]>([]),
    [scenario, setScenario] = useState<any>(null),
    [changes, setChanges] = useState<Record<string, number>>({});
  useEffect(() => {
    api("/auth/me")
      .then((r) => {
        setCsrf(r.csrf_token);
        setUser(r.user);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    if (!user) return;
    let live = true;
    api("/meta")
      .then((r) => {
        if (!live) return;
        setMeta(r);
        setPeriod(r.periods.at(-1) || "");
        setAnalysis(r.today);
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
    };
  }, [user]);
  useEffect(() => {
    if (!user || !meta || !analysis) return;
    let live = true;
    setBusy(true);
    setError("");
    Promise.all([
      api(
        "/cohort" +
          query({
            period,
            analysis_date: analysis,
            stale_days: freshDays,
            department,
            semester,
            segment,
          }),
      ),
      api("/actions" + query({ department, semester })),
    ])
      .then(([c, a]) => {
        if (!live) return;
        setCohort(c);
        setActions(a.items);
        setSelected((prev) =>
          c.items.some((r: Student) => r.student_id === prev)
            ? prev
            : c.items[0]?.student_id || "",
        );
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [
    user,
    meta,
    period,
    analysis,
    freshDays,
    department,
    semester,
    segment,
    refresh,
  ]);
  useEffect(() => {
    if (!selected || !user) return;
    let live = true;
    setProfile(null);
    setScenario(null);
    setChanges({});
    api(
      "/students/" +
        encodeURIComponent(selected) +
        query({ period, analysis_date: analysis, stale_days: freshDays }),
    )
      .then((r) => {
        if (live) setProfile(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [selected, period, analysis, freshDays, user, refresh]);
  useEffect(() => {
    if (page !== "Connections" || user?.role !== "admin") return;
    api("/quality")
      .then(setQuality)
      .catch((e) => setError(e.message));
    api("/admin/users")
      .then((r) => setStaff(r.items))
      .catch((e) => setError(e.message));
  }, [page, user, refresh]);
  useEffect(() => {
    if (!edit) {
      setEvents([]);
      return;
    }
    api("/actions/" + edit.id + "/history")
      .then((r) => setEvents(r.items))
      .catch((e) => setError(e.message));
  }, [edit?.id]);
  useEffect(() => setTablePage(0), [search, cohort]);
  async function run(task: () => Promise<any>, reload = true) {
    setError("");
    setBusy(true);
    try {
      await task();
      if (reload) setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    await run(async () => {
      await api("/admin/sync", { method: "POST" });
      const m = await api("/meta");
      setMeta(m);
      setPeriod(m.periods.at(-1) || "");
      setDepartment("");
      setSemester("");
      setSegment("All");
    });
  }
  function choose(sid: string) {
    setSelected(sid);
    setPage("Student Profile");
  }
  if (checking)
    return (
      <div className="boot">
        <Activity />
        Opening your campus workspace…
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          setMeta(null);
          setCohort(null);
          setProfile(null);
          setActions([]);
          setQuality(null);
          setStaff([]);
          setEdit(null);
          setSelected("");
          setError("");
          setSearch("");
          setDepartment("");
          setSemester("");
          setSegment("All");
          setPage("Overview");
        }}
      />
    );
  const items: Student[] = cohort?.items || [];
  const visible = items.filter((r) =>
    r.student_id.toLowerCase().includes(search.toLowerCase()),
  );
  const scopedActions = actions.filter(
    (a) =>
      segment === "All" || items.some((s) => s.student_id === a.student_id),
  );
  const nav = [
    ["Overview", LayoutDashboard],
    ["Student Profile", Users],
    ["Action Board", Columns3],
    ["What-if Simulator", FlaskConical],
    ...(user.role === "admin" ? [["Connections", Database]] : []),
    ["Method", BookOpen],
  ] as [string, any][];
  const dateAge =
    period && analysis
      ? Math.round((Date.parse(analysis) - Date.parse(period)) / 86400000)
      : 0;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="wordmark">
          <Activity /> PULSE<span>IQ</span>
        </div>
        <p className="sidebar-sub">Student Success Intelligence</p>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => {
                setPage(name);
                setError("");
              }}
            >
              <Icon size={19} />
              {name}
              {name === "Action Board" && (
                <span className="nav-count">
                  {
                    actions.filter(
                      (a) => !["Reviewed", "Closed"].includes(a.status),
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Database size={19} />
          <strong>One shared database</strong>
          <p>
            Records and review history stay available across browser sessions.
          </p>
          {meta?.dataset.demo && (
            <Badge tone="amber">Fictional demo records</Badge>
          )}
        </div>
        <div className="user-box">
          <div className="avatar">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{user.username}</strong>
            <small>{user.role}</small>
          </div>
          <button
            aria-label="Sign out"
            onClick={() =>
              run(async () => {
                await api("/auth/logout", { method: "POST" });
                setUser(null);
                setCsrf("");
              })
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">CAMPUS WORKSPACE</span>
            <div className="breadcrumb">
              PULSEIQ
              <ChevronRight size={13} />
              {page}
            </div>
          </div>
          <div className="top-actions">
            <span className="connected">
              <i /> Database connected
            </span>
            <button
              className="icon-button"
              aria-label="Refresh dashboard"
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
            </button>
          </div>
        </header>
        <section className="content">
          <div className="page-title">
            <div>
              <h1>
                {page === "Overview" ? "Every insight, a next step." : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "Understand your cohort. Find support gaps. Help faculty act sooner."
                  : page === "Action Board"
                    ? "A shared workflow for thoughtful support and timely follow-up."
                    : page === "Student Profile"
                      ? "Follow the evidence before agreeing on a support plan."
                      : page === "Connections"
                        ? "Manage your institutional source and staff access."
                        : page === "What-if Simulator"
                          ? "Explore a scenario while preserving the original student record."
                          : "Transparent rules, visible assumptions and human review."}
              </p>
            </div>
            {page === "Action Board" && (
              <button
                className="primary"
                onClick={() => setPage("Student Profile")}
              >
                <Plus size={17} />
                New support action
              </button>
            )}
          </div>
          <div className="filters">
            <label>
              Reporting period
              <select
                aria-label="Reporting period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {(meta?.periods || []).map((v: string) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Analysis date
              <input
                type="date"
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
              />
            </label>
            <label>
              Department
              <select
                aria-label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All departments</option>
                {meta?.departments.map((v: string) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Semester
              <select
                aria-label="Semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="">All semesters</option>
                {meta?.semesters.map((v: number) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Support segment
              <select
                aria-label="Support segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
              >
                {SEGMENTS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {dateAge > freshDays && (
            <Notice>
              The selected period is stale. Evidence is visible but excluded
              from current scoring and support rules.
            </Notice>
          )}
          {dateAge < 0 && (
            <Notice>
              The selected period is after the analysis date. Future evidence is
              excluded.
            </Notice>
          )}
          {!busy && meta && !meta.dataset.students && (
            <Notice>
              No student records yet. Configure an institution connector and
              refresh from Connections, or enable the database demo seed for the
              first deployment.
            </Notice>
          )}
          {!busy && meta?.dataset.students > 0 && !meta.periods.length && (
            <Notice>
              The roster is connected. Reporting measurements are not available
              yet, so indicators remain unknown. Student profiles and support
              actions are available.
            </Notice>
          )}
          {page === "Overview" && (
            <>
              <div className="metrics">
                <Metric
                  label="Students in view"
                  value={cohort?.total ?? "—"}
                  note="Within your authorized cohort"
                  icon={Users}
                />
                <Metric
                  label="Academic support"
                  value={cohort?.academic_support ?? "—"}
                  note="Observed academic or attendance trigger"
                  icon={BookOpen}
                />
                <Metric
                  label="Placement support"
                  value={cohort?.placement_support ?? "—"}
                  note="Coding or preparation gap"
                  icon={GraduationCap}
                />
                <Metric
                  label="Support requests"
                  value={cohort?.support_requests ?? "—"}
                  note="Student-requested review"
                  icon={Activity}
                />
              </div>
              <div className="coverage-line">
                <ShieldCheck size={17} />
                <strong>Evidence coverage</strong>
                <span>{cohort?.status_counts.Complete || 0} complete</span>
                <span>
                  {cohort?.status_counts.Provisional || 0} provisional
                </span>
                <span>
                  {cohort?.status_counts["Insufficient data"] || 0} insufficient
                </span>
                <Badge>{meta?.scoring.scoring_version || "rules_v1"}</Badge>
              </div>
              <div className="chart-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Support across the cohort</h2>
                      <p>
                        Segments overlap; one student can appear more than once.
                      </p>
                    </div>
                    <Badge>Explainable rules</Badge>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={285}>
                      <BarChart
                        data={Object.entries(cohort?.segments || {}).map(
                          ([name, count]) => ({ name: short(name), count }),
                        )}
                        layout="vertical"
                        margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid horizontal={false} stroke="#edf0f3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={180}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip />
                        <Bar
                          isAnimationActive={false}
                          dataKey="count"
                          fill="#168d82"
                          radius={[0, 5, 5, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Academics & placement</h2>
                      <p>Strong marks can coexist with a preparation gap.</p>
                    </div>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={285}>
                      <ScatterChart margin={{ left: 0, right: 15, bottom: 15 }}>
                        <CartesianGrid stroke="#edf0f3" />
                        <XAxis
                          type="number"
                          dataKey="A"
                          domain={[0, 100]}
                          name="Academic"
                          label={{
                            value: "Academic score",
                            position: "insideBottom",
                            offset: -10,
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="P"
                          domain={[0, 100]}
                          name="Placement"
                          width={35}
                        />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                        <Scatter
                          isAnimationActive={false}
                          data={items.filter((r) => r.A != null && r.P != null)}
                          fill="#168d82"
                          fillOpacity={0.55}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Cohort review list</h2>
                    <p>
                      Ordered by student ID. Scores are support indicators, not
                      rankings.
                    </p>
                  </div>
                  <div className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search student ID"
                      placeholder="Search student ID"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Department</th>
                        <th>Score / coverage</th>
                        <th>Academic</th>
                        <th>Placement</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible
                        .slice(tablePage * 25, tablePage * 25 + 25)
                        .map((r) => (
                          <tr key={r.student_id}>
                            <td>
                              <button
                                className="student-link"
                                onClick={() => choose(r.student_id)}
                              >
                                {r.student_id}
                              </button>
                              <small>Semester {r.semester}</small>
                            </td>
                            <td>{r.department}</td>
                            <td>
                              <strong>{fmt(r.overall_score)}</strong>
                              <small>
                                {r.score_status} ·{" "}
                                {Math.round(r.coverage * 100)}%
                              </small>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  r.academic_flag === "Support needed"
                                    ? "amber"
                                    : ""
                                }
                              >
                                {r.academic_flag}
                              </Badge>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  r.placement_flag === "Support needed"
                                    ? "amber"
                                    : ""
                                }
                              >
                                {r.placement_flag}
                              </Badge>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={"Open " + r.student_id}
                                onClick={() => choose(r.student_id)}
                              >
                                <ArrowUpRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="empty">
                      No students match these filters.
                    </div>
                  )}
                </div>
                <div className="panel-footer">
                  <span>
                    Showing {visible.length ? tablePage * 25 + 1 : 0}–
                    {Math.min(visible.length, tablePage * 25 + 25)} of{" "}
                    {visible.length} matching students.
                  </span>
                  <div className="pagination">
                    <button
                      aria-label="Previous students"
                      disabled={tablePage === 0}
                      onClick={() => setTablePage((p) => p - 1)}
                    >
                      Previous
                    </button>
                    <button
                      aria-label="Next students"
                      disabled={(tablePage + 1) * 25 >= visible.length}
                      onClick={() => setTablePage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {page === "Student Profile" && (
            <>
              <StudentSelector
                items={items}
                selected={selected}
                setSelected={setSelected}
              />
              {profile && (
                <>
                  <div className="student-header">
                    <div className="avatar large">{selected.slice(-2)}</div>
                    <div>
                      <h2>{selected}</h2>
                      <p>
                        {profile.record.department} · Semester{" "}
                        {profile.record.semester}
                      </p>
                    </div>
                    <Badge
                      tone={
                        profile.record.score_status === "Complete"
                          ? "green"
                          : "amber"
                      }
                    >
                      {profile.record.score_status}
                    </Badge>
                  </div>
                  <div className="metrics three">
                    <Metric
                      label="Success Score"
                      value={fmt(profile.record.overall_score)}
                      note="Transparent support indicator"
                      icon={Activity}
                    />
                    <Metric
                      label="Evidence coverage"
                      value={Math.round(profile.record.coverage * 100) + "%"}
                      note="Available and fresh component weight"
                      icon={ShieldCheck}
                    />
                    <Metric
                      label="Scoring version"
                      value={profile.record.scoring_version}
                      note={"Period " + period}
                      icon={BookOpen}
                    />
                  </div>
                  {profile.record.score_status !== "Complete" && (
                    <Notice>
                      {profile.record.score_status === "Provisional"
                        ? "Provisional score: available weights are rescaled. Do not rank alongside complete scores."
                        : "Insufficient coverage: no overall score. Known support triggers remain visible."}
                    </Notice>
                  )}
                  <div className="chart-grid">
                    <SupportCard
                      title="Academic support"
                      flag={profile.record.academic_flag}
                      reasons={profile.record.academic_reasons}
                    />
                    <SupportCard
                      title="Placement support"
                      flag={profile.record.placement_flag}
                      reasons={profile.record.placement_reasons}
                    />
                  </div>
                  <div className="tags">
                    {profile.record.segments.map((s: string) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                    {profile.record.support_request && (
                      <Badge tone="amber">
                        Requested: {profile.record.support_category}
                      </Badge>
                    )}
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Evidence behind the indicator</h2>
                        <p>
                          Source dates and contributions stay visible beside
                          each component.
                        </p>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Value</th>
                            <th>Weight</th>
                            <th>Weighted points</th>
                            <th>Effective points</th>
                            <th>Source / date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.components.map((c: any) => (
                            <tr key={c.symbol}>
                              <td>{c.component}</td>
                              <td>{fmt(c.value)}</td>
                              <td>{Math.round(c.weight * 100)}%</td>
                              <td>{fmt(c.weighted_points)}</td>
                              <td>{fmt(c.effective_points)}</td>
                              <td>
                                <Badge tone={c.fresh ? "green" : ""}>
                                  {c.fresh ? "Fresh" : "Missing or stale"}
                                </Badge>
                                <small>
                                  {c.source_name || c.source} ·{" "}
                                  {c.period_end || "No record"}
                                </small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <details className="panel raw">
                    <summary>
                      Inspect raw source values and reporting provenance
                    </summary>
                    <pre>
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(profile.record).filter(
                            ([k]) =>
                              ![
                                "recommendations",
                                "segments",
                                "academic_reasons",
                                "placement_reasons",
                              ].includes(k),
                          ),
                        ),
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  <CreateAction record={profile.record} run={run} busy={busy} />
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Support actions for this student</h2>
                        <p>Saved in the shared database.</p>
                      </div>
                    </div>
                    {actions
                      .filter((a) => a.student_id === selected)
                      .map((a) => (
                        <button
                          className="student-action"
                          key={a.id}
                          onClick={() => setEdit(a)}
                        >
                          <span>
                            {a.action}
                            <small>
                              {a.owner_alias} · Due {a.due_date}
                            </small>
                          </span>
                          <Badge>{a.status}</Badge>
                        </button>
                      ))}
                    {!actions.some((a) => a.student_id === selected) && (
                      <div className="empty">No support actions yet.</div>
                    )}
                  </section>
                </>
              )}
              {!selected && (
                <div className="empty">No students match these filters.</div>
              )}
            </>
          )}
          {page === "Action Board" && (
            <>
              <Notice>
                Actions and revision history are saved in PostgreSQL. Changes
                remain available after closing the browser or restarting the
                backend.
              </Notice>
              <div className="kanban">
                {STATUSES.map((status) => (
                  <section
                    className={
                      "lane lane-" + status.replace(" ", "-").toLowerCase()
                    }
                    key={status}
                  >
                    <div className="lane-heading">
                      <span>
                        <i />
                        {status}
                      </span>
                      <Badge>
                        {
                          scopedActions.filter((a) => a.status === status)
                            .length
                        }
                      </Badge>
                    </div>
                    {scopedActions
                      .filter((a) => a.status === status)
                      .map((a) => (
                        <button
                          className="action-card"
                          key={a.id}
                          onClick={() => setEdit(a)}
                        >
                          <div>
                            <Badge>{a.student_id}</Badge>
                            <ArrowUpRight size={16} />
                          </div>
                          <h3>{a.action}</h3>
                          <p>{a.department}</p>
                          <div className="action-owner">
                            <span className="mini-avatar">
                              {a.owner_alias.slice(0, 2).toUpperCase()}
                            </span>
                            {a.owner_alias}
                          </div>
                          <div
                            className={
                              "due " +
                              (a.due_date <
                                new Date().toISOString().slice(0, 10) &&
                              ["Planned", "In progress"].includes(status)
                                ? "overdue"
                                : "")
                            }
                          >
                            <Clock size={13} />
                            Review {a.due_date}
                          </div>
                        </button>
                      ))}
                    {!scopedActions.some((a) => a.status === status) && (
                      <div className="lane-empty">
                        No actions in this stage.
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "What-if Simulator" && (
            <>
              <Notice>
                Illustrative score change, not a prediction of improvement. The
                baseline stays unchanged.
              </Notice>
              <StudentSelector
                items={items}
                selected={selected}
                setSelected={setSelected}
              />
              {profile && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Adjust observed indicators</h2>
                      <p>
                        Only fresh measurements can be changed in a scenario.
                      </p>
                    </div>
                  </div>
                  <div className="scenario-fields">
                    {Object.entries({
                      marks_pct: ["Academic marks", "academic", 100],
                      classes_attended: [
                        "Classes attended",
                        "attendance",
                        profile.record.classes_held,
                      ],
                      assignments_completed: [
                        "Assignments completed",
                        "lms",
                        profile.record.assignments_assigned,
                      ],
                      aptitude_pct: ["Aptitude", "placement", 100],
                      coding_pct: ["Coding", "placement", 100],
                      interview_pct: ["Interview", "placement", 100],
                    })
                      .filter(
                        ([f, v]) =>
                          profile.record[f] != null &&
                          profile.record[String(v[1]) + "__fresh"] &&
                          v[2] != null,
                      )
                      .map(([field, v]) => (
                        <label key={field}>
                          {String(v[0])}
                          <span>{changes[field] ?? profile.record[field]}</span>
                          <input
                            aria-label={String(v[0])}
                            type="range"
                            min="0"
                            max={Number(v[2])}
                            step="1"
                            value={changes[field] ?? profile.record[field]}
                            onChange={(e) =>
                              setChanges({
                                ...changes,
                                [field]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                  </div>
                  <div className="scenario-buttons">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          async () =>
                            setScenario(
                              await api("/students/" + selected + "/scenario", {
                                method: "POST",
                                body: JSON.stringify({
                                  period,
                                  analysis_date: analysis,
                                  stale_days: freshDays,
                                  changes,
                                }),
                              }),
                            ),
                          false,
                        )
                      }
                    >
                      Calculate scenario
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setChanges({});
                        setScenario(null);
                      }}
                    >
                      Reset scenario
                    </button>
                  </div>
                  {scenario && (
                    <div className="comparison">
                      <div>
                        <small>BASELINE</small>
                        <h2>{fmt(scenario.baseline.overall_score)}</h2>
                        <p>Placement: {scenario.baseline.placement_flag}</p>
                      </div>
                      <div>
                        <small>SCENARIO</small>
                        <h2>{fmt(scenario.scenario.overall_score)}</h2>
                        <p>Placement: {scenario.scenario.placement_flag}</p>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {page === "Connections" && user.role === "admin" && (
            <>
              <div className="chart-grid">
                <section className="panel padded">
                  <span className="eyebrow">APPLICATION STORAGE</span>
                  <h2>Hosted PostgreSQL</h2>
                  <p>
                    Student snapshots, staff sessions, actions and history share
                    your configured database.
                  </p>
                  <Badge tone="green">
                    <Check size={12} />
                    Connected
                  </Badge>
                  <dl>
                    <dt>Dataset</dt>
                    <dd>{quality?.dataset.source || meta?.dataset.source}</dd>
                    <dt>Students</dt>
                    <dd>
                      {quality?.dataset.students ?? meta?.dataset.students}
                    </dd>
                    <dt>Last snapshot</dt>
                    <dd>
                      {quality?.dataset.updated_at
                        ? new Date(quality.dataset.updated_at).toLocaleString()
                        : "Not available"}
                    </dd>
                  </dl>
                </section>
                <section className="panel padded">
                  <span className="eyebrow">INSTITUTION DATA SOURCE</span>
                  <h2>{quality?.connector.name || "Institution database"}</h2>
                  <p>
                    Configure a read-only SQL, MongoDB or canonical API
                    connector in Render. Student data is fetched without file
                    uploads.
                  </p>
                  <Badge
                    tone={quality?.connector.configured ? "green" : "amber"}
                  >
                    {quality?.connector.configured
                      ? quality.connector.kind + " connector configured"
                      : "No institution connector configured"}
                  </Badge>
                  <div className="connection-button">
                    <button
                      className="primary"
                      disabled={busy || !quality?.connector.configured}
                      onClick={sync}
                    >
                      <RefreshCw size={16} />
                      Refresh from institution
                    </button>
                  </div>
                  <small>
                    Successful validation replaces the snapshot atomically.
                    Failed refreshes preserve existing records and all actions.
                  </small>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Data quality & refresh history</h2>
                    <p>
                      Missing observations stay unknown; source duplicates block
                      refresh.
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(quality?.dataset.source_counts || {}).map(
                        ([k, v]) => (
                          <tr key={k}>
                            <td>{k}</td>
                            <td>{String(v)}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                <details className="raw">
                  <summary>
                    Validation messages (
                    {quality?.dataset.quality_report?.length || 0})
                  </summary>
                  <pre>
                    {JSON.stringify(
                      quality?.dataset.quality_report || [],
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Refresh</th>
                        <th>Actor</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quality?.sync_history.map((r: any) => (
                        <tr key={r.id}>
                          <td>{new Date(r.at).toLocaleString()}</td>
                          <td>{r.actor}</td>
                          <td>
                            <Badge
                              tone={r.status === "Success" ? "green" : "amber"}
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td>
                            <details>
                              <summary>View result</summary>
                              <pre>{JSON.stringify(r.summary, null, 2)}</pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Staff access</h2>
                    <p>
                      Backend permissions apply to every student and action
                      request.
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Departments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((u) => (
                        <tr key={u.id}>
                          <td>{u.username}</td>
                          <td>{u.role}</td>
                          <td>
                            {u.role === "admin"
                              ? "All departments"
                              : u.departments.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <CreateUser
                  departments={meta?.departments || []}
                  run={run}
                  busy={busy}
                />
              </section>
            </>
          )}
          {page === "Method" && (
            <section className="panel padded method">
              <span className="eyebrow">RULES_V1 · HUMAN REVIEW</span>
              <h2>How PULSEIQ identifies support needs</h2>
              <p>
                The engine uses transparent rules and field-based templates. It
                is not a trained dropout or placement predictor.
              </p>
              <div className="formula">
                Score = 0.30A + 0.20T + 0.15L + 0.25P + 0.05S + 0.05E
              </div>
              <p>
                A: marks. T: attendance percentage. L: assignment completion. P:
                mean of aptitude, coding and interview. S: mean of technical and
                communication assessments. E: activity completion.
              </p>
              <h3>Coverage and missing evidence</h3>
              <p>
                Placement and skills need all constituent assessments. Zero
                denominators are missing. Fresh component weights below 80%
                yield no overall score; partial coverage at or above 80%
                produces a provisional score divided by available weight.
              </p>
              <h3>Separate support flags</h3>
              <p>
                Academic support: marks below 50, attendance below 75%, or
                backlogs above zero. Placement support: placement mean below 60
                or coding below 50. Known triggers remain visible even with
                missing other fields. Without a trigger, incomplete flag
                evidence means Undetermined.
              </p>
              <p>
                Currently on track means all required flag fields are fresh and
                no rule trigger is observed. It does not guarantee academic or
                placement outcomes. Support segments overlap; support requests
                never reduce a score.
              </p>
              <h3>Freshness policy</h3>
              <label className="fresh-label">
                Freshness window (days)
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={freshDays}
                  onChange={(e) =>
                    setFreshDays(
                      Math.max(0, Math.min(365, Number(e.target.value))),
                    )
                  }
                />
              </label>
              <p>
                Stale and future-dated records stay visible but do not
                contribute to current scoring. Thresholds are prototype
                assumptions for faculty review.
              </p>
              <h3>Database connectivity</h3>
              <p>
                Institution connectors normalize approved database records into
                the eight canonical entities. Field mappings and read-only
                credentials are required. Different ERP schemas need explicit
                mapping or normalized views; this is not automatic compatibility
                with every vendor.
              </p>
              <Notice>
                Faculty confirm context before acting. Scores must not
                automatically deny exams, placements or student services.
              </Notice>
            </section>
          )}
          <footer>
            <span>PULSEIQ · Evidence guides. People decide.</span>
            <span>
              {meta?.dataset.demo
                ? "Fictional demonstration data"
                : "Institution-authorized data"}{" "}
              · {meta?.scoring.scoring_version}
            </span>
          </footer>
        </section>
      </main>
      {edit && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  SUPPORT ACTION · {edit.student_id}
                </span>
                <h2>Review & follow up</h2>
              </div>
              <button
                aria-label="Close action editor"
                className="icon-button"
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/actions/" + edit.id, {
                    method: "PATCH",
                    body: JSON.stringify({
                      owner_alias: edit.owner_alias,
                      action: edit.action,
                      due_date: edit.due_date,
                      status: edit.status,
                      review_note: edit.review_note,
                      version: edit.version,
                    }),
                  });
                  setEdit(null);
                });
              }}
            >
              <label>
                Owner alias
                <input
                  value={edit.owner_alias}
                  onChange={(e) =>
                    setEdit({ ...edit, owner_alias: e.target.value })
                  }
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Action
                <textarea
                  aria-label="Action"
                  value={edit.action}
                  onChange={(e) => setEdit({ ...edit, action: e.target.value })}
                  required
                  maxLength={2000}
                />
              </label>
              <div className="two">
                <label>
                  Due date
                  <input
                    type="date"
                    value={edit.due_date}
                    onChange={(e) =>
                      setEdit({ ...edit, due_date: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Status
                  <select
                    aria-label="Status"
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({ ...edit, status: e.target.value })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Review note
                <textarea
                  aria-label="Review note"
                  value={edit.review_note}
                  onChange={(e) =>
                    setEdit({ ...edit, review_note: e.target.value })
                  }
                  required={["Reviewed", "Closed"].includes(edit.status)}
                  maxLength={2000}
                />
              </label>
              <small>
                Reviewed and Closed need a note. Reopening preserves earlier
                revisions.
              </small>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary" disabled={busy}>
                Save revision
                <Check size={16} />
              </button>
            </form>
            <h3>Revision history</h3>
            <div className="history">
              {events.map((ev) => (
                <div key={ev.id}>
                  <span className="history-dot" />
                  <div>
                    <strong>
                      {ev.event} · {ev.actor}
                    </strong>
                    <small>
                      {new Date(ev.at).toLocaleString()} · {ev.snapshot.status}
                    </small>
                    <p>{ev.snapshot.review_note || ev.snapshot.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function StudentSelector({
  items,
  selected,
  setSelected,
}: {
  items: Student[];
  selected: string;
  setSelected: (v: string) => void;
}) {
  return (
    <div className="student-selector">
      <label>
        Student ID
        <select
          aria-label="Student ID"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {items.map((r) => (
            <option key={r.student_id} value={r.student_id}>
              {r.student_id} · {r.department}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function SupportCard({
  title,
  flag,
  reasons,
}: {
  title: string;
  flag: string;
  reasons: string[];
}) {
  return (
    <section className="panel padded support">
      <h2>{title}</h2>
      <Badge
        tone={
          flag === "Support needed"
            ? "amber"
            : flag === "Undetermined"
              ? "neutral"
              : "green"
        }
      >
        {flag}
      </Badge>
      {reasons.length ? (
        reasons.map((r) => <p key={r}>{r}</p>)
      ) : (
        <p>
          {flag === "Undetermined"
            ? "Required evidence is missing or stale."
            : "No trigger is observed in the available required fields."}
        </p>
      )}
    </section>
  );
}
function CreateAction({
  record,
  run,
  busy,
}: {
  record: Student;
  run: (t: () => Promise<any>) => Promise<void>;
  busy: boolean;
}) {
  const [playbook, setPlaybook] = useState("-1"),
    [owner, setOwner] = useState(""),
    [action, setAction] = useState(""),
    [due, setDue] = useState(
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    ),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setPlaybook("-1");
    setAction("");
    setSaved(false);
  }, [record.student_id]);
  const rec =
    playbook === "-1" ? null : record.recommendations[Number(playbook)];
  return (
    <section className="panel padded">
      <h2>Agree on a support action</h2>
      <p>Use a grounded playbook, edit the action and assign a review owner.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/actions", {
              method: "POST",
              body: JSON.stringify({
                student_id: record.student_id,
                owner_alias: owner,
                action,
                due_date: due,
                rationale:
                  rec?.trigger ||
                  "Faculty-selected action; review student evidence.",
              }),
            });
            setSaved(true);
            setAction("");
            setPlaybook("-1");
          });
        }}
      >
        <label>
          Support playbook
          <select
            aria-label="Support playbook"
            value={playbook}
            onChange={(e) => {
              setPlaybook(e.target.value);
              setAction(
                e.target.value === "-1"
                  ? ""
                  : record.recommendations[Number(e.target.value)].action,
              );
              setSaved(false);
            }}
          >
            <option value="-1">Custom support action</option>
            {record.recommendations.map((r: any, i: number) => (
              <option key={i} value={i}>
                {r.action}
              </option>
            ))}
          </select>
        </label>
        {rec && <p className="rationale">Evidence: {rec.trigger}</p>}
        <div className="two">
          <label>
            Owner alias
            <input
              placeholder="e.g. Mentor CS-1"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            Review due date
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Editable action
          <textarea
            aria-label="Editable action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            required
            maxLength={2000}
          />
        </label>
        <button className="primary" disabled={busy}>
          Create support action
          <Plus size={16} />
        </button>
        {saved && (
          <span className="save-success">
            <Check size={15} />
            Saved to the shared Action Board.
          </span>
        )}
      </form>
    </section>
  );
}
function CreateUser({
  departments,
  run,
  busy,
}: {
  departments: string[];
  run: (t: () => Promise<any>) => Promise<void>;
  busy: boolean;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("faculty"),
    [selected, setSelected] = useState<string[]>([]),
    [saved, setSaved] = useState(false);
  return (
    <form
      className="create-user"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/admin/users", {
            method: "POST",
            body: JSON.stringify({
              username,
              password,
              role,
              departments: role === "admin" ? [] : selected,
            }),
          });
          setPassword("");
          setUsername("");
          setSaved(true);
        });
      }}
    >
      <h3>Create a staff account</h3>
      <div className="two">
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            pattern="[a-zA-Z0-9_.-]{3,80}"
          />
        </label>
        <label>
          Initial password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
          />
        </label>
      </div>
      <label>
        Role
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="faculty">Faculty mentor</option>
          <option value="placement">Placement coordinator</option>
          <option value="admin">Administrator</option>
        </select>
      </label>
      {role !== "admin" && (
        <div className="department-checks">
          {departments.map((d) => (
            <label key={d}>
              <input
                type="checkbox"
                checked={selected.includes(d)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, d]
                      : selected.filter((x) => x !== d),
                  )
                }
              />
              {d}
            </label>
          ))}
        </div>
      )}
      <button className="primary" disabled={busy}>
        Create staff account
        <Plus size={16} />
      </button>
      {saved && (
        <span className="save-success">
          <Check size={15} />
          Account created.
        </span>
      )}
    </form>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
