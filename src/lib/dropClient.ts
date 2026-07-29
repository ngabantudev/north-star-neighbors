'use client';

import { DROP_TOKEN_HEADER, type DropSummary } from '@/lib/types';

/**
 * Browser-side reads of a single drop. The ownership token travels in a header
 * rather than the URL so it never reaches an access log, browser history, or a
 * `Referer` — the same reason the server only accepts it there.
 */
function authHeaders(token: string | null | undefined): HeadersInit | undefined {
  return token ? { [DROP_TOKEN_HEADER]: token } : undefined;
}

/** The drop, or null if it's gone (completed/expired/removed) or not ours to read. */
export async function fetchDrop(dropId: string, token?: string | null): Promise<DropSummary | null> {
  const res = await fetch(`/api/drops/${dropId}`, { headers: authHeaders(token), cache: 'no-store' });
  if (!res.ok) return null;
  const data: { drop: DropSummary } = await res.json();
  return data.drop;
}

/**
 * The photo as an object URL. Goes through fetch (not a plain `<img src>`)
 * because a claimed pin's photo is token-gated and an img element can't send
 * the header. Callers must revokeObjectURL when done.
 */
export async function fetchDropPhotoUrl(dropId: string, token?: string | null): Promise<string | null> {
  const res = await fetch(`/api/drops/${dropId}/photo`, { headers: authHeaders(token), cache: 'no-store' });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}
