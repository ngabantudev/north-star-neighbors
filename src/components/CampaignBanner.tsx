'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Landmark } from 'lucide-react';
import { ActionCenterDialog } from '@/components/ActionCenterDialog';
import { useCampaign } from '@/hooks/useCampaign';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TrackedBillView } from '@/lib/legislation';

const COLLAPSED_KEY = 'nsn.campaignBanner.expanded';

function BillRow({ bill }: { bill: TrackedBillView }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-mn-blue">{bill.identifier}</span>
        {bill.status.known && bill.status.url && (
          <a
            href={bill.status.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-medium text-mn-sky underline"
          >
            Track
          </a>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-700">{bill.demand}</p>
      {bill.status.known ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-slate-600">Latest:</span> {bill.status.latestAction}
          {bill.status.latestActionDate && ` (${bill.status.latestActionDate})`}
        </p>
      ) : (
        // Never invent a status. An unreachable tracker is a missing fact, and
        // saying so keeps the banner trustworthy on the days it can't reach
        // Open States.
        <p className="mt-1 text-[11px] text-muted-foreground">Live status unavailable — check the tracker directly.</p>
      )}
    </div>
  );
}

/**
 * Collapsible "Statewide Campaign Goals" banner over the map. Starts
 * collapsed to a single chip so it never competes with the drop pins, and
 * remembers the visitor's choice — an activist who opened it once is telling
 * us they want it, and someone who closed it shouldn't have to close it on
 * every page load.
 *
 * Bill data is only fetched once the banner is expanded, so a visitor who
 * never opens it costs the Open States quota nothing.
 */
export function CampaignBanner() {
  // Always renders collapsed first, then restores the stored preference —
  // reading localStorage during the initial render would desync from the
  // server-rendered HTML and trip a hydration mismatch.
  const [expanded, setExpanded] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);

  useEffect(() => {
    // Restoring persisted UI state from storage, not deriving from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem(COLLAPSED_KEY) === '1') setExpanded(true);
  }, []);
  const { legislation, legislators, loading } = useCampaign(expanded || actionOpen);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <>
      <div className="pointer-events-auto w-[min(92vw,22rem)]">
        <button
          onClick={toggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 rounded-full border border-mn-blue/20 bg-white/95 px-4 py-1.5 text-sm font-medium text-mn-blue shadow backdrop-blur"
        >
          <Landmark size={15} className="shrink-0" />
          <span className="truncate">Statewide Campaign Goals</span>
          <ChevronDown
            size={16}
            className={cn('ml-auto shrink-0 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {expanded && (
          <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <p className="text-xs text-muted-foreground">
              What we&apos;re fighting for in St. Paul — bill status is pulled live from Open States.
            </p>

            {loading && !legislation && <p className="text-xs text-muted-foreground">Loading bill status…</p>}

            {(legislation?.bills ?? []).map((b) => (
              <BillRow key={`${b.session}-${b.identifier}`} bill={b} />
            ))}

            {legislation?.source === 'unlinked' && (
              <p className="text-[11px] text-muted-foreground">
                Live bill tracking is not configured on this deployment.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setActionOpen(true)}
                className={cn(buttonVariants({ size: 'sm' }), 'bg-mn-blue text-white hover:bg-mn-blue/90')}
              >
                Take action
              </button>
              <a
                href="https://www.revisor.mn.gov/bills/status_search.php"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                All bills <ExternalLink />
              </a>
            </div>
          </div>
        )}
      </div>

      <ActionCenterDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        legislation={legislation}
        legislators={legislators}
        loading={loading}
      />
    </>
  );
}
