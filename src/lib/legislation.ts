/**
 * Statewide campaign configuration: the bills we're tracking in St. Paul and
 * the PUC proceedings we're asking neighbors to comment on.
 *
 * The *demands* live here as hand-written config, because "what we're fighting
 * for" is an editorial decision, not something an API knows. The *status* of
 * each bill is fetched live from Open States (see `/api/legislation`) so the
 * banner never claims a bill is moving when it died in committee months ago.
 * When the API is unavailable the bill still renders — with its status shown
 * as unknown rather than as a stale guess.
 */

/** Open States accepts either the OCD id or the plain state name in the bill
 *  path; the name avoids embedding encoded slashes in a path segment. */
export const MN_JURISDICTION = 'Minnesota';

/** The MN *state* government, as distinct from the US Congress — `people.geo`
 *  returns both for any point, and only the former legislates in St. Paul. */
export const MN_STATE_JURISDICTION_ID = 'ocd-jurisdiction/country:us/state:mn/government';

/** Open States free tier is ~10 req/min, 250/day. Six hours of staleness on a
 *  bill status costs nothing; blowing the daily quota costs everything. */
export const LEGISLATION_REVALIDATE_SECONDS = 6 * 60 * 60;

/** Legislator lookup by point changes only when districts are redrawn. */
export const LEGISLATOR_REVALIDATE_SECONDS = 24 * 60 * 60;

export interface TrackedBill {
  /** Bill identifier as Open States spells it, e.g. "HF 4888". */
  identifier: string;
  /** Open States session identifier, e.g. "2023-2024". */
  session: string;
  /** Our own one-line framing — why this bill is on the map. */
  demand: string;
}

/**
 * Bills the campaign is actively tracking. `session` must match the Open
 * States session identifier exactly or the lookup 404s and the bill degrades
 * to "status unavailable" — verify against
 * https://v3.openstates.org/jurisdictions/Minnesota before adding one.
 */
export const TRACKED_BILLS: TrackedBill[] = [
  {
    identifier: 'HF 4888',
    session: '2025-2026',
    demand: 'Moratorium on new data centers until the PUC reports back on what they cost the grid and ratepayers.',
  },
  {
    identifier: 'SF 4298',
    session: '2025-2026',
    demand: 'Senate companion to HF 4888 — same moratorium and PUC report, moving through Energy, Utilities, Environment, and Climate.',
  },
  {
    identifier: 'HF 4512',
    session: '2025-2026',
    demand: 'PUC transparency: require public hearings and disclosure before any data center development is approved.',
  },
];

/**
 * Live MN PUC proceedings where public comment is open to anyone, no party
 * status required. Docket numbers are the PUC's own year-number format.
 */
export interface PucDocket {
  docket: string;
  title: string;
  /** What a neighbor's comment actually bears on. */
  ask: string;
}

export const PUC_DOCKETS: PucDocket[] = [
  {
    docket: '26-126',
    title: 'Minnesota Power — data center tariff and very-large-customer class',
    ask: 'Demand that data center load pays its own way, with cost-of-service and water disclosure in the record.',
  },
];

/** Where public comments are actually filed. */
export const PUC_COMMENT_URL = 'https://mn.gov/puc/get-involved/public-comments/';
export const PUC_EDOCKETS_URL = 'https://www.edockets.state.mn.us/EFiling/';

export type BillStatus =
  | { known: true; latestAction: string; latestActionDate: string | null; title: string; url: string | null }
  | { known: false };

export interface TrackedBillView extends TrackedBill {
  status: BillStatus;
}

export interface LegislationPayload {
  bills: TrackedBillView[];
  dockets: PucDocket[];
  /** 'live' when statuses came from Open States, 'unlinked' when no API key
   *  is configured, 'degraded' when the upstream call failed. */
  source: 'live' | 'unlinked' | 'degraded';
}

export type Chamber = 'upper' | 'lower';

export interface LegislatorView {
  id: string;
  name: string;
  party: string | null;
  chamber: Chamber;
  /** "Senator" / "Representative" as Open States titles it. */
  title: string;
  district: string | null;
  /** A real mail address, or null. Never a contact-form URL — see `contactUrl`. */
  email: string | null;
  /** The member's own contact form, when that's all Open States has. */
  contactUrl: string | null;
  url: string | null;
}

export interface LegislatorsPayload {
  legislators: LegislatorView[];
  source: 'live' | 'unlinked' | 'degraded';
}

export const CHAMBER_LABEL: Record<Chamber, string> = {
  upper: 'State Senate',
  lower: 'State House',
};

/**
 * Subject + body for the "Email Your State Rep" action. Deliberately a draft
 * the sender edits, not a form letter blasted verbatim — legislative offices
 * weight identical mass mail far below a constituent's own words, and we say
 * so in the UI.
 */
export function composeRepEmail(legislator: LegislatorView, bills: TrackedBillView[]): { subject: string; body: string } {
  const billList = bills.map((b) => `- ${b.identifier}: ${b.demand}`).join('\n');
  const salutation = legislator.title ? `${legislator.title} ${legislator.name}` : legislator.name;

  return {
    subject: 'Constituent request: data center energy and water accountability',
    body: [
      `Dear ${salutation},`,
      '',
      'I am a constituent writing about the buildout of large data centers in Minnesota and what it means for our electricity bills, our grid, and our water.',
      '',
      'I am asking you to support:',
      billList,
      '',
      '[Add a sentence in your own words here — what this means for you, your block, or your bills. This matters more than anything above.]',
      '',
      'Thank you for your time.',
      '',
      'Sincerely,',
      '[Your name and address]',
    ].join('\n'),
  };
}

/**
 * Open States' `email` field is not reliably an address — for many members it
 * holds a contact-form URL. Anything that isn't clearly an address has to fall
 * back to a link, or we'd hand the mail client `mailto:https://...`.
 *
 * Deliberately a plain boolean and not a `value is string` type predicate:
 * "not an email address" does not imply "not a string", and asserting that
 * narrows the false branch to `never` at every call site.
 */
export function isMailAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function mailtoHref(legislator: LegislatorView, bills: TrackedBillView[]): string | null {
  if (!isMailAddress(legislator.email)) return null;
  const { subject, body } = composeRepEmail(legislator, bills);
  return `mailto:${legislator.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
