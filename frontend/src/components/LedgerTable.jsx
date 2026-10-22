import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, fmt, fmtTime, usd, SCENARIOS } from '@/lib/utils'

const TONE = {
  success: 'bg-success/10 text-emerald-700', danger: 'bg-destructive/10 text-rose-700',
  warning: 'bg-warning/15 text-amber-800', seed: 'bg-primary/10 text-primary',
}
const FILTERS = [['all', 'All'], ['verified', 'Verified'], ['rejected', 'Blocked']]
const COLS = [
  ['name', 'Scenario'], ['time', 'Date'], ['amount', 'Volume'], ['status', 'Change'], ['gas', 'Verifier gas'],
]
const PAGE = 8

function meta(t) {
  if (t.scenario === 'seed') return { letter: 'S', title: 'Opening balance', tone: 'seed' }
  const s = SCENARIOS.find((x) => x.key === t.scenario)
  return { letter: t.scenario, title: s ? s.title : t.scenario, tone: s ? s.tone : 'seed' }
}

export default function LedgerTable({ trades, signedIn, loading, onSignIn }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'time', dir: 'desc' })
  const [all, setAll] = useState(false)
  const [checks, setChecks] = useState({})
  const [err, setErr] = useState('')

  const rows = useMemo(() => {
    const list = (trades || []).filter((t) => filter === 'all' || t.status === filter)
    const val = { name: (t) => meta(t).title, time: (t) => new Date(t.created_at).getTime(), amount: (t) => t.amount_usdc, status: (t) => t.status, gas: (t) => t.gas }[sort.key]
    return [...list].sort((a, b) => {
      const A = val(a), B = val(b)
      return (A < B ? -1 : A > B ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1)
    })
  }, [trades, filter, sort])

  const shown = all ? rows : rows.slice(0, PAGE)
  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  async function verify(id) {
    setErr(''); setChecks((c) => ({ ...c, [id]: 'busy' }))
    try {
      const d = await api.verify(id)
      setChecks((c) => ({ ...c, [id]: d.valid ? 'valid' : 'invalid' }))
    } catch (e) {
      setChecks((c) => { const n = { ...c }; delete n[id]; return n })
      setErr(e.message)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-3">
        <div>
          <h2 className="text-base font-bold">Proof ledger</h2>
          <p className="text-sm text-muted-foreground">Every UserOp your agents attempted, with its proof status</p>
        </div>
        <div className="flex gap-1 rounded-full bg-secondary p-1" role="group" aria-label="Filter ledger">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => { setFilter(k); setAll(false) }}
              className={cn('h-8 rounded-full px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
          ))}
        </div>
      </div>

      {err && <p role="alert" className="px-6 pb-2 text-sm font-medium text-rose-700">{err}</p>}

      {!signedIn ? (
        <div className="flex flex-col items-start gap-3 px-6 pb-6">
          <p className="text-sm text-muted-foreground">Sign in to see your verified and blocked UserOps.</p>
          <Button className="rounded-full" onClick={onSignIn}>Sign in</Button>
        </div>
      ) : loading || trades === null ? (
        <div className="space-y-3 px-6 pb-6" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary" />)}</div>
      ) : rows.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing here yet. Run a scenario in the risk terminal to create your first entry.</p>
      ) : (
        <>
          <div className="overflow-x-auto px-3 pb-2" tabIndex={0} role="region" aria-label="Proof ledger table">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {COLS.map(([k, label]) => (
                    <th key={k} scope="col" className="px-3 py-3 font-semibold" aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {label}
                        {sort.key === k ? (sort.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-60" />}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-3 font-semibold">Proof</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const m = meta(t), isSeed = t.scenario === 'seed', state = checks[t.id]
                  return (
                    <tr key={t.id} className="border-t border-border/70 align-middle">
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold', TONE[m.tone])} aria-hidden="true">{m.letter}</span>
                          <div className="min-w-0 max-w-[280px]">
                            <p className="font-bold">{m.title}</p>
                            <p className="truncate text-xs text-muted-foreground" title={t.reason || t.intent}>{t.reason || t.intent}</p>
                          </div>
                        </div>
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-3.5 text-muted-foreground">{fmtTime(t.created_at)}</td>
                      <td className="tnum px-3 py-3.5 font-semibold">{usd(t.amount_usdc)}</td>
                      <td className="px-3 py-3.5">
                        {isSeed ? <Badge variant="muted">Seeded</Badge>
                          : t.status === 'verified' ? <Badge variant="success"><ArrowUp aria-hidden="true" />Verified</Badge>
                          : <Badge variant="danger"><ArrowDown aria-hidden="true" />Blocked</Badge>}
                      </td>
                      <td className="tnum px-3 py-3.5 font-semibold">{t.gas ? fmt(t.gas) : '0'}</td>
                      <td className="px-3 py-3.5">
                        {t.status !== 'verified' || isSeed ? <span className="text-muted-foreground">None</span>
                          : state === 'valid' ? <Badge variant="success">Proof valid</Badge>
                          : state === 'invalid' ? <Badge variant="danger">Proof invalid</Badge>
                          : <Button variant="outline" size="sm" className="rounded-full" disabled={state === 'busy'} onClick={() => verify(t.id)}>
                              {state === 'busy' && <Loader2 className="animate-spin" />}Verify
                            </Button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > PAGE && (
            <div className="flex justify-center p-4 pt-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
