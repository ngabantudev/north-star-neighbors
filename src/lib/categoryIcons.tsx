import { renderToStaticMarkup } from 'react-dom/server';
import { Carrot, Shirt, Cross, Droplet, Baby, Package, type LucideIcon } from 'lucide-react';
import type { DropCategory } from '@/lib/types';

export const CATEGORY_ICONS: Record<DropCategory, LucideIcon> = {
  produce: Carrot,
  coats: Shirt,
  medical: Cross,
  water: Droplet,
  baby: Baby,
  general: Package,
};

const MAX_VISIBLE = 3;

/**
 * Small "coin stack" of category icons for a map pin — used from imperative
 * DOM code (Map.tsx builds markers outside React's render tree), so this
 * returns markup via renderToStaticMarkup rather than JSX.
 */
export function renderCategoryIconStack(categories: DropCategory[]): string {
  if (categories.length === 0) return '';
  const visible = categories.slice(0, MAX_VISIBLE);
  const overflow = categories.length - visible.length;

  const chips = visible
    .map((cat, i) => {
      const Icon = CATEGORY_ICONS[cat];
      const svg = renderToStaticMarkup(<Icon size={8} strokeWidth={2.75} color="#1f2937" />);
      const z = visible.length - i;
      const marginLeft = i === 0 ? 0 : -5;
      return `<span style="z-index:${z};margin-left:${marginLeft}px;display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:9999px;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.45);position:relative;">${svg}</span>`;
    })
    .join('');

  const overflowChip =
    overflow > 0
      ? `<span style="z-index:0;margin-left:-5px;display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:9999px;background:#1f2937;color:#ffffff;font-size:7px;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,0.45);position:relative;">+${overflow}</span>`
      : '';

  return `<span style="display:inline-flex;align-items:center;">${chips}${overflowChip}</span>`;
}
