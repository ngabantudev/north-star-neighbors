'use client';

import { ExternalLink, Mail, MessageSquareText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CHAMBER_LABEL,
  PUC_COMMENT_URL,
  PUC_EDOCKETS_URL,
  composeRepEmail,
  mailtoHref,
  type LegislationPayload,
  type LegislatorsPayload,
  type LegislatorView,
  type TrackedBillView,
} from '@/lib/legislation';

interface ActionCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legislation: LegislationPayload | null;
  legislators: LegislatorsPayload | null;
  loading: boolean;
}

function LegislatorRow({ legislator, bills }: { legislator: LegislatorView; bills: TrackedBillView[] }) {
  const href = mailtoHref(legislator, bills);
  const seat = [CHAMBER_LABEL[legislator.chamber], legislator.district && `District ${legislator.district}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">
          {legislator.title} {legislator.name}
          {legislator.party && <span className="ml-1 font-normal text-muted-foreground">({legislator.party})</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{seat}</p>
      </div>
      {href ? (
        <a href={href} className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 bg-mn-blue text-white hover:bg-mn-blue/90')}>
          <Mail /> Email
        </a>
      ) : (
        // Not every member publishes an address — some only have a contact
        // form. Prefer the member's own form, then their Open States page,
        // rather than rendering a dead mailto.
        <a
          href={legislator.contactUrl ?? legislator.url ?? 'https://www.leg.mn.gov/leg/legdir'}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'shrink-0')}
        >
          Contact <ExternalLink />
        </a>
      )}
    </div>
  );
}

/**
 * The action half of the legislative tracker: turn "I see a data center on
 * the map" into a sent email or a filed PUC comment in one click.
 *
 * Both actions hand off to systems of record we don't control (the member's
 * inbox, the PUC's eDockets) rather than collecting anything here — this app
 * holds no accounts and shouldn't start brokering constituent identity.
 */
export function ActionCenterDialog({ open, onOpenChange, legislation, legislators, loading }: ActionCenterDialogProps) {
  const bills = legislation?.bills ?? [];
  const found = legislators?.legislators ?? [];
  const preview = found[0] ? composeRepEmail(found[0], bills) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Take action</DialogTitle>
          <DialogDescription>
            Two ways to put this on the record in St. Paul.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Mail size={15} /> Email your state legislators
          </h3>

          {loading && <p className="text-sm text-muted-foreground">Finding your district…</p>}

          {!loading && found.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {legislators?.source === 'unlinked'
                ? 'District lookup is not configured on this deployment.'
                : 'Could not match your location to a Minnesota district.'}{' '}
              <a
                href="https://www.leg.mn.gov/leg/legdir"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-mn-sky underline"
              >
                Find your legislators
              </a>
            </p>
          )}

          {found.map((l) => (
            <LegislatorRow key={l.id} legislator={l} bills={bills} />
          ))}

          {preview && (
            <details className="rounded-lg bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">
                Preview the draft — edit it before sending
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{preview.body}</p>
            </details>
          )}

          <p className="text-xs text-muted-foreground">
            Offices weigh a constituent&apos;s own sentence far more heavily than identical mass mail. The draft opens in
            your mail app — please add yours.
          </p>
        </section>

        <section className="space-y-2 border-t border-slate-200 pt-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <MessageSquareText size={15} /> Submit a public comment to the PUC
          </h3>

          {(legislation?.dockets ?? []).map((d) => (
            <div key={d.docket} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-sm font-medium text-slate-800">Docket {d.docket}</p>
              <p className="text-xs text-muted-foreground">{d.title}</p>
              <p className="mt-1 text-xs text-slate-600">{d.ask}</p>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <a
              href={PUC_COMMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm' }), 'bg-mn-green text-white hover:bg-mn-green/90')}
            >
              Comment to the PUC <ExternalLink />
            </a>
            <a
              href={PUC_EDOCKETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              Browse eDockets <ExternalLink />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone may comment on a docket before the Commission — you do not need to be a party to the case.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
