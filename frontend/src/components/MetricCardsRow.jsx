import { ArrowDownRight, ArrowUpRight, Ban, BadgeCheck, Fuel, Gauge, Minus, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, fmt, usd } from '@/lib/utils'

const DAY = 864e5

function Trend({ tone, icon: Icon, text, caption }) {
  const color = { up: 'text-emerald-700', warn: 'text-amber-800', down: 'text-rose-700', flat: 'text-muted-foreground' }[tone]
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-sm">
      <span className={cn('flex items-center gap-1 font-semibold tnum', color)}><Icon className="size-3.5" aria-hidden="true" />{text}</span>
      <span className="text-muted-foreground">{caption}</span>
    </p>
  )
}

function MetricCard({ title, sub, icon: Icon, tint, value, loading, children }) {
  return (
    <Card className="min-w-[250px] flex-1 shrink-0 snap-start">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', tint)} aria-hidden="true"><Icon className="size-5" /></span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-bold">{title}</p>
            <p className="truncate text-sm text-muted-foreground">{sub}</p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-8 w-36 animate-pulse rounded-lg bg-secondary" />
            <div className="h-4 w-28 animate-pulse rounded-full bg-secondary" />
          </div>
        ) : (
          <>
            <p className="tnum text-[28px] font-bold leading-none tracking-tight">{value}</p>
            {children}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function MetricCardsRow({ me, trades, loading }) {
  const signedIn = !!(me && me.user)
  const real = (trades || []).filter((t) => t.scenario !== 'seed')
  const recent = real.filter((t) => Date.now() - new Date(t.created_at).getTime() < DAY)
  const verified = real.filter((t) => t.status === 'verified')
  const blocked = real.filter((t) => t.status === 'rejected')
  const verified24 = recent.filter((t) => t.status === 'verified').length
  const blocked24 = recent.filter((t) => t.status === 'rejected').length
  const avgGas = verified.length ? Math.round(verified.reduce((s, t) => s + (t.gas || 0), 0) / verified.length) : 0

  const cap = signedIn ? me.policy.cap : 0
  const spent = signedIn ? me.spent24h : 0
  const frozen = signedIn && me.policy.frozen
  const pct = cap ? Math.min(100, Math.round((spent / cap) * 100)) : 0
  const spendTone = pct >= 100 ? 'down' : pct >= 80 ? 'warn' : 'up'
  const guest = <Trend tone="flat" icon={Minus} text="Sign in" caption="to load this metric" />
  const na = 'n/a'

  return (
    <section aria-label="Key metrics" className="hscroll flex snap-x gap-4 overflow-x-auto pb-3">
      <MetricCard title="24h spend" sub="Rolling window" icon={Gauge} tint="bg-primary/10 text-primary" loading={loading} value={signedIn ? usd(spent) : na}>
        {signedIn ? <Trend tone={spendTone} icon={pct >= 80 ? ArrowUpRight : ArrowDownRight} text={`${pct}%`} caption={`of ${usd(cap)} cap`} /> : guest}
      </MetricCard>

      <MetricCard title="Proofs" sub="Verified onchain" icon={BadgeCheck} tint="bg-success/10 text-emerald-700" loading={loading} value={signedIn ? fmt(verified.length) : na}>
        {signedIn ? <Trend tone={verified24 ? 'up' : 'flat'} icon={verified24 ? ArrowUpRight : Minus} text={`${verified24}`} caption="in the last 24h" /> : guest}
      </MetricCard>

      <MetricCard title="Blocked" sub="Rejected before gas" icon={Ban} tint="bg-destructive/10 text-rose-700" loading={loading} value={signedIn ? fmt(blocked.length) : na}>
        {signedIn ? <Trend tone={blocked24 ? 'down' : 'flat'} icon={blocked24 ? ArrowUpRight : Minus} text={`${blocked24}`} caption="in the last 24h" /> : guest}
      </MetricCard>

      <MetricCard title="Verifier gas" sub="Groth16 average" icon={Fuel} tint="bg-warning/15 text-amber-800" loading={loading} value={signedIn ? fmt(avgGas) : na}>
        {signedIn ? <Trend tone="flat" icon={Minus} text="gas" caption="per verified UserOp" /> : guest}
      </MetricCard>

      <MetricCard title="Treasury" sub="Kill switch" icon={ShieldCheck} tint={frozen ? 'bg-destructive/10 text-rose-700' : 'bg-primary/10 text-primary'} loading={loading} value={signedIn ? (frozen ? 'Frozen' : 'Active') : na}>
        {signedIn ? <Trend tone={frozen ? 'down' : 'up'} icon={frozen ? ArrowDownRight : ArrowUpRight} text={frozen ? 'Halted' : 'Armed'} caption={frozen ? 'every UserOp reverts' : 'owner key only'} /> : guest}
      </MetricCard>
    </section>
  )
}
