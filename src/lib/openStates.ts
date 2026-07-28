/**
 * Thin server-only client for the Open States v3 API (open.pluralpolicy.com).
 *
 * The key is read per-call rather than captured at module load so a missing
 * key is a runtime "unlinked" state the UI can explain, not a build-time crash
 * — the campaign banner has to render for every visitor whether or not this
 * deployment has an API key.
 */
const BASE = 'https://v3.openstates.org';

export interface OpenStatesBill {
  identifier?: string;
  title?: string;
  session?: string;
  openstates_url?: string;
  latest_action_description?: string;
  latest_action_date?: string;
}

export interface OpenStatesPerson {
  id?: string;
  name?: string;
  party?: string;
  /** Not always an address — Open States stores a contact-form URL here for
   *  many members (most federal ones). Callers must validate before mailto:. */
  email?: string;
  openstates_url?: string;
  jurisdiction?: { id?: string; name?: string; classification?: string };
  current_role?: {
    title?: string;
    org_classification?: string;
    district?: string | number;
  };
}

interface PeopleGeoResponse {
  results?: OpenStatesPerson[];
}

export function openStatesKey(): string | null {
  return process.env.OPENSTATES_API_KEY?.trim() || null;
}

async function get<T>(path: string, params: Record<string, string>, revalidate: number): Promise<T | null> {
  const key = openStatesKey();
  if (!key) return null;

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // Key goes in the header, never the query string — query params end up in
  // access logs and in Next's cache key surface area.
  const res = await fetch(url, {
    headers: { 'X-API-KEY': key, Accept: 'application/json' },
    next: { revalidate },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/**
 * Look up one bill by its chamber identifier. Returns null when the key is
 * missing, the session identifier doesn't exist, or Open States is down —
 * callers must treat null as "status unknown", not as "bill dead".
 */
export async function fetchBill(jurisdiction: string, session: string, billId: string, revalidate: number) {
  return get<OpenStatesBill>(
    `/bills/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(session)}/${encodeURIComponent(billId)}`,
    {},
    revalidate,
  );
}

/** Legislators whose districts contain the given point. */
export async function fetchLegislatorsByPoint(lat: number, lng: number, revalidate: number) {
  const data = await get<PeopleGeoResponse>('/people.geo', { lat: String(lat), lng: String(lng) }, revalidate);
  return data?.results ?? null;
}
