import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Triggered on a schedule (see vercel.json) to purge pins past their TTL.
// Vercel signs cron requests with this bearer token automatically when
// CRON_SECRET is set as an env var on the project.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const rows = await sql`delete from drops where expires_at < now() returning id`;

  return Response.json({ purged: rows.length });
}
