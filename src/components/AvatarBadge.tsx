import { getAvatarByLabel } from '@/lib/avatar';

/** Renders another user's icon+color avatar from their handle label alone. */
export function AvatarBadge({ label, size = 16 }: { label: string; size?: number }) {
  const avatar = getAvatarByLabel(label);
  if (!avatar) return <span>{label}</span>;

  const { Icon, color } = avatar;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Icon size={size} color={color} strokeWidth={2.25} />
      <span className="font-medium" style={{ color }}>
        {label}
      </span>
    </span>
  );
}
