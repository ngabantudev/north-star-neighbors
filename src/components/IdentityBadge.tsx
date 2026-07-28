'use client';

import { useState } from 'react';
import { useIdentity } from '@/hooks/useIdentity';
import { getAvatarByLabel } from '@/lib/avatar';
import { NavTab } from '@/components/NavTab';

interface IdentityBadgeProps {
  /** Vertical icon+label tab for the mobile bottom nav, instead of the header pill. */
  compact?: boolean;
}

/**
 * The current browser's own identity. Tapping it opens a profile panel: a
 * full-width bottom sheet on mobile (same slide-up treatment as DropDrawer,
 * so it reads as an app/social surface rather than a webpage), and a small
 * anchored card near the header on desktop (a typical website account-menu
 * position).
 */
export function IdentityBadge({ compact = false }: IdentityBadgeProps) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);

  if (!identity) return null;

  const avatar = getAvatarByLabel(identity.handle);
  if (!avatar) return null;
  const { Icon, color } = avatar;

  return (
    <>
      {compact ? (
        <NavTab
          icon={Icon}
          label="Profile"
          active={open}
          onClick={() => setOpen(true)}
          aria-label={`Your identity: ${identity.handle}`}
        />
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Your identity: ${identity.handle}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 py-1 pr-1 pl-1 shadow-sm transition-transform active:scale-95 sm:pr-3 sm:pl-2.5"
        >
          <span
            className="flex size-7 items-center justify-center rounded-full sm:size-6"
            style={{ backgroundColor: `${color}1a` }}
          >
            <Icon size={16} color={color} strokeWidth={2.25} />
          </span>
          <span className="hidden font-medium sm:inline" style={{ color }}>
            {identity.handle}
          </span>
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-200 bg-white p-5 pb-8 shadow-2xl md:inset-x-auto md:top-16 md:right-4 md:bottom-auto md:w-80 md:rounded-2xl md:border md:pb-5">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${color}1a` }}
                >
                  <Icon size={26} color={color} strokeWidth={2} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{identity.handle}</p>
                  <p className="text-xs text-slate-500">Your identity on this device</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-600">
              This handle comes from a private key stored only in this browser — no account,
              email, or password. Nobody, including us, can trace it back to you.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Clearing your browser data resets it to a brand-new identity.
            </p>
          </div>
        </>
      )}
    </>
  );
}
