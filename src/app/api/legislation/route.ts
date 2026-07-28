import {
  LEGISLATION_REVALIDATE_SECONDS,
  MN_JURISDICTION,
  PUC_DOCKETS,
  TRACKED_BILLS,
  type LegislationPayload,
  type TrackedBillView,
} from '@/lib/legislation';
import { fetchBill, openStatesKey } from '@/lib/openStates';

// Like /api/weather and unlike the drops routes, this is deliberately NOT
// force-dynamic: bill status changes a few times a session, and the Open
// States free tier is a 250/day budget shared by every visitor. Letting the
// upstream fetches cache means one call per bill per six hours for the whole
// deployment.

export async function GET() {
  if (!openStatesKey()) {
    const payload: LegislationPayload = {
      bills: TRACKED_BILLS.map((b) => ({ ...b, status: { known: false } })),
      dockets: PUC_DOCKETS,
      source: 'unlinked',
    };
    return Response.json(payload);
  }

  const results = await Promise.all(
    TRACKED_BILLS.map(async (tracked): Promise<TrackedBillView> => {
      const bill = await fetchBill(
        MN_JURISDICTION,
        tracked.session,
        tracked.identifier,
        LEGISLATION_REVALIDATE_SECONDS,
      ).catch(() => null);

      if (!bill?.latest_action_description) return { ...tracked, status: { known: false } };

      return {
        ...tracked,
        status: {
          known: true,
          title: bill.title ?? tracked.identifier,
          latestAction: bill.latest_action_description,
          latestActionDate: bill.latest_action_date ?? null,
          url: bill.openstates_url ?? null,
        },
      };
    }),
  );

  const payload: LegislationPayload = {
    bills: results,
    dockets: PUC_DOCKETS,
    // If every lookup came back empty the key is probably bad or the service
    // is down — say so rather than presenting a wall of "status unknown" as
    // though that were the real state of the legislature.
    source: results.some((b) => b.status.known) ? 'live' : 'degraded',
  };
  return Response.json(payload);
}
