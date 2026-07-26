import { randomBytes, createHash } from 'node:crypto';

/** A raw, high-entropy token to hand to the client. Never stored raw server-side. */
export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
