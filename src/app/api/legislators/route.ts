import { DEFAULT_LAT, DEFAULT_LNG, coerceCoord } from '@/lib/coords';
import {
  LEGISLATOR_REVALIDATE_SECONDS,
  MN_STATE_JURISDICTION_ID,
  isMailAddress,
  type Chamber,
  type LegislatorView,
  type LegislatorsPayload,
} from '@/lib/legislation';
import { fetchLegislatorsByPoint, openStatesKey, type OpenStatesPerson } from '@/lib/openStates';

// Districts are large, so ~1km rounding is plenty of precision and collapses
// every household on a block onto one cached upstream call. It also means we
// never forward a resident's exact coordinates to a third-party API — the
// same privacy posture the drop map takes with pin locations.
const COORD_PRECISION = 2;

function toView(person: OpenStatesPerson): LegislatorView | null {
  // people.geo returns the US Congressional delegation for the same point,
  // and Congress uses the same upper/lower classification as the legislature
  // — so the chamber alone can't tell them apart. Filtering on the state
  // jurisdiction is what keeps a campaign aimed at St. Paul from emailing a
  // US Senator about a state moratorium bill.
  if (person.jurisdiction?.id !== MN_STATE_JURISDICTION_ID) return null;

  const chamber = person.current_role?.org_classification;
  if (chamber !== 'upper' && chamber !== 'lower') return null;
  if (!person.id || !person.name) return null;

  const district = person.current_role?.district;
  // Read once and branch on the raw value: narrowing off `isMailAddress` in
  // the negative case collapses the type to `null`, which would hide the very
  // contact-form URL we're trying to keep.
  const contact = person.email?.trim() || '';
  const contactUrl = !isMailAddress(contact) && contact.startsWith('http') ? contact : null;

  return {
    id: person.id,
    name: person.name,
    party: person.party ?? null,
    chamber: chamber as Chamber,
    title: person.current_role?.title ?? (chamber === 'upper' ? 'Senator' : 'Representative'),
    district: district === undefined || district === '' ? null : String(district),
    email: isMailAddress(contact) ? contact : null,
    contactUrl,
    url: person.openstates_url ?? null,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = coerceCoord(url.searchParams.get('lat'), DEFAULT_LAT, COORD_PRECISION);
  const lng = coerceCoord(url.searchParams.get('lng'), DEFAULT_LNG, COORD_PRECISION);

  if (!openStatesKey()) {
    return Response.json({ legislators: [], source: 'unlinked' } satisfies LegislatorsPayload);
  }

  const people = await fetchLegislatorsByPoint(lat, lng, LEGISLATOR_REVALIDATE_SECONDS).catch(() => null);
  if (!people) {
    return Response.json({ legislators: [], source: 'degraded' } satisfies LegislatorsPayload);
  }

  const legislators = people
    .map(toView)
    .filter((l): l is LegislatorView => l !== null)
    // Senate first, then House — matches how MN legislators are addressed.
    .sort((a, b) => (a.chamber === b.chamber ? 0 : a.chamber === 'upper' ? -1 : 1));

  return Response.json({ legislators, source: 'live' } satisfies LegislatorsPayload);
}
