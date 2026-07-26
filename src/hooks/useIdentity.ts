'use client';

import { useEffect, useState } from 'react';
import { deriveAvatar } from '@/lib/avatar';
import { registerIdentity } from '@/app/actions';

const IDENTITY_KEY = 'nsn_identity';
const DEVICE_KEY = 'nsn_device';

export interface Identity {
  handle: string;
  token: string;
  deviceId: string;
}

function randomId(): string {
  return crypto.randomUUID();
}

/**
 * Pseudonymous, zero-PII identity persisted in localStorage. `token` is the
 * cryptographic credential that both proves ownership of pins this browser
 * creates/claims and keys the aggregate reputation row. `deviceId` is a
 * separate, unrelated random value used only for rate limiting and flag
 * dedupe — not derived from any real device/browser fingerprinting.
 */
export function useIdentity(): Identity | null {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(IDENTITY_KEY);
    let parsed: { handle: string; token: string };
    if (stored) {
      parsed = JSON.parse(stored);
    } else {
      // Handle is derived from the token (not generated separately), so the
      // displayed avatar/label always matches the identity that owns it.
      const token = randomId();
      parsed = { handle: deriveAvatar(token).label, token };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(parsed));
      registerIdentity(parsed.handle, parsed.token);
    }

    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
      deviceId = randomId();
      localStorage.setItem(DEVICE_KEY, deviceId);
    }

    // localStorage isn't available during SSR, so hydrating this from an
    // effect (rather than a useState initializer) is the correct pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentity({ handle: parsed.handle, token: parsed.token, deviceId });
  }, []);

  return identity;
}
