import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { NETWORKS, fmtTime } from '@/lib/utils'
import Sidebar, { NAV } from '@/components/Sidebar'
import TopHeader from '@/components/TopHeader'
import MetricCardsRow from '@/components/MetricCardsRow'
import PortfolioControlCard from '@/components/PortfolioControlCard'
import StatisticsChartCard from '@/components/StatisticsChartCard'
import LedgerTable from '@/components/LedgerTable'
import PolicyModal from '@/components/PolicyModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const EMAIL_RX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

function AuthDialog({ open, onClose, onAuth }) {
  const ref = useRef(null)
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!EMAIL_RX.test(email.trim())) return setErr('Enter a valid email address.')
    if (pw.length < 10) return setErr('Password must be at least 10 characters.')
    setBusy(true)
    try {
      const d = await (mode === 'in' ? api.login : api.signup)(email.trim(), pw)
      setPw('')
      onAuth(d)
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }} aria-labelledby="auth-title"
      className="w-[min(420px,calc(100vw-32px))] rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={submit} noValidate className="grid gap-4 p-6">
        <h2 id="auth-title" className="text-xl font-bold tracking-tight">{mode === 'in' ? 'Sign in to Leash' : 'Create your Leash account'}</h2>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1" role="group" aria-label="Account">
          {[['in', 'Sign in'], ['up', 'Create account']].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setErr('') }}
              className={`h-9 rounded-lg text-sm font-semibold transition-colors ${mode === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
          ))}
        </div>
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="auth-email">Email
          <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="auth-pw">Password
          <Input id="auth-pw" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
          {mode === 'up' && <span className="text-xs font-normal text-muted-foreground">At least 10 characters.</span>}
        </label>
        {err && <p role="alert" className="text-sm font-medium text-rose-700">{err}</p>}
        <Button type="submit" className="rounded-full" disabled={busy}>{busy ? 'Please wait' : mode === 'in' ? 'Sign in' : 'Create account'}</Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
      </form>
    </dialog>
  )
}

function Gate({ onSignIn, text }) {
  return (
    <Card><CardContent className="flex flex-col items-start gap-3 p-6">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button className="rounded-full" onClick={onSignIn}>Sign in or create account</Button>
    </CardContent></Card>
  )
}

function TokensCard({ user, onSignIn }) {
  const [list, setList] = useState(null)
  const [net, setNet] = useState(NETWORKS[0])
  const [fresh, setFresh] = useState(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => api.tokens().then(setList).catch((e) => setErr(e.message)), [])
  useEffect(() => { if (user) load() }, [user, load])
  if (!user) return <Gate onSignIn={onSignIn} text="Sign in to issue testnet SDK tokens for your agents." />
  const issue = () => { setErr(''); api.issueToken(net).then((t) => { setFresh(t); load() }).catch((e) => setErr(e.message)) }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-bold">SDK tokens</CardTitle><CardDescription>Only a SHA-256 hash is stored. A token is shown once, when you create it.</CardDescription></CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor="tok-net">Network
            <select id="tok-net" value={net} onChange={(e) => setNet(e.target.value)} className="h-10 min-w-[220px] rounded-xl border border-input bg-card px-3 text-sm">
              {NETWORKS.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <Button className="rounded-full" onClick={issue}>Issue testnet token</Button>
        </div>
        {fresh && (
          <div role="status" className="rounded-xl bg-primary/10 p-3">
            <p className="text-sm font-semibold text-primary">New token for {fresh.network}. Copy it now.</p>
            <code className="mt-1 block break-all font-mono text-xs">{fresh.token}</code>
          </div>
        )}
        {err && <p role="alert" className="text-sm font-medium text-rose-700">{err}</p>}
        {list && list.length === 0 && <p className="text-sm text-muted-foreground">No tokens yet.</p>}
        {list && list.length > 0 && (
          <ul className="divide-y divide-border/70 text-sm">
            {list.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="tnum font-mono">{t.prefix}...</span>
                <span className="text-muted-foreground">{t.network}</span>
                <span className="tnum text-muted-foreground">{fmtTime(t.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function SpecCard() {
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.modelInfo().then(setInfo).catch((e) => setErr(e.message)) }, [])
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-bold">Circuit spec</CardTitle><CardDescription>What the prover must satisfy before LeashAccount settles a UserOp.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {err && <p role="alert" className="font-medium text-rose-700">{err}</p>}
        {!info && !err && <div className="h-24 animate-pulse rounded-xl bg-secondary" aria-hidden="true" />}
        {info && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[['Circuit', info.circuit], ['Proof system', info.proof_system], ['Curve', info.curve], ['Account standard', info.account_standard], ['Hash', info.hash], ['Window', `${info.window_seconds / 3600} hours`]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs font-semibold text-muted-foreground">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>
              ))}
            </dl>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">{info.constraints.map((c) => <li key={c}>{c}</li>)}</ol>
            <p className="break-all font-mono text-xs text-muted-foreground">Allowlist root {info.allowlist_root}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AccountCard({ me, onSignIn, onSignOut }) {
  if (!me || !me.user) return <Gate onSignIn={onSignIn} text="Sign in to manage your owner account." />
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-bold">Account</CardTitle><CardDescription>Your owner key holder details.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="rounded-xl bg-secondary/70 p-3"><p className="text-xs font-semibold text-muted-foreground">Email</p><p className="mt-1 font-semibold">{me.user.email}</p></div>
        <div className="rounded-xl bg-secondary/70 p-3"><p className="text-xs font-semibold text-muted-foreground">Policy commitment</p><p className="mt-1 break-all font-mono text-xs">{me.commitment}</p></div>
        <Button variant="outline" className="w-fit rounded-full" onClick={onSignOut}>Sign out</Button>
      </CardContent>
    </Card>
  )
}

export default function App() {
  const [me, setMe] = useState(undefined)   // undefined = loading, null = signed out
  const [trades, setTrades] = useState(null)
  const [active, setActive] = useState('overview')
  const [menu, setMenu] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [note, setNote] = useState('')
  const chartRef = useRef(null)
  const ledgerRef = useRef(null)

  const user = me && me.user ? me.user : null
  const uid = user ? user.id : null
  const frozen = !!(me && me.policy && me.policy.frozen)
  const page = NAV.find((n) => n.id === active) || NAV[0]
  const dashboard = ['overview', 'policy', 'ledger', 'analytics'].includes(active)

  useEffect(() => { api.me().then((d) => setMe(d.user ? d : null)).catch(() => setMe(null)) }, [])

  const refreshTrades = useCallback(() => api.trades().then((d) => setTrades(d.trades)).catch(() => setTrades([])), [])
  useEffect(() => { if (uid) refreshTrades(); else setTrades(null) }, [uid, refreshTrades])

  useEffect(() => {
    const target = active === 'ledger' ? ledgerRef.current : active === 'analytics' ? chartRef.current : null
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [active])

  const snap = (d) => setMe((m) => ({ ...m, policy: d.policy, spent24h: d.spent24h, commitment: d.commitment }))
  const closeMenu = useCallback(() => setMenu(false), [])
  const signIn = () => setAuthOpen(true)
  const signOut = () => api.logout().finally(() => { setMe(null); setTrades(null); setActive('overview') })
  const fail = (e) => setNote(e.message)

  const go = (id) => {
    setActive(id)
    if (id === 'policy') { if (user) setPolicyOpen(true); else signIn() }
  }
  const closePolicy = () => { setPolicyOpen(false); setActive((a) => (a === 'policy' ? 'overview' : a)) }
  const savePolicy = async (patch) => { const d = await api.policy(patch); snap(d) }
  const freeze = (next) => { setNote(''); api.freeze(!!next).then(snap).catch(fail) }
  const reset = () => { setNote(''); api.reset().then((d) => { snap(d); return refreshTrades() }).catch(fail) }
  const onResult = (r) => { snap(r); refreshTrades() }

  return (
    <div className="min-h-screen">
      <Sidebar active={active} onNavigate={go} open={menu} onClose={closeMenu} frozen={frozen} onToggleFreeze={freeze} user={user} />
      <div className="lg:pl-64">
        <TopHeader title={page.label} subtitle={page.subtitle} user={user} frozen={frozen} onMenu={() => setMenu(true)} onSignIn={signIn} onSignOut={signOut} />
        {frozen && (
          <div role="alert" className="flex items-center gap-2 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-rose-800 sm:px-6 lg:px-8">
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            Treasury frozen by the owner key. LeashAccount rejects every UserOp until you unfreeze it.
          </div>
        )}
        <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
          {note && <p role="alert" className="text-sm font-medium text-rose-700">{note}</p>}
          {dashboard ? (
            <>
              <MetricCardsRow me={me} trades={trades} loading={me === undefined} />
              <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <PortfolioControlCard me={me} loading={me === undefined} onResult={onResult} onOpenPolicy={() => setPolicyOpen(true)} onSignIn={signIn} />
                <div ref={chartRef} className="scroll-mt-24"><StatisticsChartCard trades={trades} cap={me && me.policy ? me.policy.cap : 0} signedIn={!!user} loading={me === undefined} /></div>
              </div>
              <div ref={ledgerRef} className="scroll-mt-24"><LedgerTable trades={trades} signedIn={!!user} loading={me === undefined} onSignIn={signIn} /></div>
            </>
          ) : active === 'tokens' ? <TokensCard user={user} onSignIn={signIn} />
            : active === 'spec' ? <SpecCard />
            : <AccountCard me={me} onSignIn={signIn} onSignOut={signOut} />}
        </main>
      </div>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuth={(d) => { setMe(d); setAuthOpen(false) }} />
      <PolicyModal open={policyOpen} onClose={closePolicy} me={me} onSave={savePolicy} onFreeze={freeze} onReset={reset} />
    </div>
  )
}
