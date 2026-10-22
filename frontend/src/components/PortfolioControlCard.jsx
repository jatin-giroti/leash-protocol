import { useState } from 'react'
import { CheckCircle2, ChevronRight, CircleDot, Loader2, MoreHorizontal, Play, Sparkles, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, fmt, usd, SCENARIOS } from '@/lib/utils'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CHIP = {
  idle: { label: 'Idle', variant: 'muted', icon: CircleDot },
  run: { label: 'Simulating', variant: 'default', icon: Loader2 },
  ok: { label: 'Verified', variant: 'success', icon: CheckCircle2 },
  bad: { label: 'Rejected', variant: 'danger', icon: XCircle },
}
const LOG_TONE = { ok: 'text-emerald-700', bad: 'text-rose-700', '': 'text-muted-foreground' }
const INTRO = [{ t: 'Pick a scenario and press Run. Every check runs on the server against your ledger.', c: '' }]

export default function PortfolioControlCard({ me, loading, onResult, onOpenPolicy, onSignIn }) {
  const [sc, setSc] = useState('A')
  const [chip, setChip] = useState('idle')
  const [log, setLog] = useState(INTRO)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)

  const signedIn = !!(me && me.user)
  const spent = signedIn ? me.spent24h : 0
  const cap = signedIn ? me.policy.cap : 0
  const pct = cap ? Math.min(100, Math.round((spent / cap) * 100)) : 0
  const pillVariant = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success'
  const scenario = SCENARIOS.find((s) => s.key === sc)
  const push = (t, c = '') => setLog((l) => [...l, { t, c }])
  const Chip = CHIP[chip]

  async function run() {
    if (!signedIn) return onSignIn()
    if (busy) return
    setBusy(true); setChip('run'); setLog([]); setLast(null)
    try {
      const r = await api.simulate(sc)
      push('intent decoded: ' + r.intent)
      await sleep(300)
      if (r.paused) {
        push('LeashAccount.paused() returned true', 'bad')
        await sleep(250)
        push('REJECTED: ' + r.reason + ' Nothing broadcast. Gas lost: 0', 'bad')
      } else {
        for (const c of r.constraints) {
          await sleep(300)
          push(`${c.id} ${c.name}: ${c.ok ? 'ok' : 'UNSATISFIED'}`, c.ok ? 'ok' : 'bad')
          if (!c.ok) break
        }
        await sleep(300)
        if (r.status === 'verified') {
          push('Groth16 proof generated in 1.42s (simulated)', 'ok')
          await sleep(250)
          push(`VERIFIED: UserOp settled, verifier gas ${fmt(r.gas)}. Rolling spend ${usd(r.spent24h)} of ${usd(r.policy.cap)}`, 'ok')
        } else {
          push('Witness generation failed: ' + r.reason, 'bad')
          push('REJECTED: UserOp halted before broadcast. Gas lost: 0', 'bad')
        }
      }
      setLast(r)
      setChip(r.status === 'verified' ? 'ok' : 'bad')
      onResult(r)
    } catch (x) {
      push(x.status === 401 ? 'Session expired. Sign in again.' : x.message, 'bad')
      setChip('bad')
    } finally {
      setBusy(false)
    }
  }

  const insight = !signedIn
    ? 'Sign in to commit a policy and run live scenarios against your own ledger.'
    : last && last.status === 'rejected'
      ? `Blocked before gas: ${last.reason}`
      : last
        ? `Proof verified. The UserOp settled with ${fmt(last.gas)} gas.`
        : 'Tune your secret cap and allowlist to see how Leash reacts to each attack.'

  const witness = last
    ? { commitment: me.commitment, status: last.status, constraints: last.constraints, proof: last.proof }
    : { commitment: signedIn ? me.commitment : null, status: 'pending' }

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Exposure and risk terminal</h2>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={signedIn ? onOpenPolicy : onSignIn} aria-label="Edit policy"><MoreHorizontal /></Button>
        </div>

        {loading ? (
          <div className="h-12 w-56 animate-pulse rounded-xl bg-secondary" aria-hidden="true" />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="tnum text-4xl font-bold tracking-tight">{signedIn ? usd(spent) : 'n/a'}</p>
            {signedIn && <Badge variant={pillVariant}>{pct}% of cap</Badge>}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {signedIn
            ? <>Rolling 24h spend against a secret cap of <strong className="tnum text-foreground">{usd(cap)}</strong>. The cap, allowlist and salt stay behind the commitment hash.</>
            : 'Your spend limits stay offchain. Only a commitment hash is published.'}
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Scenario">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sc === s.key}
              disabled={busy}
              onClick={() => { setSc(s.key); setChip('idle') }}
              className={cn(
                'h-10 rounded-full px-4 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:opacity-60',
                sc === s.key ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border bg-white text-foreground hover:bg-secondary',
              )}
            >
              {s.key}: {s.title}
            </button>
          ))}
        </div>
        <p className="tnum break-words rounded-xl bg-secondary/70 px-3 py-2 font-mono text-xs leading-relaxed">{scenario.intent}</p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button className="rounded-full px-5" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            {!signedIn ? 'Sign in to run' : busy ? 'Simulating' : 'Run scenario'}
          </Button>
          <Badge variant={Chip.variant} role="status" className="h-8 px-3 text-sm">
            <Chip.icon className={cn('!size-4', chip === 'run' && 'animate-spin')} aria-hidden="true" />
            {Chip.label}
          </Badge>
        </div>

        <div role="log" aria-live="polite" aria-label="Prover log" className="h-40 overflow-auto rounded-xl bg-secondary/70 p-3 font-mono text-xs leading-relaxed">
          {log.map((l, i) => <div key={i} className={cn('break-words', LOG_TONE[l.c])}>{l.t}</div>)}
        </div>

        <button
          type="button"
          onClick={signedIn ? onOpenPolicy : onSignIn}
          className="flex w-full items-center gap-3 rounded-2xl bg-primary/10 p-3.5 text-left text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15" aria-hidden="true"><Sparkles className="size-4" /></span>
          <span className="flex-1 text-sm font-semibold leading-snug">{insight}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </button>

        <details className="group rounded-xl bg-secondary/50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">ZK witness and commitment hash</summary>
          <pre className="tnum mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">{JSON.stringify(witness, null, 2)}</pre>
        </details>
      </CardContent>
    </Card>
  )
}
