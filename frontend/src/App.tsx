import { FormEvent, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { api } from './api'

type User = { id: number; full_name: string; email: string; role: string; title: string; avatar: string; is_active: boolean }
type Project = { id: number; name: string; key: string; description: string; status: string; priority: string; color: string; start_date?: string; target_date?: string; budget: number; owner: User; members: User[]; task_count: number; completed_count: number; progress: number }
type Comment = { id: number; body: string; author: User; created_at: string }
type TimeEntry = { id: number; minutes: number; note: string; user: User; work_date: string }
type Task = {
  id: number; task_number: string; project_id: number; project_name: string; project_key: string; sprint_id?: number; sprint_name?: string;
  title: string; description: string; status: string; priority: string; task_type: string; labels: string[]; story_points: number;
  progress: number; due_date?: string; estimate_minutes: number; logged_minutes: number; assignees: User[]; reporter: User;
  comments_count: number; comments?: Comment[]; time_entries?: TimeEntry[]; created_at: string; updated_at: string
}
type Sprint = { id: number; project_id: number; project_name: string; name: string; goal: string; status: string; start_date?: string; end_date?: string; capacity_points: number; committed_points: number; completed_points: number }
type Activity = { id: number; actor?: User; action: string; entity_type: string; entity_id: string; details: string; created_at: string }
type Dashboard = {
  metrics: { total_tasks: number; completed_tasks: number; overdue_tasks: number; active_projects: number; completion_rate: number; velocity: number; total_points: number; sprint_health: string }
  status_counts: Record<string, number>; priority_counts: Record<string, number>; workload: { user: User; tasks: number; points: number }[];
  due_soon: Task[]; velocity_trend: { label: string; points: number }[]; projects: Project[]; activities: Activity[]
}
type Analytics = { delivery: { project: string; total: number; completed: number; points: number; logged_hours: number; completion_rate: number }[]; average_cycle_days: number; total_logged_hours: number; blocked_count: number; high_priority_open: number }
type Notice = { id: number; title: string; message: string; kind: string; is_read: boolean; created_at: string }

type View = 'dashboard' | 'board' | 'list' | 'calendar' | 'projects' | 'team' | 'analytics' | 'audit'

const statusConfig: Record<string, { label: string; icon: string }> = {
  backlog: { label: 'Backlog', icon: '◈' }, in_progress: { label: 'In Progress', icon: '◉' }, review: { label: 'Review', icon: '◆' }, completed: { label: 'Completed', icon: '✓' }, blocked: { label: 'Blocked', icon: '!' }
}
const roleNames: Record<string, string> = {
  super_admin: 'Super Admin', org_admin: 'Org Admin', project_manager: 'Project Manager', team_lead: 'Team Lead', developer: 'Developer', designer: 'Designer', qa_engineer: 'QA Engineer', client: 'Client', auditor: 'Auditor'
}
const DEMO_EMAIL = 'ajxdevx@taskly.io'
const DEMO_PASSWORD = 'demo'
const DEMO_NAME = 'Ajxdevx'

function fmtDate(value?: string, compact = false) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-IN', compact ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}
function relative(value: string) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3600000))
  return hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}
function initials(name: string) { return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() }

const AVATAR_PALETTES = [
  ['#15803d', '#4ade80'],
  ['#166534', '#22c55e'],
  ['#14532d', '#86efac'],
  ['#3f6212', '#a3e635'],
  ['#065f46', '#34d399'],
  ['#1a2e05', '#65a30d'],
  ['#047857', '#6ee7b7'],
  ['#4d7c0f', '#bef264'],
]

function Avatar({ user, small = false, large = false }: { user: User; small?: boolean; large?: boolean }) {
  const palette = AVATAR_PALETTES[user.id % AVATAR_PALETTES.length]
  const label = user.avatar?.trim() ? user.avatar : initials(user.full_name)
  const sizeClass = large ? 'avatar-lg' : small ? 'avatar-sm' : 'avatar-md'
  return (
    <span
      className={`avatar ${sizeClass}`}
      style={{ background: `linear-gradient(145deg, ${palette[0]}, ${palette[1]})`, color: '#fff' }}
      title={`${user.full_name} · ${roleNames[user.role] || user.role}`}
    >
      {label}
    </span>
  )
}

type SelectOption<T extends string | number> = { value: T; label: string }

