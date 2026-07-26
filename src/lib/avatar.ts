import { Bird, Cat, Fish, PawPrint, Rabbit, Squirrel, Turtle, type LucideIcon } from 'lucide-react';

// Checked Lucide, Tabler, Phosphor, and Iconoir for real wolf/bear/moose/loon
// icons — none of the general-purpose sets have dedicated ones (Iconoir has
// a lone Wolf, not worth a second icon library/style for one glyph). This is
// Lucide's full animal-adjacent set, mapped to real Minnesota wildlife.
const ANIMALS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Loon', Icon: Bird },
  { name: 'Walleye', Icon: Fish },
  { name: 'Cottontail', Icon: Rabbit },
  { name: 'Squirrel', Icon: Squirrel },
  { name: 'Painted Turtle', Icon: Turtle },
  { name: 'Bobcat', Icon: Cat },
  { name: 'Timber Wolf', Icon: PawPrint },
];

const COLORS: { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#0062b2' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Rose', hex: '#e11d48' },
];

export interface Avatar {
  label: string; // e.g. "Blue Loon"
  Icon: LucideIcon;
  color: string;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic from the identity token — same device always gets the same avatar. */
export function deriveAvatar(token: string): Avatar {
  const hash = hashString(token);
  const animal = ANIMALS[hash % ANIMALS.length];
  const color = COLORS[Math.floor(hash / ANIMALS.length) % COLORS.length];
  return { label: `${color.name} ${animal.name}`, Icon: animal.Icon, color: color.hex };
}

/**
 * Reconstructs the icon/color from another user's already-assigned label
 * (e.g. "Blue Painted Turtle") — used to render *their* avatar from data we
 * already display anyway, without needing their token.
 */
export function getAvatarByLabel(label: string): Avatar | null {
  const spaceIndex = label.indexOf(' ');
  if (spaceIndex === -1) return null;
  const colorName = label.slice(0, spaceIndex);
  const animalName = label.slice(spaceIndex + 1);
  const color = COLORS.find((c) => c.name === colorName);
  const animal = ANIMALS.find((a) => a.name === animalName);
  if (!color || !animal) return null;
  return { label, Icon: animal.Icon, color: color.hex };
}
