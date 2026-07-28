'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface NavTabProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  /** Small red dot, e.g. for an active alert. */
  badge?: boolean;
  href?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

/**
 * One tab in the mobile bottom nav: icon over a tiny label, consistent
 * across the plain-link tabs (Map, My Drops) and the sheet-opening ones
 * (Weather, Profile). Renders as a Link when `href` is given, otherwise a button.
 */
export function NavTab({ icon: Icon, label, active, badge, href, onClick, ...rest }: NavTabProps) {
  const className = `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
    active ? 'text-mn-blue' : 'text-slate-500'
  }`;

  const content = (
    <>
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </span>
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} {...rest}>
      {content}
    </button>
  );
}
