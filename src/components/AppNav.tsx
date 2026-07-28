'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Plus } from 'lucide-react';
import { NavTab } from '@/components/NavTab';
import { WeatherToggle } from '@/components/WeatherToggle';
import { IdentityBadge } from '@/components/IdentityBadge';
import { useWeatherLayer } from '@/components/WeatherLayerProvider';

/**
 * App-wide navigation, split by viewport rather than by page:
 *  - md and up: the existing horizontal header row (Add Drop / My Drops /
 *    Ledger / Weather / Identity), unchanged in spirit from before this
 *    component existed.
 *  - below md: a fixed bottom tab bar (Map / My Drops / Add Drop / Weather /
 *    Profile) in the style of a native mobile app, with Add Drop as a raised
 *    center FAB. The public ledger is deliberately not a sixth tab — five is
 *    already the limit for thumb-sized targets, and the "Live ledger" chip on
 *    the activity notification overlay links straight to it.
 * Both variants read the same WeatherLayerProvider context, so switching
 * viewport size (or simply having both mounted, one hidden via CSS) never
 * doubles the poll, and toggling Weather from either variant flips the same
 * map overlay shown on the home page.
 */
export function AppNav() {
  const pathname = usePathname();
  const { current, active, toggle } = useWeatherLayer();

  return (
    <>
      <nav className="hidden shrink-0 items-center gap-3 text-sm font-medium text-white/85 sm:gap-4 md:flex">
        <Link href="/?drop=1" className="hover:text-mn-green transition-colors">
          Add Drop
        </Link>
        <Link href="/manage" className="hover:text-mn-green transition-colors">
          My Drops
        </Link>
        <Link href="/ledger" className="hover:text-mn-green transition-colors">
          Activity
        </Link>
        <WeatherToggle weather={current} active={active} onToggle={toggle} />
        <IdentityBadge />
      </nav>

      {/* z-20: stays below DropDrawer/IdentityBadge sheets (z-30+), which must always be able to cover it. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_6px_rgba(0,0,0,0.08)] md:hidden">
        <NavTab icon={Home} label="Map" href="/" active={pathname === '/'} />
        <NavTab icon={Package} label="My Drops" href="/manage" active={pathname === '/manage'} />
        <Link href="/?drop=1" aria-label="Add Drop" className="relative flex flex-1 flex-col items-center justify-center">
          <span className="absolute -top-5 flex size-14 items-center justify-center rounded-full bg-mn-blue text-white shadow-lg ring-4 ring-white transition-transform active:scale-95">
            <Plus size={26} strokeWidth={2.5} />
          </span>
        </Link>
        <WeatherToggle weather={current} active={active} onToggle={toggle} compact />
        <IdentityBadge compact />
      </nav>
    </>
  );
}
