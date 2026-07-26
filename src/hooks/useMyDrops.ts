'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MyDropRecord } from '@/components/DropDrawer';

const KEY = 'nsn_my_drops';

function read(): MyDropRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function write(records: MyDropRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

/** Locally-held proof of which pins this browser created or claimed. */
export function useMyDrops() {
  const [records, setRecords] = useState<MyDropRecord[]>([]);

  useEffect(() => {
    // localStorage isn't available during SSR, so hydrating this from an
    // effect (rather than a useState initializer) is the correct pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecords(read());
  }, []);

  const add = useCallback((record: MyDropRecord) => {
    setRecords((prev) => {
      const next = [...prev.filter((r) => r.dropId !== record.dropId), record];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((dropId: string) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.dropId !== dropId);
      write(next);
      return next;
    });
  }, []);

  const byId = useCallback((dropId: string) => records.find((r) => r.dropId === dropId) ?? null, [records]);

  return { records, add, remove, byId };
}
