import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn, usd } from '@/lib/utils'

export default function PolicyModal({ open, onClose, me, onSave, onFreeze, onReset }) {
  const ref = useRef(null)
  const [cap, setCap] = useState(10000)
  const [strict, setStrict] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (me && me.policy) { setCap(me.policy.cap); setStrict(me.policy.strict) }
      setErr('')
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault()
    setErr('')
    const n = Number(cap)
    if (!Number.isInteger(n) || n < 1000 || n > 1000000) return setErr('Cap must be a whole number between 1,000 and 1,000,000 USDC.')
    setBusy(true)
    try {
      await onSave({ cap: n, strict })
      onClose()
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const frozen = !!(me && me.policy && me.policy.frozen)

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      aria-labelledby="policy-title"
      className="w-[min(480px,calc(100vw-32px))] rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/40"
    >
      <form onSubmit={save} noValidate className="grid gap-5 p-6">
        <div>
          <h2 id="policy-title" className="text-xl font-bold tracking-tight">Edit policy</h2>
          <p className="text-sm text-muted-foreground">Changes update your commitment hash. Limits stay private.</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="policy-cap" className="text-sm font-semibold">Secret 24h spend cap (USDC)</label>
          <Input id="policy-cap" type="number" inputMode="numeric" min={1000} max={1000000} step={500} value={cap} onChange={(e) => setCap(e.target.value)} aria-invalid={!!err} className="tnum" />
          <input type="range" aria-label="Spend cap slider" min={1000} max={50000} step={500} value={Math.min(Math.max(Number(cap) || 1000, 1000), 50000)} onChange={(e) => setCap(Number(e.target.value))} className="h-8 w-full accent-[#635BFF]" />
          <p className="tnum text-xs text-muted-foreground">Current value {usd(Number(cap) || 0)}</p>
        </div>

        <div className="grid gap-2">
          <span id="policy-mode" className="text-sm font-semibold">Merkle allowlist strictness</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1" role="group" aria-labelledby="policy-mode">
            {[[true, 'Strict'], [false, 'Class based']].map(([v, label]) => (
              <button key={label} type="button" aria-pressed={strict === v} onClick={() => setStrict(v)}
                className={cn('h-9 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', strict === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{strict ? 'The target must be a leaf in the hidden Merkle allowlist.' : 'Any verified router contract passes. Wallet addresses are still blocked.'}</p>
        </div>

        <div className={cn('flex items-center justify-between gap-3 rounded-xl p-3', frozen ? 'bg-destructive/10' : 'bg-secondary/70')}>
          <div className="flex items-start gap-2.5">
            <ShieldAlert className={cn('mt-0.5 size-4', frozen ? 'text-destructive' : 'text-muted-foreground')} aria-hidden="true" />
            <div>
              <p id="policy-kill" className="text-sm font-semibold">Owner kill switch</p>
              <p className="text-xs text-muted-foreground">{frozen ? 'Frozen. Every UserOp reverts.' : 'Armed. Freeze the treasury instantly.'}</p>
            </div>
          </div>
          <Switch tone="danger" checked={frozen} onCheckedChange={onFreeze} aria-labelledby="policy-kill" />
        </div>

        <button type="button" onClick={onReset} className="inline-flex w-fit items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RotateCcw className="size-4" aria-hidden="true" />Reset accumulator to $1,500.00
        </button>

        {err && <p role="alert" className="text-sm font-medium text-rose-700">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="rounded-full" disabled={busy}>{busy ? 'Saving' : 'Save policy'}</Button>
        </div>
      </form>
    </dialog>
  )
}
