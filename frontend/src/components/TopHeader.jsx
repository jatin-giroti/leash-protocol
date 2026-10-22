import { Bell, Globe, LogOut, Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/utils'

export default function TopHeader({ title, subtitle, user, frozen, onMenu, onSignIn, onSignOut }) {
  return (
    <header className="sticky top-0 z-20 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Button variant="outline" size="icon" className="rounded-full border-0 bg-white shadow-card lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu /></Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="relative hidden w-72 md:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input aria-label="Search trades, hashes and tokens" placeholder="Search trades or hashes" className="h-11 rounded-full border-0 bg-white pl-10 shadow-card" />
        </div>

        <Badge variant={frozen ? 'danger' : 'muted'} className="hidden h-8 bg-white px-3 shadow-card xl:inline-flex">
          <Globe aria-hidden="true" />
          {frozen ? 'Frozen' : 'Ethereum Sepolia'}
        </Badge>

        <Button variant="outline" size="icon" className="h-11 w-11 rounded-full border-0 bg-white shadow-card" aria-label="Notifications"><Bell /></Button>

        {user ? (
          <div className="flex items-center gap-1">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-sm font-bold text-white" aria-label={`Signed in as ${user.email}`} role="img">{initials(user.email)}</span>
            <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sign out" className="rounded-full"><LogOut /></Button>
          </div>
        ) : (
          <Button onClick={onSignIn} className="h-11 rounded-full px-5">Sign in</Button>
        )}
      </div>
    </header>
  )
}
