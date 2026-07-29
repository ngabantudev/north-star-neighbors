import { dropTokenFrom, getDropForViewer } from '@/lib/dropAccess';

export const dynamic = 'force-dynamic';

// Detail lookup by id, used by the provider/claimant to poll a pin's status
// after it has been masked from the public list. A drop id is public (the
// ledger publishes one per event), so knowing the id is not authorization —
// non-AVAILABLE drops require the ownership token header. Never returns token
// hashes or the real curbside coordinate (see the getExactLocation action).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drop = await getDropForViewer(id, dropTokenFrom(req));

  if (!drop) return Response.json({ error: 'not_found' }, { status: 404 });

  return Response.json({ drop }, { headers: { 'Cache-Control': 'no-store' } });
}
