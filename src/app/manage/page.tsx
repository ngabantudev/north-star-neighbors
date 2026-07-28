'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useIdentity } from '@/hooks/useIdentity';
import { useMyDrops } from '@/hooks/useMyDrops';
import { cancelDrop } from '@/app/actions';
import { DROP_CATEGORY_LABELS, type DropSummary } from '@/lib/types';

export default function ManagePage() {
  const identity = useIdentity();
  const { records, remove } = useMyDrops();
  const [details, setDetails] = useState<Record<string, DropSummary | 'gone'>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries = await Promise.all(
        records.map(async (r) => {
          const res = await fetch(`/api/drops/${r.dropId}`);
          if (!res.ok) return [r.dropId, 'gone' as const] as const;
          const data: { drop: DropSummary } = await res.json();
          return [r.dropId, data.drop] as const;
        }),
      );
      if (!cancelled) setDetails(Object.fromEntries(entries));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [records]);

  async function handleCancel(dropId: string, token: string) {
    if (!identity) return;
    const result = await cancelDrop({ dropId, token, deviceHash: identity.deviceId });
    if (result.ok) remove(dropId);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-6">
      <h1 className="mb-1 text-xl font-semibold text-mn-blue">My drops</h1>
      <p className="mb-6 text-sm text-slate-500">
        Only this browser can manage these — the ownership token never leaves your device.
      </p>

      {records.length === 0 && (
        <p className="text-slate-400">
          Nothing here yet.{' '}
          <Link href="/?drop=1" className="text-mn-sky underline">
            Add Drop
          </Link>{' '}
          or claim a pickup from the map.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {records.map((r) => {
          const detail = details[r.dropId];
          if (!detail) return null;
          if (detail === 'gone') {
            return (
              <li key={r.dropId} className="rounded-lg border border-slate-200 p-4 text-slate-400">
                This pickup was completed, expired, or removed.
              </li>
            );
          }
          return (
            <li key={r.dropId} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-900">{detail.anchorName}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{detail.status}</span>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                {r.role === 'provider' ? 'You are providing' : 'You claimed this'} ·{' '}
                {detail.categories.map((c) => DROP_CATEGORY_LABELS[c]).join(', ')}
              </p>
              <button
                onClick={() => handleCancel(r.dropId, r.token)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600"
              >
                Cancel &amp; Alert
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
