import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await sql`
    select photo, photo_content_type
    from drops
    where id = ${id} and expires_at > now() and photo is not null
  `;

  if (rows.length === 0) {
    return new Response(null, { status: 404 });
  }

  const row = rows[0] as { photo: Buffer; photo_content_type: string | null };

  return new Response(new Uint8Array(row.photo), {
    headers: {
      'Content-Type': row.photo_content_type ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
