import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

function positiveNumber(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cellSize = positiveNumber(url.searchParams.get('cellSize'), 0.01);
  const demandWindowHours = positiveNumber(url.searchParams.get('demandWindowHours'), 4);

  const result = await sql`
    select grid_density_geojson(${cellSize}, ${demandWindowHours}) as geojson
  `;
  const geojson = (result[0] as { geojson: unknown }).geojson;

  return Response.json(geojson);
}