function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select…',
  compact = false,
  onMouseDown,
}: {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  disabled?: boolean
  placeholder?: string
  compact?: boolean
  onMouseDown?: (event: ReactMouseEvent) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className={`custom-select ${open ? 'is-open' : ''} ${compact ? 'custom-select-compact' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="custom-select-trigger"
        disabled={disabled}
        onMouseDown={onMouseDown}
        onClick={() => !disabled && setOpen(current => !current)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <i aria-hidden>▾</i>
      </button>
      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map(option => (
            <button
              type="button"
              key={String(option.value)}
              className={option.value === value ? 'active' : ''}
              onClick={() => { onChange(option.value); setOpen(false) }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
function Priority({ value }: { value: string }) { return <span className={`priority priority-${value}`}>{value}</span> }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><div className="empty-icon">◇</div><b>{title}</b><span>{text}</span></div> }

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const result = await api<{ access_token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      localStorage.setItem('taskly_token', result.access_token); localStorage.setItem('taskly_user', JSON.stringify(result.user)); onLogin(result.user)
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed') } finally { setLoading(false) }
  }
  return <div className="login-page">
    <div className="login-orb orb-one"/><div className="login-orb orb-two"/>
    <section className="login-story">
      <div className="brand brand-large"><span className="brand-mark">T</span><span>Taskly<span className="brand-dot">.</span></span></div>
      <div className="story-copy"><span className="eyebrow">WORK MANAGEMENT</span><h1>Plan, ship, and track work in one green workspace.</h1><p>Taskly brings boards, sprints, teams, and analytics together with a calm, readable interface.</p></div>
      <div className="login-stats"><div><strong>42%</strong><span>faster delivery</span></div><div><strong>99.9%</strong><span>workflow visibility</span></div><div><strong>1</strong><span>workspace</span></div></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div><span className="eyebrow">WELCOME TO TASKLY</span><h2>Sign in</h2><p>Use the demo account below to explore the full app.</p></div>
        <label>Name<input value={DEMO_NAME} readOnly /></label>
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" required /></label>
        {error && <div className="error-banner">{error}</div>}
        <button className="primary full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in →'}</button>
        <div className="demo-callout"><b>Your account</b><span>{DEMO_NAME}</span><span>{DEMO_EMAIL}</span><span>Password: <b>{DEMO_PASSWORD}</b></span></div>
      </form>
    </section>
  </div>
}

function App() {
  const [user, setUser] = useState<User | null>(() => { try { return JSON.parse(localStorage.getItem('taskly_user') || 'null') } catch { return null } })
  const [view, setView] = useState<View>('dashboard')
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [audit, setAudit] = useState<Activity[]>([])
  const [selectedProject, setSelectedProject] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [taskModal, setTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const canManage = !!user && ['super_admin', 'org_admin', 'project_manager', 'team_lead'].includes(user.role)
  const canCreate = !!user && !['client', 'auditor'].includes(user.role)
  const canAudit = !!user && ['super_admin', 'org_admin', 'auditor'].includes(user.role)

  async function loadAll(silent = false) {
    if (!user) return
    if (!silent) setLoading(true)
    try {
      const [taskData, projectData, userData, sprintData, dashData, noticeData] = await Promise.all([
        api<Task[]>('/api/tasks'), api<Project[]>('/api/projects'), api<User[]>('/api/users'), api<Sprint[]>('/api/sprints'), api<Dashboard>('/api/dashboard/summary'), api<Notice[]>('/api/notifications')
      ])
      setTasks(taskData); setProjects(projectData); setUsers(userData); setSprints(sprintData); setDashboard(dashData); setNotices(noticeData)
      if (view === 'analytics') setAnalytics(await api<Analytics>('/api/analytics'))
      if (view === 'audit' && canAudit) setAudit(await api<Activity[]>('/api/audit-logs'))
    } catch (err) { showToast(err instanceof Error ? err.message : 'Could not load workspace') } finally { setLoading(false) }
  }
  useEffect(() => { void loadAll() }, [user])
  useEffect(() => {
    if (!user) return
    if (view === 'analytics' && !analytics) api<Analytics>('/api/analytics').then(setAnalytics).catch(() => undefined)
    if (view === 'audit' && canAudit) api<Activity[]>('/api/audit-logs').then(setAudit).catch(() => undefined)
  }, [view])
  function showToast(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  function logout() { localStorage.removeItem('taskly_token'); localStorage.removeItem('taskly_user'); setUser(null) }

  const filteredTasks = useMemo(() => tasks.filter(task =>
    (selectedProject === 'all' || task.project_id === selectedProject) &&
    (filterPriority === 'all' || task.priority === filterPriority) &&
    (!search || `${task.task_number} ${task.title} ${task.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  ), [tasks, selectedProject, filterPriority, search])

  async function openTask(task: Task) {
    try { setSelectedTask(await api<Task>(`/api/tasks/${task.id}`)) } catch (err) { showToast(err instanceof Error ? err.message : 'Unable to open task') }
  }
  async function changeStatus(task: Task, status: string) {
    try {
      const updated = await api<Task>(`/api/tasks/${task.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setTasks(items => items.map(item => item.id === task.id ? updated : item)); if (selectedTask?.id === task.id) setSelectedTask({ ...selectedTask, ...updated }); showToast(`${task.task_number} moved to ${statusConfig[status]?.label || status}`); void loadAll(true)
    } catch (err) { showToast(err instanceof Error ? err.message : 'Transition failed') }
  }

  if (!user) return <Login onLogin={setUser} />

  const nav: { id: View; label: string; icon: string; count?: number; hidden?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' }, { id: 'board', label: 'Board', icon: '▤', count: tasks.filter(t => t.status !== 'completed').length },
    { id: 'list', label: 'All Tasks', icon: '☷', count: tasks.length }, { id: 'calendar', label: 'Calendar', icon: '□' },
    { id: 'projects', label: 'Projects', icon: '◇' }, { id: 'team', label: 'Team', icon: '♙' }, { id: 'analytics', label: 'Analytics', icon: '⌁' },
    { id: 'audit', label: 'Audit & Security', icon: '⊙', hidden: !canAudit }
  ]
  const currentProject = projects.find(project => project.id === selectedProject)

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">T</span><span>Taskly<span className="brand-dot">.</span></span></div>
      <div className="workspace-switch"><span className="workspace-icon">TL</span><div><b>Taskly Workspace</b><small>Delivery hub</small></div><span>⌄</span></div>
      <nav>{nav.filter(item => !item.hidden).map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.count !== undefined && <em>{item.count}</em>}</button>)}</nav>
      <div className="sidebar-section"><div className="section-label">STARRED PROJECTS <button>＋</button></div>{projects.slice(0, 4).map(project => <button className="project-shortcut" key={project.id} onClick={() => { setSelectedProject(project.id); setView('board') }}><i className={`dot dot-${project.color}`}/>{project.name}</button>)}</div>
      <div className="upgrade-card"><span>✦</span><b>Enterprise workspace</b><p>Advanced governance, automation and delivery intelligence enabled.</p><div><span>Storage</span><b>42%</b></div><progress value="42" max="100"/></div>
      <div className="profile-card"><Avatar user={user} large/><div><b>{user.full_name}</b><span>{roleNames[user.role]}</span></div><button onClick={logout} title="Sign out">↗</button></div>
      <p className="sidebar-credit"><strong>Ajxdevx</strong> · Taskly</p>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="global-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks, projects, people…"/><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="icon-button" onClick={() => setNoticeOpen(value => !value)}>♧{notices.filter(n => !n.is_read).length > 0 && <i>{notices.filter(n => !n.is_read).length}</i>}</button>{canCreate && <button className="primary" onClick={() => setTaskModal(true)}>＋ New task</button>}<Avatar user={user} small/></div>
        {noticeOpen && <Notifications notices={notices} onClose={() => setNoticeOpen(false)} onRead={async id => { await api(`/api/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) }); setNotices(items => items.map(n => n.id === id ? { ...n, is_read: true } : n)) }}/>} 
      </header>

      <section className="page-head">
        <div><span className="eyebrow">{currentProject ? currentProject.key : 'ENTERPRISE WORKSPACE'}</span><h1>{view === 'dashboard' ? `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user.full_name.split(' ')[0]}!` : nav.find(item => item.id === view)?.label}</h1><p>{view === 'dashboard' ? 'Here is what is happening across your delivery portfolio today.' : currentProject ? currentProject.description : 'Manage work with clarity, accountability and measurable outcomes.'}</p></div>
        <div className="page-controls">
          <CustomSelect
            value={selectedProject}
            onChange={value => setSelectedProject(value)}
            options={[{ value: 'all', label: 'All projects' }, ...projects.map(project => ({ value: project.id, label: `${project.key} · ${project.name}` }))]}
          />
          <CustomSelect
            value={filterPriority}
            onChange={setFilterPriority}
            options={[
              { value: 'all', label: 'All priorities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
          <button className="ghost" onClick={() => void loadAll()}>↻ Refresh</button>
        </div>
      </section>

      <section className={`content ${loading ? 'is-loading' : ''}`}>
        {view === 'dashboard' && <DashboardView dashboard={dashboard} tasks={filteredTasks} projects={projects} onTask={openTask} onView={setView}/>} 
        {view === 'board' && <BoardView tasks={filteredTasks} onTask={openTask} onStatus={changeStatus} canEdit={!['client', 'auditor'].includes(user.role)}/>} 
        {view === 'list' && <ListView tasks={filteredTasks} onTask={openTask}/>} 
        {view === 'calendar' && <CalendarView tasks={filteredTasks} onTask={openTask}/>} 
        {view === 'projects' && <ProjectsView projects={projects} tasks={tasks} onProject={id => { setSelectedProject(id); setView('board') }}/>} 
        {view === 'team' && <TeamView users={users} tasks={tasks}/>} 
        {view === 'analytics' && <AnalyticsView analytics={analytics}/>} 
        {view === 'audit' && canAudit && <AuditView logs={audit}/>} 
      </section>
    </main>
    {taskModal && <CreateTask projects={projects} users={users} sprints={sprints} defaultProject={selectedProject} onClose={() => setTaskModal(false)} onCreated={task => { setTaskModal(false); setTasks(items => [task, ...items]); showToast(`${task.task_number} created`); void loadAll(true) }}/>} 
    {selectedTask && <TaskDrawer task={selectedTask} currentUser={user} onClose={() => setSelectedTask(null)} onComment={async body => { const comment = await api<Comment>(`/api/tasks/${selectedTask.id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }); setSelectedTask({ ...selectedTask, comments: [...(selectedTask.comments || []), comment], comments_count: selectedTask.comments_count + 1 }); showToast('Comment added') }} onTime={async (minutes, note) => { const entry = await api<TimeEntry>(`/api/tasks/${selectedTask.id}/time`, { method: 'POST', body: JSON.stringify({ minutes, note }) }); setSelectedTask({ ...selectedTask, time_entries: [entry, ...(selectedTask.time_entries || [])], logged_minutes: selectedTask.logged_minutes + minutes }); showToast('Time logged') }} onStatus={status => changeStatus(selectedTask, status)}/>} 
    {toast && <div className="toast">✓ {toast}</div>}
  </div>
}

function Notifications({ notices, onClose, onRead }: { notices: Notice[]; onClose: () => void; onRead: (id: number) => void }) {
  return <div className="notice-popover"><div className="popover-head"><div><b>Notifications</b><span>{notices.filter(n => !n.is_read).length} unread</span></div><button onClick={onClose}>×</button></div>{notices.length ? notices.slice(0, 8).map(item => <button key={item.id} className={item.is_read ? 'read' : ''} onClick={() => onRead(item.id)}><i>{item.kind === 'risk' ? '!' : item.kind === 'assignment' ? '✓' : item.kind === 'comment' ? '◌' : '□'}</i><span><b>{item.title}</b><small>{item.message}</small><em>{relative(item.created_at)}</em></span></button>) : <Empty title="All caught up" text="No new notifications."/>}</div>
}

function DashboardView({ dashboard, tasks, projects, onTask, onView }: { dashboard: Dashboard | null; tasks: Task[]; projects: Project[]; onTask: (task: Task) => void; onView: (view: View) => void }) {
  if (!dashboard) return <div className="skeleton-grid">{Array.from({ length: 8 }).map((_, i) => <div className="skeleton" key={i}/>)}</div>
  const metrics = [
    ['Completed tasks', dashboard.metrics.completed_tasks, '↑ 18% vs last sprint', 'purple', '✓'], ['Overdue tasks', dashboard.metrics.overdue_tasks, dashboard.metrics.overdue_tasks ? 'Needs attention' : 'All on track', 'red', '!'],
    ['Team velocity', dashboard.metrics.velocity, `${dashboard.metrics.total_points} total points`, 'blue', '↗'], ['Sprint health', dashboard.metrics.sprint_health, `${dashboard.metrics.completion_rate}% completion`, 'green', '♡']
  ]
  return <>
    <div className="metric-row">{metrics.map(([label, value, note, color, icon]) => <div className="metric-card" key={String(label)}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><i className={`metric-icon metric-${color}`}>{icon}</i><svg viewBox="0 0 120 35"><polyline points="0,29 14,23 27,27 39,16 52,20 64,10 78,17 92,7 106,13 120,5"/></svg></div>)}</div>
    <div className="dashboard-grid">
      <div className="panel span-2"><div className="panel-head"><div><b>Work board overview</b><span>Live delivery across all active projects</span></div><button onClick={() => onView('board')}>Open board →</button></div><div className="mini-board">{['backlog','in_progress','review','completed'].map(status => <div key={status}><div className="mini-col-head"><span>{statusConfig[status].icon} {statusConfig[status].label}</span><em>{tasks.filter(t => t.status === status).length}</em></div>{tasks.filter(t => t.status === status).slice(0, 3).map(task => <button key={task.id} onClick={() => onTask(task)}><div><small>{task.task_number}</small><Priority value={task.priority}/></div><b>{task.title}</b><div className="card-foot"><span>{fmtDate(task.due_date, true)}</span><div className="avatar-stack">{task.assignees.slice(0, 3).map(user => <Avatar key={user.id} user={user} small/>)}</div></div></button>)}</div>)}</div></div>
      <div className="panel"><div className="panel-head"><div><b>Project portfolio</b><span>{projects.length} active initiatives</span></div><button onClick={() => onView('projects')}>View all</button></div><div className="portfolio-list">{projects.slice(0, 4).map(project => <div key={project.id}><div><i className={`dot dot-${project.color}`}/><span><b>{project.name}</b><small>{project.completed_count}/{project.task_count} completed</small></span><em>{project.progress}%</em></div><progress value={project.progress} max="100"/></div>)}</div></div>
      <div className="panel"><div className="panel-head"><div><b>Team workload</b><span>Open story points by person</span></div><button onClick={() => onView('team')}>View team</button></div><div className="workload-list">{dashboard.workload.slice(0, 5).map((item, index) => <div key={item.user.id}><Avatar user={item.user} small/><span><b>{item.user.full_name}</b><small>{item.tasks} tasks · {item.points} pts</small></span><progress value={item.points} max={Math.max(...dashboard.workload.map(x => x.points), 1)}/><em>{Math.min(98, 45 + item.points * 4)}%</em></div>)}</div></div>
      <div className="panel"><div className="panel-head"><div><b>Upcoming deadlines</b><span>Work requiring attention</span></div><button onClick={() => onView('calendar')}>Calendar</button></div><div className="deadline-list">{dashboard.due_soon.map(task => <button key={task.id} onClick={() => onTask(task)}><time><b>{new Date(task.due_date || '').getDate()}</b><span>{new Date(task.due_date || '').toLocaleString('en', { month: 'short' })}</span></time><span><b>{task.title}</b><small>{task.task_number} · {task.project_name}</small></span><Priority value={task.priority}/></button>)}</div></div>
      <div className="panel span-2"><div className="panel-head"><div><b>Delivery velocity</b><span>Completed story points by sprint</span></div><button onClick={() => onView('analytics')}>Full analytics →</button></div><div className="velocity-chart">{dashboard.velocity_trend.map((item, index) => <div key={item.label}><span style={{ height: `${Math.max(18, item.points * 2.3)}px` }}><i>{item.points}</i></span><small>{item.label}</small></div>)}</div></div>
      <div className="panel"><div className="panel-head"><div><b>Recent activity</b><span>Governed workspace changes</span></div></div><div className="activity-list">{dashboard.activities.slice(0, 6).map(item => <div key={item.id}>{item.actor ? <Avatar user={item.actor} small/> : <span className="avatar avatar-sm">SY</span>}<span><b>{item.actor?.full_name || 'System'} · {item.action}</b><small>{item.details || `${item.entity_type} ${item.entity_id}`}</small></span><em>{relative(item.created_at)}</em></div>)}</div></div>
    </div>
  </>
}

function BoardView({ tasks, onTask, onStatus, canEdit }: { tasks: Task[]; onTask: (task: Task) => void; onStatus: (task: Task, status: string) => void; canEdit: boolean }) {
  const columns = ['backlog', 'in_progress', 'review', 'completed', 'blocked']
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const dragMovedRef = useRef(false)

  function onDragStart(event: DragEvent<HTMLElement>, task: Task) {
    if (!canEdit) return
    dragMovedRef.current = false
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/task-id', String(task.id))
    setDraggingId(task.id)
  }
  function onDragEnd() {
    setDraggingId(null)
    setOverColumn(null)
  }
  function onDragOver(event: DragEvent<HTMLElement>, status: string) {
    if (!canEdit) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setOverColumn(status)
  }
  function onDrop(event: DragEvent<HTMLElement>, status: string) {
    if (!canEdit) return
    event.preventDefault()
    dragMovedRef.current = true
    const id = Number(event.dataTransfer.getData('text/task-id'))
    const task = tasks.find(item => item.id === id)
    if (task && task.status !== status) onStatus(task, status)
    setOverColumn(null)
    setDraggingId(null)
  }

  const statusOptions = columns.map(value => ({ value, label: statusConfig[value].label }))

  return (
    <div className="kanban">
      {columns.map(status => (
        <section className={`kanban-col col-${status}`} key={status}>
          <div className="kanban-head">
            <div><i>{statusConfig[status].icon}</i><b>{statusConfig[status].label}</b><em>{tasks.filter(t => t.status === status).length}</em></div>
            <button type="button">•••</button>
          </div>
          <div
            className={`kanban-body ${overColumn === status ? 'is-drag-over' : ''}`}
            onDragOver={event => onDragOver(event, status)}
            onDragLeave={() => setOverColumn(current => current === status ? null : current)}
            onDrop={event => onDrop(event, status)}
          >
            {tasks.filter(task => task.status === status).map(task => (
              <article
                className={`task-card task-${task.priority} ${draggingId === task.id ? 'is-dragging' : ''}`}
                key={task.id}
                draggable={canEdit}
                onDragStart={event => onDragStart(event, task)}
                onDragEnd={onDragEnd}
                onClick={() => { if (!dragMovedRef.current) onTask(task); dragMovedRef.current = false }}
              >
                <div className="task-top"><span>{task.task_number}</span><Priority value={task.priority}/></div>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <div className="labels">{task.labels.slice(0, 2).map(label => <span key={label}>#{label}</span>)}</div>
                <div className="task-progress"><div><span>Progress</span><b>{task.progress}%</b></div><progress value={task.progress} max="100"/></div>
                <div className="task-meta"><span>□ {fmtDate(task.due_date, true)}</span><span>◈ {task.story_points} pts</span><span>◌ {task.comments_count}</span></div>
                <div className="task-bottom">
                  <div className="avatar-stack">{task.assignees.map(user => <Avatar user={user} small key={user.id}/>)}</div>
                  {canEdit && (
                    <CustomSelect
                      compact
                      value={task.status}
                      options={statusOptions}
                      onChange={value => onStatus(task, value)}
                      onMouseDown={event => event.stopPropagation()}
                    />
                  )}
                </div>
              </article>
            ))}
            {!tasks.some(t => t.status === status) && <Empty title="No tasks" text={canEdit ? 'Drag cards here or create new work.' : 'This workflow stage is clear.'}/>}
          </div>
        </section>
      ))}
    </div>
  )
}

function ListView({ tasks, onTask }: { tasks: Task[]; onTask: (task: Task) => void }) {
  return <div className="panel table-panel"><div className="table-toolbar"><span><b>{tasks.length} tasks</b><small>Sorted by recent activity</small></span><div><button>⇩ Export</button><button>⚙ Columns</button></div></div><div className="task-table"><div className="table-row table-head"><span>Task</span><span>Status</span><span>Priority</span><span>Assignees</span><span>Due date</span><span>Progress</span></div>{tasks.map(task => <button className="table-row" key={task.id} onClick={() => onTask(task)}><span className="task-cell"><i className={`type type-${task.task_type}`}>{task.task_type === 'bug' ? '●' : task.task_type === 'story' ? '◆' : task.task_type === 'milestone' ? '★' : '■'}</i><span><b>{task.title}</b><small>{task.task_number} · {task.project_name}</small></span></span><span><em className={`status status-${task.status}`}>{statusConfig[task.status]?.label}</em></span><span><Priority value={task.priority}/></span><span><div className="avatar-stack">{task.assignees.map(user => <Avatar key={user.id} user={user} small/>)}</div></span><span>{fmtDate(task.due_date)}</span><span className="progress-cell"><progress value={task.progress} max="100"/><b>{task.progress}%</b></span></button>)}</div></div>
}

function CalendarView({ tasks, onTask }: { tasks: Task[]; onTask: (task: Task) => void }) {
  const dated = tasks.filter(t => t.due_date).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
  const groups = dated.reduce<Record<string, Task[]>>((acc, task) => { const key = new Date(task.due_date!).toISOString().slice(0, 10); (acc[key] ||= []).push(task); return acc }, {})
  return <div className="calendar-layout"><div className="panel calendar-main"><div className="calendar-title"><button>‹</button><div><b>{new Date().toLocaleString('en', { month: 'long', year: 'numeric' })}</b><span>Delivery calendar</span></div><button>›</button></div><div className="calendar-week"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div><div className="calendar-grid">{Array.from({ length: 35 }, (_, index) => { const date = new Date(); date.setDate(1 - ((new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7) + index); const key = date.toISOString().slice(0, 10); return <div key={key} className={date.getMonth() !== new Date().getMonth() ? 'muted' : ''}><b className={key === new Date().toISOString().slice(0, 10) ? 'today' : ''}>{date.getDate()}</b>{(groups[key] || []).slice(0, 3).map(task => <button key={task.id} className={`event event-${task.priority}`} onClick={() => onTask(task)}>{task.title}</button>)}</div> })}</div></div><div className="panel agenda"><div className="panel-head"><div><b>Upcoming agenda</b><span>Next scheduled deadlines</span></div></div>{dated.slice(0, 9).map(task => <button key={task.id} onClick={() => onTask(task)}><time><b>{new Date(task.due_date!).getDate()}</b><span>{new Date(task.due_date!).toLocaleString('en', { month: 'short' })}</span></time><span><b>{task.title}</b><small>{task.project_name} · {task.assignees[0]?.full_name || 'Unassigned'}</small></span><Priority value={task.priority}/></button>)}</div></div>
}

function ProjectsView({ projects, tasks, onProject }: { projects: Project[]; tasks: Task[]; onProject: (id: number) => void }) {
  return <div className="project-grid">{projects.map(project => { const projectTasks = tasks.filter(t => t.project_id === project.id); const overdue = projectTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length; return <article className="project-card" key={project.id}><div className="project-cover"><i className={`dot dot-${project.color}`}/><span>{project.key}</span><Priority value={project.priority}/></div><h2>{project.name}</h2><p>{project.description}</p><div className="project-owner"><Avatar user={project.owner} small/><span><b>{project.owner.full_name}</b><small>Project owner</small></span><div className="avatar-stack">{project.members.slice(0, 4).map(u => <Avatar user={u} small key={u.id}/>)}</div></div><div className="project-kpis"><span><b>{project.task_count}</b><small>Total tasks</small></span><span><b>{project.completed_count}</b><small>Completed</small></span><span className={overdue ? 'danger-text' : ''}><b>{overdue}</b><small>Overdue</small></span></div><div className="project-progress"><div><span>Overall progress</span><b>{project.progress}%</b></div><progress value={project.progress} max="100"/></div><div className="project-dates"><span>Started <b>{fmtDate(project.start_date, true)}</b></span><span>Target <b>{fmtDate(project.target_date, true)}</b></span></div><button className="secondary full" onClick={() => onProject(project.id)}>Open project board →</button></article> })}</div>
}

function TeamView({ users, tasks }: { users: User[]; tasks: Task[] }) {
  return <div className="team-grid">{users.map(user => { const assigned = tasks.filter(t => t.assignees.some(a => a.id === user.id)); const active = assigned.filter(t => !['completed'].includes(t.status)); const points = active.reduce((sum, t) => sum + t.story_points, 0); return <article className="team-card" key={user.id}><div className="team-top"><Avatar user={user}/><i className={user.is_active ? 'online' : ''}/><button>•••</button></div><h3>{user.full_name}</h3><p>{user.title}</p><span className="role-chip">{roleNames[user.role]}</span><div className="team-stats"><span><b>{active.length}</b><small>Active tasks</small></span><span><b>{points}</b><small>Story points</small></span><span><b>{assigned.filter(t => t.status === 'completed').length}</b><small>Completed</small></span></div><div className="capacity"><div><span>Capacity utilization</span><b>{Math.min(100, 32 + points * 6)}%</b></div><progress value={Math.min(100, 32 + points * 6)} max="100"/></div><a href={`mailto:${user.email}`}>{user.email}</a></article> })}</div>
}

function AnalyticsView({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div className="skeleton" key={i}/>)}</div>
  const metrics = [['Average cycle time', `${analytics.average_cycle_days} days`, 'Across completed work'], ['Logged effort', `${analytics.total_logged_hours}h`, 'Tracked delivery time'], ['High-priority open', analytics.high_priority_open, 'Critical and high items'], ['Blocked work', analytics.blocked_count, 'Requires intervention']]
  return <><div className="analytics-metrics">{metrics.map(([label, value, text]) => <div key={String(label)}><span>{label}</span><b>{value}</b><small>{text}</small></div>)}</div><div className="analytics-grid"><div className="panel span-2"><div className="panel-head"><div><b>Project delivery performance</b><span>Completion, effort and committed points</span></div></div><div className="delivery-chart">{analytics.delivery.map(item => <div key={item.project}><span><b>{item.project}</b><small>{item.completed}/{item.total} tasks · {item.logged_hours}h logged</small></span><div><progress value={item.completion_rate} max="100"/><b>{item.completion_rate}%</b></div></div>)}</div></div><div className="panel"><div className="panel-head"><div><b>Operational health</b><span>Current portfolio signal</span></div></div><div className="health-ring" style={{ '--value': `${Math.max(0, 92 - analytics.blocked_count * 8)}%` } as React.CSSProperties}><div><b>{Math.max(0, 92 - analytics.blocked_count * 8)}</b><span>Health score</span></div></div><div className="health-legend"><span><i className="green"/>Delivery predictability <b>Strong</b></span><span><i className="amber"/>Workload balance <b>Watch</b></span><span><i className="purple"/>Quality confidence <b>High</b></span></div></div><div className="panel span-3"><div className="panel-head"><div><b>Portfolio comparison</b><span>Detailed enterprise delivery scorecard</span></div><button>Download report</button></div><div className="analytics-table"><div><b>Project</b><b>Tasks</b><b>Points</b><b>Logged</b><b>Completion</b></div>{analytics.delivery.map(item => <div key={item.project}><span>{item.project}</span><span>{item.completed}/{item.total}</span><span>{item.points}</span><span>{item.logged_hours}h</span><span><progress value={item.completion_rate} max="100"/><b>{item.completion_rate}%</b></span></div>)}</div></div></div></>
}

function AuditView({ logs }: { logs: Activity[] }) {
  return <div className="panel audit-panel"><div className="security-banner"><div><span>⊙</span><div><b>Enterprise audit trail</b><p>Security-relevant workspace actions are retained with actor, entity, timestamp and change context.</p></div></div><button>Export evidence</button></div><div className="audit-table"><div className="audit-row audit-head"><span>Actor</span><span>Action</span><span>Resource</span><span>Details</span><span>Timestamp</span></div>{logs.map(log => <div className="audit-row" key={log.id}><span>{log.actor ? <><Avatar user={log.actor} small/><b>{log.actor.full_name}</b></> : 'System'}</span><span><em>{log.action}</em></span><span>{log.entity_type} · {log.entity_id}</span><span>{log.details || '—'}</span><span>{new Date(log.created_at).toLocaleString()}</span></div>)}</div></div>
}

function CreateTask({ projects, users, sprints, defaultProject, onClose, onCreated }: { projects: Project[]; users: User[]; sprints: Sprint[]; defaultProject: number | 'all'; onClose: () => void; onCreated: (task: Task) => void }) {
  const [projectId, setProjectId] = useState<number>(defaultProject === 'all' ? projects[0]?.id : defaultProject)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [type, setType] = useState('task')
  const [points, setPoints] = useState(3)
  const [due, setDue] = useState('')
  const [assignees, setAssignees] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true)
    try { onCreated(await api<Task>('/api/tasks', { method: 'POST', body: JSON.stringify({ project_id: projectId, sprint_id: sprints.find(s => s.project_id === projectId && s.status === 'active')?.id || null, title, description, priority, task_type: type, story_points: points, due_date: due ? new Date(`${due}T18:00:00`).toISOString() : null, assignee_ids: assignees, labels: type === 'bug' ? ['qa'] : ['delivery'], estimate_minutes: points * 90 }) })) } finally { setSubmitting(false) }
  }
  const assignableUsers = users.filter(u => !['client', 'auditor', 'super_admin'].includes(u.role))

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">CREATE WORK ITEM</span><h2>New enterprise task</h2><p>Add accountable, estimable work to the delivery system.</p></div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="form-grid">
          <label className="span-2">Task title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be delivered?" required autoFocus /></label>
          <label>Project<CustomSelect value={projectId} onChange={setProjectId} options={projects.map(p => ({ value: p.id, label: `${p.key} · ${p.name}` }))} /></label>
          <label>Type<CustomSelect value={type} onChange={setType} options={[{ value: 'task', label: 'Task' }, { value: 'story', label: 'Story' }, { value: 'bug', label: 'Bug' }, { value: 'milestone', label: 'Milestone' }]} /></label>
          <label>Priority<CustomSelect value={priority} onChange={setPriority} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]} /></label>
          <label>Story points<input type="number" min="0" max="100" value={points} onChange={e => setPoints(Number(e.target.value))} /></label>
          <label>Due date<input className="date-input" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
          <label className="span-2">Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Context, acceptance criteria and expected outcome…" rows={4} /></label>
          <fieldset className="span-2 assignee-field">
            <legend>Assignees <small>{assignees.length} selected</small></legend>
            <div className="assignee-picker">
              {assignableUsers.map(u => (
                <button type="button" className={assignees.includes(u.id) ? 'selected' : ''} key={u.id} onClick={() => setAssignees(ids => ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id])}>
                  <Avatar user={u} />
                  <span><b>{u.full_name}</b><small>{u.title}</small></span>
                  <i>{assignees.includes(u.id) ? '✓' : '+'}</i>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={submitting || !title}>{submitting ? 'Creating…' : 'Create task →'}</button></div>
      </form>
    </div>
  )
}

function TaskDrawer({ task, currentUser, onClose, onComment, onTime, onStatus }: { task: Task; currentUser: User; onClose: () => void; onComment: (body: string) => Promise<void>; onTime: (minutes: number, note: string) => Promise<void>; onStatus: (status: string) => void }) {
  const [tab, setTab] = useState<'activity' | 'time'>('activity')
  const [comment, setComment] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [note, setNote] = useState('')
  const editable = !['client', 'auditor'].includes(currentUser.role)
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="task-drawer" onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><span className={`type type-${task.task_type}`}>{task.task_type === 'bug' ? '●' : '◆'}</span><b>{task.task_number}</b><span>in {task.project_name}</span></div><button onClick={onClose}>×</button></div><div className="drawer-scroll"><div className="drawer-title"><Priority value={task.priority}/><h1>{task.title}</h1><p>{task.description}</p></div><div className="drawer-info"><label>Status<CustomSelect disabled={!editable} value={task.status} onChange={onStatus} options={Object.entries(statusConfig).map(([value, item]) => ({ value, label: item.label }))} /></label><label>Progress<div className="drawer-progress"><progress value={task.progress} max="100"/><b>{task.progress}%</b></div></label><label>Assignees<div className="avatar-name-list">{task.assignees.map(u => <span key={u.id}><Avatar user={u} small/>{u.full_name}</span>)}</div></label><label>Due date<b>{fmtDate(task.due_date)}</b></label><label>Sprint<b>{task.sprint_name || 'Backlog'}</b></label><label>Estimate<b>{Math.round(task.estimate_minutes / 60 * 10) / 10} hours · {task.story_points} points</b></label><label>Time logged<b>{Math.round(task.logged_minutes / 60 * 10) / 10} hours</b></label><label>Labels<div className="labels">{task.labels.map(label => <span key={label}>#{label}</span>)}</div></label></div><div className="drawer-tabs"><button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Activity {task.comments_count}</button><button className={tab === 'time' ? 'active' : ''} onClick={() => setTab('time')}>Time log {task.time_entries?.length || 0}</button></div>{tab === 'activity' ? <div className="comments"><form onSubmit={async e => { e.preventDefault(); if (!comment.trim()) return; await onComment(comment); setComment('') }}><Avatar user={currentUser} small/><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment or update…" rows={3}/><button className="primary" disabled={!comment.trim()}>Comment</button></form>{(task.comments || []).slice().reverse().map(item => <article key={item.id}><Avatar user={item.author} small/><div><div><b>{item.author.full_name}</b><span>{relative(item.created_at)}</span></div><p>{item.body}</p></div></article>)}{!task.comments?.length && <Empty title="No discussion yet" text="Add the first delivery update."/>}</div> : <div className="time-log"><form onSubmit={async e => { e.preventDefault(); await onTime(minutes, note); setNote('') }}><label>Minutes<input type="number" value={minutes} min="1" max="1440" onChange={e => setMinutes(Number(e.target.value))}/></label><label>Work note<input value={note} onChange={e => setNote(e.target.value)} placeholder="What did you work on?"/></label><button className="primary">Log time</button></form>{task.time_entries?.map(entry => <article key={entry.id}><Avatar user={entry.user} small/><span><b>{entry.user.full_name}</b><small>{entry.note || 'Work logged'} · {fmtDate(entry.work_date)}</small></span><em>{entry.minutes}m</em></article>)}</div>}</div></aside></div>
}

export default App
