'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, MapPin, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { createDrop } from '@/app/actions';
import { captureVideoFrame } from '@/lib/imageCompress';
import { checkImage } from '@/lib/nsfwCheck';
import { Map } from '@/components/Map';
import type { Identity } from '@/hooks/useIdentity';
import type { MyDropRecord } from '@/components/DropDrawer';
import { DROP_CATEGORY_LABELS, TTL_PRESETS, TTL_MIN_MINUTES, TTL_MAX_MINUTES, type CivicAnchor, type DropCategory } from '@/lib/types';
import { formatDistance } from '@/lib/distance';

const dropFormSchema = z.object({
  categories: z.array(z.string()).min(1, 'Select at least one category'),
  amount: z.number({ error: 'Required' }).min(1, 'Must be at least 1'),
  description: z.string().trim().min(1, 'Required').max(100, 'Keep it short'),
  ttlMinutes: z.number({ error: 'Select an expiry' }).min(TTL_MIN_MINUTES, `Min ${TTL_MIN_MINUTES} min`).max(TTL_MAX_MINUTES, `Max ${TTL_MAX_MINUTES} min`),
});

type DropFormValues = z.infer<typeof dropFormSchema>;

// Selected-state highlight for both toggle groups: bold blue, not the default muted gray.
const TOGGLE_SELECTED = 'data-[pressed]:bg-mn-blue data-[pressed]:text-white data-[pressed]:border-mn-blue';

type CandidatesState = 'loading' | 'none' | CivicAnchor[];
type GeocodeState = 'loading' | 'none' | string;
// Photo is captured live from getUserMedia only — never a file picker, so
// what gets uploaded can't be an old photo pulled from the gallery.
type PhotoState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'streaming'; stream: MediaStream }
  | { status: 'checking' }
  | { status: 'ready'; blob: Blob; previewUrl: string }
  | { status: 'error'; reason: string };

interface DropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** [lng, lat], reused from the parent's own geolocation — no separate request here. */
  center: [number, number] | null;
  identity: Identity | null;
  onDropped: (record: MyDropRecord) => void;
}

