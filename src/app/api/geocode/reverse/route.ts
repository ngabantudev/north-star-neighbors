export const dynamic = 'force-dynamic';

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
}

// Server-side proxy to OSM's free Nominatim reverse-geocoder — no API key,
// no Google. Proxying (rather than calling from the browser) lets us set the
// User-Agent Nominatim's usage policy requires and keeps that policy's
// rate limit centralized to our own server instead of every client.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: 'lat and lng query params are required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { 'User-Agent': 'north-star-neighbors (mutual aid map, contact via project repo)' } },
    );
    if (!res.ok) return Response.json({ label: null });

    const data: { display_name?: string; address?: NominatimAddress } = await res.json();
    const addr = data.address ?? {};
    const place = addr.neighbourhood ?? addr.suburb ?? addr.city ?? addr.town ?? addr.village;
    const label = addr.road && place ? `${addr.road}, ${place}` : (addr.road ?? data.display_name ?? null);

    return Response.json({ label });
  } catch {
    return Response.json({ label: null });
  }
}
