import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'

type Task = { id: string; label: string; category: string }
type Health = { workout: boolean; sleep_hours: string; energy: string }
type WeeklyReview = { wins: string; blockers: string; next_week: string; rating: string }
type DayProgress = { day_number: number; completed_tasks: Record<string, boolean>; recovery_tasks: string[]; health: Health; notes: string; weekly_review: WeeklyReview }

const START_DATE = '2026-10-16'
const PLAN_DAYS = 60
const TASKS: Task[] = [
  { id: 'learn', label: 'AI Full-Stack learning (45–60 min)', category: 'Career' },
  { id: 'trade', label: 'Harmonic pattern study / practice (20 min)', category: 'Trading' },
  { id: 'health', label: 'Workout or planned movement (20–45 min)', category: 'Health' },
  { id: 'communication', label: 'Communication practice (10 min)', category: 'Communication' },
  { id: 'project', label: 'Build algo app / project work (20 min)', category: 'Project' },
  { id: 'review', label: 'Daily review and plan tomorrow (5 min)', category: 'Review' },
]
const AI_TOPICS = ['JavaScript foundations + async patterns', 'TypeScript types, interfaces and generics', 'React components, hooks and state', 'React forms, validation and API calls', 'Node.js, Express and REST APIs', 'SQL, data modelling and authentication', 'AI APIs, prompt design and structured output', 'Build, test, deploy and review a full-stack project', 'Improve architecture, security and error handling']
const HARMONIC_TOPICS = ['Learn swing points and Fibonacci ratios', 'Practice X-A-B-C-D structure', 'Identify the Gartley pattern', 'Identify the Bat pattern', 'Identify the Butterfly pattern', 'Identify the Crab pattern', 'Compare pattern ratios and invalidation', 'Mark bullish examples on charts', 'Mark bearish examples on charts', 'Practice entry, stop and target planning', 'Backtest examples without live money', 'Record false positives and invalid patterns', 'Review risk-to-reward examples', 'Complete a mixed-pattern quiz', 'Review all 15 lessons and make a cheat sheet']
function dateForDay(day: number) { const d = new Date(`${START_DATE}T12:00:00`); d.setDate(d.getDate() + day - 1); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
function isoForDay(day: number) { const d = new Date(`${START_DATE}T12:00:00`); d.setDate(d.getDate() + day - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function emptyDay(day_number: number): DayProgress { return { day_number, completed_tasks: {}, recovery_tasks: [], health: { workout: false, sleep_hours: '', energy: 'Okay' }, notes: '', weekly_review: { wins: '', blockers: '', next_week: '', rating: '3' } } }
function getLocalKey(userId: string) { return `growth-planner:${userId}` }
function focusForDay(day: number) { const week = Math.min(9, Math.ceil(day / 7)); return { week, ai: AI_TOPICS[Math.min(AI_TOPICS.length - 1, week - 1)], harmonic: day <= 15 ? HARMONIC_TOPICS[day - 1] : 'Review one pattern, journal a chart example, and refine your rules' } }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [authMessage, setAuthMessage] = useState(''); const [busy, setBusy] = useState(false); const [selectedDay, setSelectedDay] = useState(1)
  const [progress, setProgress] = useState<Record<number, DayProgress>>({}); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [usingLocalMode, setUsingLocalMode] = useState(false)
  const [reminderTime, setReminderTime] = useState('19:30'); const [reminderEnabled, setReminderEnabled] = useState(false); const [reminderMessage, setReminderMessage] = useState('')

  const userKey = usingLocalMode ? 'local-demo-user' : session?.user.id
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session?.user.id) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase!.from('planner_progress').select('day_number,completed_tasks,recovery_tasks,health,notes,weekly_review').eq('user_id', session!.user.id)
      if (cancelled) return
      if (error) { setMessage(`Could not load cloud data: ${error.message}. If you upgraded an existing database, run the updated schema.sql.`); return }
      const next: Record<number, DayProgress> = {}
      for (const row of data ?? []) next[row.day_number] = { ...emptyDay(row.day_number), completed_tasks: row.completed_tasks ?? {}, recovery_tasks: row.recovery_tasks ?? [], health: { ...emptyDay(row.day_number).health, ...(row.health ?? {}) }, notes: row.notes ?? '', weekly_review: { ...emptyDay(row.day_number).weekly_review, ...(row.weekly_review ?? {}) } }
      setProgress(next)
    }
    void load(); return () => { cancelled = true }
  }, [session?.user.id])
  useEffect(() => {
    if (!usingLocalMode) return
    try { const saved = localStorage.getItem(getLocalKey('local-demo-user')); if (saved) setProgress(JSON.parse(saved) as Record<number, DayProgress>) } catch { /* ignore malformed demo data */ }
  }, [usingLocalMode])
  useEffect(() => {
    if (!userKey) return
    const saved = localStorage.getItem(`growth-reminder:${userKey}`)
    if (saved) { try { const parsed = JSON.parse(saved) as { enabled: boolean; time: string }; setReminderEnabled(parsed.enabled); setReminderTime(parsed.time) } catch { /* ignore invalid settings */ } }
  }, [userKey])
  useEffect(() => {
    if (!reminderEnabled || !userKey) return
    const id = window.setInterval(() => {
      const now = new Date(); const today = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const sentKey = `growth-reminder-sent:${userKey}:${now.toDateString()}`
      if (today === reminderTime && !localStorage.getItem(sentKey)) {
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Personal Growth Planner', { body: 'Take 5 minutes to check in, record your progress, and plan tomorrow.' })
        setReminderMessage('Reminder time reached. If notifications are allowed, a reminder was shown. Keep this app open for reminders.')
        localStorage.setItem(sentKey, '1')
      }
    }, 20000)
    return () => window.clearInterval(id)
  }, [reminderEnabled, reminderTime, userKey])

  const selected = progress[selectedDay] ?? emptyDay(selectedDay)
  const completedCount = useMemo(() => Object.values(progress).reduce((total, day) => total + TASKS.filter(task => day.completed_tasks[task.id]).length, 0), [progress])
  const totalChecks = PLAN_DAYS * TASKS.length; const percent = Math.round((completedCount / totalChecks) * 100); const dayDone = TASKS.filter(task => selected.completed_tasks[task.id]).length
  const focus = focusForDay(selectedDay); const weekStart = Math.floor((selectedDay - 1) / 7) * 7 + 1; const weekEnd = Math.min(PLAN_DAYS, weekStart + 6)
  const weeklyDays = Array.from({ length: weekEnd - weekStart + 1 }, (_, i) => progress[weekStart + i] ?? emptyDay(weekStart + i))
  const weeklyDone = weeklyDays.reduce((n, day) => n + TASKS.filter(task => day.completed_tasks[task.id]).length, 0)
  const weekReview = progress[weekEnd] ?? emptyDay(weekEnd)

  async function authenticate(e: FormEvent) { e.preventDefault(); setBusy(true); setAuthMessage(''); if (!supabase) { setAuthMessage('Supabase is not configured yet. Follow the README setup steps.'); setBusy(false); return }
    const result = authMode === 'signup' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false); if (result.error) setAuthMessage(result.error.message); else if (authMode === 'signup' && !result.data.session) setAuthMessage('Account created. Check your email to confirm your account, then sign in.'); else setAuthMessage('Signed in successfully.')
  }
  function updateDay(patch: Partial<DayProgress>) { const updated = { ...selected, ...patch }; setProgress(prev => ({ ...prev, [selectedDay]: updated })); setMessage('Unsaved changes') }
  function toggleTask(taskId: string, checked: boolean) { updateDay({ completed_tasks: { ...selected.completed_tasks, [taskId]: checked } }) }
  async function persistRows(rows: DayProgress[]) {
    if (usingLocalMode) { const next = { ...progress }; rows.forEach(row => { next[row.day_number] = row }); try { localStorage.setItem(getLocalKey('local-demo-user'), JSON.stringify(next)); setProgress(next); return true } catch { return false } }
    if (!session || !supabase) { setMessage('Sign in to save progress.'); return false }
    const payload = rows.map(row => ({ user_id: session.user.id, day_number: row.day_number, completed_tasks: row.completed_tasks, recovery_tasks: row.recovery_tasks, health: row.health, notes: row.notes, weekly_review: row.weekly_review, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('planner_progress').upsert(payload, { onConflict: 'user_id,day_number' })
    if (error) { setMessage(`Save failed: ${error.message}. If this is an older database, run the updated schema.sql.`); return false }
    const next = { ...progress }; rows.forEach(row => { next[row.day_number] = row }); setProgress(next); return true
  }
  async function saveDay() { setSaving(true); setMessage(''); const ok = await persistRows([selected]); setMessage(ok ? usingLocalMode ? 'Saved on this device only.' : 'Progress saved to your account.' : 'Unable to save. Check your connection and database schema.'); setSaving(false) }
  async function moveMissedTasks() {
    if (selectedDay >= PLAN_DAYS) { setMessage('There is no next day in this 60-day plan. Export your data or extend the plan.'); return }
    const unfinished = TASKS.filter(task => !selected.completed_tasks[task.id]).map(task => task.id)
    if (!unfinished.length) { setMessage('All regular tasks are complete today. Nothing to carry forward.'); return }
    const nextDay = progress[selectedDay + 1] ?? emptyDay(selectedDay + 1)
    const updatedNext = { ...nextDay, recovery_tasks: Array.from(new Set([...nextDay.recovery_tasks, ...unfinished])) }
    setSaving(true); const ok = await persistRows([selected, updatedNext]); setSaving(false)
    setMessage(ok ? `Moved ${unfinished.length} unfinished task${unfinished.length === 1 ? '' : 's'} to Day ${selectedDay + 1}. Your original day is unchanged.` : 'Could not move tasks. Check your connection and database schema.')
  }
  async function saveWeeklyReview(patch: Partial<WeeklyReview>) {
    const anchor = progress[weekEnd] ?? emptyDay(weekEnd); const updated = { ...anchor, weekly_review: { ...anchor.weekly_review, ...patch } }
    setProgress(prev => ({ ...prev, [weekEnd]: updated })); setMessage('Weekly review changed — save the review to sync it.');
  }
  async function persistWeeklyReview() { setSaving(true); const row = progress[weekEnd] ?? emptyDay(weekEnd); const ok = await persistRows([row]); setSaving(false); setMessage(ok ? `Week ${Math.ceil(weekEnd / 7)} review saved.` : 'Could not save weekly review.') }
  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const header = ['day','date','ai_task','harmonic_task','completed_tasks','total_tasks','recovery_tasks','workout','sleep_hours','energy','notes','weekly_wins','weekly_blockers','next_week','weekly_rating']
    const rows = Array.from({ length: PLAN_DAYS }, (_, i) => { const day = i + 1; const p = progress[day] ?? emptyDay(day); const f = focusForDay(day); return [day, isoForDay(day), f.ai, f.harmonic, TASKS.filter(t => p.completed_tasks[t.id]).map(t => t.label).join('; '), TASKS.length, p.recovery_tasks.map(id => TASKS.find(t => t.id === id)?.label ?? id).join('; '), p.health.workout, p.health.sleep_hours, p.health.energy, p.notes, p.weekly_review.wins, p.weekly_review.blockers, p.weekly_review.next_week, p.weekly_review.rating].map(escape).join(',') })
    const blob = new Blob([[header.map(escape).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'personal-growth-progress.csv'; a.click(); URL.revokeObjectURL(url); setMessage('CSV export created.')
  }
  async function configureReminder() {
    if (!userKey) return
    if (!('Notification' in window)) { setReminderMessage('Browser notifications are not supported in this browser.'); return }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') { setReminderMessage('Notifications are blocked. Allow them in your browser site settings, then try again.'); setReminderEnabled(false); return }
    setReminderEnabled(true); localStorage.setItem(`growth-reminder:${userKey}`, JSON.stringify({ enabled: true, time: reminderTime })); setReminderMessage(`Daily reminder enabled for ${reminderTime}. Keep this page open; reminders won't run when the browser is closed.`)
  }
  function disableReminder() { setReminderEnabled(false); if (userKey) localStorage.setItem(`growth-reminder:${userKey}`, JSON.stringify({ enabled: false, time: reminderTime })); setReminderMessage('Daily reminder disabled.') }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setSession(null); setProgress({}); setUsingLocalMode(false); setMessage('') }

  if (!session && !usingLocalMode) return <main className="auth-shell"><section className="auth-card"><div className="eyebrow">YOUR NEXT 60 DAYS</div><h1>Personal Growth Planner</h1><p className="muted">One day at a time. Track learning, health, communication and your project.</p>
    {isSupabaseConfigured ? <><form onSubmit={authenticate} className="auth-form"><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" minLength={6} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy} className="primary">{busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button></form><p className="auth-message">{authMessage}</p><button className="text-button" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthMessage('') }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></> : <div className="setup-note"><strong>Connect Supabase to enable accounts.</strong><p>Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase URL and publishable key, then restart the dev server.</p></div>}
    <button className="secondary full" onClick={() => setUsingLocalMode(true)}>Preview with local demo mode</button><p className="tiny">Demo mode saves only in this browser and is not a multi-user account.</p></section></main>

  return <main className="app-shell"><header className="topbar"><div><div className="eyebrow">OCT 16 – DEC 14, 2026</div><h1>Personal Growth Planner</h1><p className="muted">Small consistent actions compound into real progress.</p></div><div className="top-actions">{usingLocalMode && <span className="demo-pill">Local demo</span>}<button className="secondary" onClick={exportCsv}>Export CSV</button><button className="secondary" onClick={signOut}>{usingLocalMode ? 'Exit demo' : 'Sign out'}</button></div></header>
    <section className="summary-grid"><article className="summary-card"><span className="muted">Overall completion</span><strong>{percent}%</strong><div className="progress-track"><div style={{ width: `${percent}%` }} /></div><small>{completedCount} of {totalChecks} check-ins</small></article><article className="summary-card"><span className="muted">Current day</span><strong>Day {selectedDay}</strong><small>{dateForDay(selectedDay)}</small><div className="mini-progress">{dayDone}/{TASKS.length} regular tasks done today</div></article><article className="summary-card"><span className="muted">Consistency tip</span><strong className="tip-title">Never miss twice</strong><small>Move unfinished tasks forward and restart with one small action.</small></article></section>
    <section className="focus-grid"><article className="focus-card"><div className="eyebrow">AI FULL-STACK · WEEK {focus.week}</div><h3>{focus.ai}</h3><p>Study a small concept, write notes, and apply it in your project.</p></article><article className="focus-card"><div className="eyebrow">HARMONIC PATTERNS · DAY {selectedDay <= 15 ? selectedDay : 'REVIEW'}</div><h3>{focus.harmonic}</h3><p>Use chart screenshots and a journal. Treat this as education, not a live-trading signal.</p></article></section>
    <section className="planner-layout"><aside className="day-panel"><div className="section-heading"><h2>Your 60 days</h2><span className="muted">Select a day</span></div><div className="day-grid">{Array.from({ length: PLAN_DAYS }, (_, i) => i + 1).map(day => { const count = TASKS.filter(task => progress[day]?.completed_tasks[task.id]).length; return <button key={day} className={`day-button ${selectedDay === day ? 'active' : ''} ${count === TASKS.length ? 'complete' : ''}`} onClick={() => { setSelectedDay(day); setMessage('') }} aria-label={`Day ${day}, ${count} tasks complete`}><span>{day}</span>{count === TASKS.length && <i>✓</i>}</button> })}</div><p className="tiny">Green days have all regular daily tasks checked.</p><div className="reminder-box"><h3>Daily reminder</h3><label>Reminder time<input type="time" value={reminderTime} onChange={e => { setReminderTime(e.target.value); if (userKey) localStorage.setItem(`growth-reminder:${userKey}`, JSON.stringify({ enabled: reminderEnabled, time: e.target.value })) }} /></label><div className="reminder-actions"><button className="primary" onClick={configureReminder}>Enable</button><button className="secondary" onClick={disableReminder}>Disable</button></div><p className="tiny">Works while this page is open and browser notifications are allowed.</p><p className="tiny" role="status">{reminderMessage}</p></div></aside>
    <section className="detail-panel"><div className="section-heading day-title"><div><div className="eyebrow">DAILY CHECK-IN</div><h2>Day {selectedDay}</h2><p className="muted">{dateForDay(selectedDay)} · {dayDone} of {TASKS.length} complete</p></div><div className="day-nav"><button className="secondary" disabled={selectedDay === 1} onClick={() => setSelectedDay(d => d - 1)}>← Prev</button><button className="secondary" disabled={selectedDay === PLAN_DAYS} onClick={() => setSelectedDay(d => d + 1)}>Next →</button></div></div>
      <div className="task-list">{TASKS.map(task => <label key={task.id} className={`task-row ${selected.completed_tasks[task.id] ? 'checked' : ''}`}><input type="checkbox" checked={Boolean(selected.completed_tasks[task.id])} onChange={e => toggleTask(task.id, e.target.checked)} /><span className="task-copy"><span className="task-label">{task.label}</span><small>{task.category}</small></span></label>)}</div>
      {selected.recovery_tasks.length > 0 && <div className="recovery-box"><h3><span>Carry-over tasks</span><span className="recovery-count">{selected.recovery_tasks.length}</span></h3><p className="tiny">These were moved from an earlier day. Check them off when finished.</p>{selected.recovery_tasks.map(id => { const task = TASKS.find(t => t.id === id); return <label className="task-row" key={id}><input type="checkbox" checked={false} onChange={() => { updateDay({ recovery_tasks: selected.recovery_tasks.filter(x => x !== id), completed_tasks: { ...selected.completed_tasks, [id]: true } }) }} /><span className="task-copy"><span className="task-label">{task?.label ?? id}</span><small>Carry-over · remove from list when completed</small></span></label> })}</div>}
      <div className="recovery-actions"><button className="secondary" onClick={moveMissedTasks} disabled={saving || selectedDay === PLAN_DAYS}>Move unfinished tasks to next day →</button><span className="tiny">Does not change your original checkboxes.</span></div>
      <div className="health-section"><h3>Health check-in</h3><label className="workout-check"><input type="checkbox" checked={selected.health.workout} onChange={e => updateDay({ health: { ...selected.health, workout: e.target.checked } })} /> Workout / movement completed</label><div className="health-fields"><label>Sleep (hours)<input type="number" min="0" max="24" step="0.5" placeholder="e.g. 7.5" value={selected.health.sleep_hours} onChange={e => updateDay({ health: { ...selected.health, sleep_hours: e.target.value } })} /></label><label>Energy level<select value={selected.health.energy} onChange={e => updateDay({ health: { ...selected.health, energy: e.target.value } })}><option>Low</option><option>Okay</option><option>Good</option><option>Excellent</option></select></label></div></div>
      <label className="notes-label">Daily notes<textarea rows={3} placeholder="What went well? What will you improve tomorrow?" value={selected.notes} onChange={e => updateDay({ notes: e.target.value })} /></label><div className="save-row"><span className="save-message" role="status">{message}</span><button className="primary" onClick={saveDay} disabled={saving}>{saving ? 'Saving…' : 'Save this day'}</button></div>
      <div className="weekly-review"><div className="section-heading"><div><div className="eyebrow">WEEKLY REVIEW</div><h3>Week {Math.ceil(weekEnd / 7)} · Days {weekStart}–{weekEnd}</h3></div><strong>{weeklyDone}/{weeklyDays.length * TASKS.length}</strong></div><div className="progress-track"><div style={{ width: `${Math.round(weeklyDone / (weeklyDays.length * TASKS.length) * 100)}%` }} /></div><p className="tiny">Review is saved to Day {weekEnd}. Select any day in a week to edit that week's review.</p><label>What went well?<textarea rows={2} value={weekReview.weekly_review.wins} onChange={e => saveWeeklyReview({ wins: e.target.value })} placeholder="Wins and progress…" /></label><label>What blocked me?<textarea rows={2} value={weekReview.weekly_review.blockers} onChange={e => saveWeeklyReview({ blockers: e.target.value })} placeholder="Distractions, time, difficult topics…" /></label><label>Top priorities for next week<textarea rows={2} value={weekReview.weekly_review.next_week} onChange={e => saveWeeklyReview({ next_week: e.target.value })} placeholder="Choose 1–3 realistic priorities…" /></label><label>How did the week feel?<select value={weekReview.weekly_review.rating} onChange={e => saveWeeklyReview({ rating: e.target.value })}><option value="1">1 — Very difficult</option><option value="2">2 — Difficult</option><option value="3">3 — Okay</option><option value="4">4 — Good</option><option value="5">5 — Excellent</option></select></label><button className="primary" onClick={persistWeeklyReview} disabled={saving}>{saving ? 'Saving…' : 'Save weekly review'}</button></div>
    </section></section><footer>Built for progress, not perfection. Your account data is private when Supabase RLS is configured correctly.</footer></main>
}
