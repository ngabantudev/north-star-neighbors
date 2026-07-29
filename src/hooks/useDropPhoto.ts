'use client';

import { useEffect, useState } from 'react';
import { fetchDropPhotoUrl } from '@/lib/dropClient';

/**
 * Object URL for a drop's photo, fetched with the ownership token when we hold
 * one — a claimed pin's photo is token-gated server-side, and an `<img src>`
 * can't carry the header. Revokes on unmount so blobs don't accumulate as the
 * drawer moves between pins.
 */
export function useDropPhoto(dropId: string, hasPhoto: boolean, token: string | null): string | null {
  // Tagged with the drop it belongs to, so switching pins renders nothing
  // rather than briefly showing the previous pin's photo under the new one.
  const [loaded, setLoaded] = useState<{ dropId: string; url: string } | null>(null);

  useEffect(() => {
    if (!hasPhoto) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    fetchDropPhotoUrl(dropId, token).then((next) => {
      if (!next) return;
      if (cancelled) {
        URL.revokeObjectURL(next);
        return;
      }
      objectUrl = next;
      setLoaded({ dropId, url: next });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dropId, hasPhoto, token]);

  return hasPhoto && loaded?.dropId === dropId ? loaded.url : null;
}
