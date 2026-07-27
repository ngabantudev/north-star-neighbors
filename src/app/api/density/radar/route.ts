import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

function positiveNumber(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cellSize = positiveNumber(url.searchParams.get('cellSize'), 0.02);
  const windowHours = positiveNumber(url.searchParams.get('windowHours'), 12);

  const result = await sql`
    select category_radar_geojson(${cellSize}, ${windowHours}) as geojson
  `;
  const geojson = (result[0] as { geojson: unknown }).geojson;

  return Response.json(geojson);
}
