import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawHours = Number(url.searchParams.get('demandWindowHours'));
  const demandWindowHours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 4;

  const result = await sql`
    select anchor_density_geojson(${demandWindowHours}) as geojson
  `;
  const geojson = (result[0] as { geojson: unknown }).geojson;

  return Response.json(geojson);
}