export function DropDialog({ open, onOpenChange, center, identity, onDropped }: DropDialogProps) {
  const [candidates, setCandidates] = useState<CandidatesState>('loading');
  // Array to match ToggleGroup's value shape; single-select in practice (never more than 1 entry).
  const [selectedAnchorId, setSelectedAnchorId] = useState<string[]>([]);
  const [geocode, setGeocode] = useState<GeocodeState>('loading');
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<PhotoState>(photo);
  photoRef.current = photo;

  const stopStream = useCallback(() => {
    if (photoRef.current.status === 'streaming') {
      photoRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  // Release the camera whenever the dialog closes or unmounts — never leave
  // it running in the background.
  useEffect(() => {
    if (!open) stopStream();
    return () => stopStream();
  }, [open, stopStream]);

  const form = useForm<DropFormValues>({
    resolver: zodResolver(dropFormSchema),
    defaultValues: {
      categories: [],
      amount: 1,
      description: '',
      ttlMinutes: 30,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      categories: [],
      amount: 1,
      description: '',
      ttlMinutes: 30,
    });
    setSubmitError(null);
    setPhoto({ status: 'idle' });

    if (!center) {
      setCandidates('none');
      setSelectedAnchorId([]);
      setGeocode('none');
      return;
    }
    setCandidates('loading');
    setSelectedAnchorId([]);
    fetch(`/api/anchors?lat=${center[1]}&lng=${center[0]}&limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { anchors: CivicAnchor[] } | null) => {
        const anchors = data?.anchors ?? [];
        setCandidates(anchors.length > 0 ? anchors : 'none');
        // Pre-select the nearest as a convenient default — the person still has
        // to actively keep or change it, it's never a hidden auto-choice.
        setSelectedAnchorId(anchors.length > 0 ? [anchors[0].id] : []);
      });

    setGeocode('loading');
    fetch(`/api/geocode/reverse?lat=${center[1]}&lng=${center[0]}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { label: string | null } | null) => {
        setGeocode(data?.label ?? 'none');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, center]);

  async function openCamera() {
    setPhoto({ status: 'requesting' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setPhoto({ status: 'streaming', stream });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const reason =
        name === 'NotAllowedError'
          ? 'Camera access was denied. Allow camera access in your browser settings to drop a pin.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : 'Could not open the camera. Please try again.';
      setPhoto({ status: 'error', reason });
    }
  }

  useEffect(() => {
    if (photo.status === 'streaming' && videoRef.current) {
      videoRef.current.srcObject = photo.stream;
    }
  }, [photo]);

  async function capturePhoto() {
    if (photo.status !== 'streaming' || !videoRef.current) return;
    const stream = photo.stream;
    setPhoto({ status: 'checking' });
    try {
      const { blob, canvas, previewUrl } = await captureVideoFrame(videoRef.current);
      stream.getTracks().forEach((t) => t.stop());
      const { flagged } = await checkImage(canvas);
      if (flagged) {
        setPhoto({ status: 'error', reason: 'This photo was flagged by our content check. Please retake it.' });
        return;
      }
      setPhoto({ status: 'ready', blob, previewUrl });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setPhoto({ status: 'error', reason: "Couldn't process that photo. Please try again." });
    }
  }

  const categories = form.watch('categories');
  const amount = form.watch('amount');
  const description = form.watch('description');
  const ttlMinutes = form.watch('ttlMinutes');

  const selectedAnchor: CivicAnchor | null = Array.isArray(candidates)
    ? (candidates.find((a) => a.id === selectedAnchorId[0]) ?? null)
    : null;
  const hasAnchor = !!selectedAnchor;
  const hasPhoto = photo.status === 'ready';
  const hasCategories = categories.length > 0;
  const hasDescription = description.trim().length > 0 && !!amount;
  const hasTtl = !!ttlMinutes;

  const missing: string[] = [];
  if (!hasPhoto) missing.push('a photo');
  if (!hasAnchor) missing.push('a meetup location');
  if (!hasCategories) missing.push('a category');
  if (!hasDescription) missing.push('an amount and description');
  if (!hasTtl) missing.push('an expiry time');

  const canSubmit = !submitting && !!identity && missing.length === 0;

  async function onSubmit(values: DropFormValues) {
    if (!identity || !selectedAnchor || photo.status !== 'ready') return;
    const anchor = selectedAnchor;

    setSubmitError(null);
    setSubmitting(true);
    // Reuse the persistent identity token (not a fresh one) so ownership and
    // the reputation row both key off the same hash.
    const providerToken = identity.token;
    const photoFile = new File([photo.blob], 'supplies.jpg', { type: 'image/jpeg' });
    const result = await createDrop({
      lat: anchor.lat,
      lng: anchor.lng,
      categories: values.categories as DropCategory[],
      details: `${values.amount} ${values.description.trim()}`,
      ttlMinutes: values.ttlMinutes,
      photo: photoFile,
      providerHandle: identity.handle,
      providerToken,
      deviceHash: identity.deviceId,
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    onDropped({ dropId: result.data.dropId, token: providerToken, role: 'provider' });
    onOpenChange(false);
    toast.success('Pin dropped — it’s live on the map now.');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Drop supplies</DialogTitle>
          <DialogDescription>
            Pins can only be placed at pre-approved public sites — never a private residence.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5">Photo of supplies (required)</Label>

            {photo.status === 'idle' && (
              <Button type="button" variant="outline" onClick={openCamera} className="gap-2">
                <Camera size={18} /> Open camera
              </Button>
            )}

            {photo.status === 'requesting' && (
              <p className="text-sm text-muted-foreground">Requesting camera access…</p>
            )}

            {photo.status === 'streaming' && (
              <div className="flex flex-col gap-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg bg-black"
                  style={{ aspectRatio: '4 / 3', objectFit: 'cover' }}
                />
                <Button type="button" onClick={capturePhoto} className="gap-2 bg-mn-blue hover:bg-mn-blue/90">
                  <Camera size={18} /> Capture photo
                </Button>
              </div>
            )}

            {photo.status === 'checking' && <p className="text-sm text-muted-foreground">Checking photo…</p>}

            {photo.status === 'ready' && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt="Supplies preview"
                  className="h-24 w-24 rounded-lg object-cover ring-1 ring-border"
                />
                <Button type="button" variant="outline" size="sm" onClick={openCamera} className="gap-1.5">
                  <RotateCcw size={14} /> Retake
                </Button>
              </div>
            )}

            {photo.status === 'error' && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-destructive">{photo.reason}</p>
                <Button type="button" variant="outline" onClick={openCamera} className="gap-2 self-start">
                  <Camera size={18} /> Try again
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Meetup location (required)</p>
            <p className="text-xs text-muted-foreground">
              Pick which public site to use — the nearest one is pre-selected as a default, but you choose.
              Whichever you pick, that site&apos;s own coordinates are what gets stored, never your exact location.
            </p>
            {candidates === 'loading' && (
              <p className="mt-2 text-sm text-muted-foreground">Finding nearby public sites…</p>
            )}
            {Array.isArray(candidates) && (
              <>
                <ToggleGroup
                  value={selectedAnchorId}
                  onValueChange={(value) => setSelectedAnchorId(value)}
                  orientation="vertical"
                  className="mt-2 w-full"
                >
                  {candidates.map((a) => (
                    <ToggleGroupItem
                      key={a.id}
                      value={a.id}
                      variant="outline"
                      className={`${TOGGLE_SELECTED} w-full justify-start gap-1.5`}
                    >
                      <MapPin size={14} className="shrink-0" />
                      {a.name} · {formatDistance(a.distanceMeters ?? 0)} away
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {selectedAnchor && (
                  <div className="mt-2 h-40 overflow-hidden rounded-lg ring-1 ring-border">
                    <Map
                      markers={candidates.map((a) => ({
                        id: a.id,
                        lat: a.lat,
                        lng: a.lng,
                        isMine: a.id === selectedAnchor.id,
                      }))}
                      onMarkerClick={(id) => setSelectedAnchorId([id])}
                      center={[selectedAnchor.lng, selectedAnchor.lat]}
                      zoom={14}
                      showControls={false}
                      className="h-full w-full"
                    />
                  </div>
                )}
              </>
            )}
            {candidates === 'none' && (
              <>
                <p className="text-sm text-destructive">
                  No approved public site (library, transit station, fire station, community center, park,
                  grocery store, or nonprofit office) was found near you.
                </p>
                {geocode !== 'loading' && geocode !== 'none' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    You appear to be near {geocode}.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <Label className="mb-1.5">Categories</Label>
            <Controller
              control={form.control}
              name="categories"
              render={({ field }) => (
                <ToggleGroup
                  multiple
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  className="flex-wrap"
                  orientation="horizontal"
                >
                  {(Object.keys(DROP_CATEGORY_LABELS) as DropCategory[]).map((cat) => (
                    <ToggleGroupItem key={cat} value={cat} variant="outline" className={TOGGLE_SELECTED}>
                      {DROP_CATEGORY_LABELS[cat]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
            {form.formState.errors.categories && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.categories.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <div>
              <Label className="mb-1.5" htmlFor="amount">
                Amount
              </Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => field.onChange(Math.max(1, (field.value || 1) - 1))}
                    >
                      −
                    </Button>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={field.value ?? 1}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-16 shrink-0 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => field.onChange((field.value || 1) + 1)}
                    >
                      +
                    </Button>
                  </div>
                )}
              />
            </div>
            <div className="flex-1">
              <Label className="mb-1.5" htmlFor="description">
                Description
              </Label>
              <Input id="description" placeholder="e.g. boxes of canned goods" maxLength={100} {...form.register('description')} />
            </div>
          </div>
          {(form.formState.errors.amount || form.formState.errors.description) && (
            <p className="-mt-3 text-xs text-destructive">
              {form.formState.errors.amount?.message || form.formState.errors.description?.message}
            </p>
          )}

          <div>
            <Label className="mb-1.5">Expires in</Label>
            <Controller
              control={form.control}
              name="ttlMinutes"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => field.onChange(Math.max(TTL_MIN_MINUTES, (field.value ?? 30) - 30))}
                    >
                      −30
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={TTL_MIN_MINUTES}
                      max={TTL_MAX_MINUTES}
                      step={30}
                      value={field.value ?? 30}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-20 shrink-0 text-center"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => field.onChange(Math.min(TTL_MAX_MINUTES, (field.value ?? 30) + 30))}
                    >
                      +30
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TTL_PRESETS.map((preset) => (
                      <Button
                        key={preset.minutes}
                        type="button"
                        variant={field.value === preset.minutes ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => field.onChange(preset.minutes)}
                        className={field.value === preset.minutes ? 'bg-mn-blue hover:bg-mn-blue/90' : ''}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter className="flex-col items-stretch gap-1.5">
          {missing.length > 0 && !submitting && (
            <p className="text-xs text-muted-foreground">Still needed: {missing.join(', ')}.</p>
          )}
          <Button onClick={form.handleSubmit(onSubmit)} disabled={!canSubmit}>
            {submitting ? 'Dropping…' : 'Drop Pin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
