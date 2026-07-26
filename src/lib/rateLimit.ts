import { sql } from '@/lib/db';

const LIMITS: Record<string, { max: number; windowSeconds: number }> = {
  create_drop: { max: 5, windowSeconds: 600 },
  claim_drop: { max: 10, windowSeconds: 600 },
  flag_drop: { max: 20, windowSeconds: 600 },
  complete_drop: { max: 20, windowSeconds: 600 },
};

/**
 * Rolling-window check keyed by a client-held device hash. Logs the attempt
 * regardless of outcome so repeated slamming keeps tightening the window.
 */
export async function checkRateLimit(actorHash: string, action: keyof typeof LIMITS): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[action];

  const rows = await sql`
    select count(*)::int as count
    from request_log
    where actor_hash = ${actorHash}
      and action = ${action}
      and created_at > now() - make_interval(secs => ${windowSeconds})
  `;
  const count = (rows[0] as { count: number }).count;

  await sql`insert into request_log (actor_hash, action) values (${actorHash}, ${action})`;

  return count < max;
}
