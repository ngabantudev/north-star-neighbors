import { listPublicDrops } from '@/lib/dropAccess';

export const dynamic = 'force-dynamic';

// The public, masked map view. Everything about the projection and the
// visibility rule lives in @/lib/dropAccess so this route and the by-id route
// can't disagree about what's publishable.
export async function GET() {
  return Response.json({ drops: await listPublicDrops() });
}
