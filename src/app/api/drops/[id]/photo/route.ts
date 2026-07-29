import { dropTokenFrom, getDropPhotoForViewer } from '@/lib/dropAccess';

export const dynamic = 'force-dynamic';

// Same visibility rule as the drop itself: public while the pin is on the map,
// provider/claimant-only once it's claimed or hidden. A curbside photo can show
// the front of someone's home, so it must not outlive the pin's public phase.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getDropPhotoForViewer(id, dropTokenFrom(req));

  if (!found) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(found.photo), {
    headers: {
      'Content-Type': found.contentType,
      // Authorization is per-token, so this must never land in a shared cache.
      'Cache-Control': 'private, no-store',
    },
  });
}
