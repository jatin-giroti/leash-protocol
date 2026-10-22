import { useEffect } from 'react'
import { BarChart3, FileCode2, Folder, KeyRound, LayoutDashboard, Plus, ScrollText, Settings, ShieldAlert, ShieldCheck, User, X } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

const MAIN = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, subtitle: 'Track your exposure, proofs and blocked attempts' },
  { id: 'policy', label: 'Policy', icon: ShieldCheck, subtitle: 'Your committed spend cap and allowlist mode' },
  { id: 'ledger', label: 'Proof ledger', icon: ScrollText, subtitle: 'Every verified and rejected UserOp' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, subtitle: 'Spend and proof trends over time' },
  { id: 'account', label: 'Account', icon: User, subtitle: 'Your owner key and sign-in details' },
]
const RESOURCES = [
  { id: 'spec', label: 'Circuit spec', icon: FileCode2, subtitle: 'Constraints enforced before settlement' },
  { id: 'tokens', label: 'SDK tokens', icon: KeyRound, subtitle: 'Testnet credentials for your agents' },
  { id: 'settings', label: 'Settings', icon: Settings, subtitle: 'Security and preferences' },
]
export const NAV = [...MAIN, ...RESOURCES]

function Item({ item, active, onNavigate, folder }) {
  const Icon = folder ? Folder : item.icon
  const on = active === item.id
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={on ? 'page' : undefined}
      className={cn(
        'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]',
        on ? 'bg-white text-foreground shadow-card' : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
      )}
    >
      <Icon className={cn('size-[18px]', on && !folder ? 'text-primary' : '')} aria-hidden="true" />
      {item.label}
    </button>
  )
}

function Body({ active, onNavigate, frozen, onToggleFreeze, user, onClose }) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onNavigate('overview')} className="flex items-center gap-3 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Leash overview">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-bold text-white shadow-sm">L</span>
          <span className="text-xl font-bold tracking-tight">Leash</span>
        </button>
        {onClose && <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu"><X /></Button>}
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {MAIN.map((it) => <Item key={it.id} item={it} active={active} onNavigate={onNavigate} />)}
      </nav>

      <nav aria-label="Resources" className="flex flex-col gap-1">
        <div className="mb-1 flex items-center justify-between px-3">
          <p className="text-sm font-semibold text-muted-foreground">Resources</p>
          <button type="button" onClick={() => onNavigate('tokens')} aria-label="New SDK token" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        {RESOURCES.map((it) => <Item key={it.id} item={it} active={active} onNavigate={onNavigate} folder />)}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className={cn('rounded-2xl p-4 shadow-card transition-colors', frozen ? 'bg-destructive/10 ring-1 ring-destructive/30' : 'bg-white')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className={cn('mt-0.5 size-[18px]', frozen ? 'text-destructive' : 'text-muted-foreground')} aria-hidden="true" />
              <div>
                <p id="kill-label" className="text-sm font-semibold">Kill switch</p>
                <p className="text-xs text-muted-foreground">{frozen ? 'Frozen. Every UserOp reverts.' : user ? 'Armed. Freeze the treasury instantly.' : 'Sign in to arm the kill switch.'}</p>
              </div>
            </div>
            <Switch tone="danger" checked={!!frozen} onCheckedChange={onToggleFreeze} disabled={!user} aria-labelledby="kill-label" />
          </div>
        </div>
        <div className="flex items-center gap-3 px-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{user ? initials(user.email) : '?'}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{user ? user.email : 'Not signed in'}</p>
            <p className="text-xs text-muted-foreground">{user ? 'Owner key holder' : 'Guest'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ active, onNavigate, open, onClose, ...rest }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const go = (id) => { onNavigate(id); onClose() }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-background lg:block" aria-label="Sidebar">
        <Body active={active} onNavigate={onNavigate} {...rest} />
      </aside>

      <div className={cn('fixed inset-0 z-40 lg:hidden', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
        <div onClick={onClose} className={cn('absolute inset-0 bg-slate-900/40 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')} />
        <aside
          className={cn('absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-background shadow-xl transition-transform duration-200', open ? 'translate-x-0' : '-translate-x-full')}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          aria-label="Mobile sidebar"
        >
          {open && <Body active={active} onNavigate={go} onClose={onClose} {...rest} />}
        </aside>
      </div>
    </>
  )
}
