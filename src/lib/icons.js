/**
 * Lucide icons, inlined at build time as a single SVG sprite.
 *
 * `?raw` makes Vite read each SVG during the build and bake it into the
 * output: no icon font, no sprite request, no runtime JavaScript. The icons
 * cost exactly the bytes of their path data.
 *
 * The path data is emitted ONCE, into a hidden <svg> sprite at the top of the
 * document, and each of the ~2,100 use sites is a 40-byte <use> reference.
 * Inlining the full markup per site instead cost 21 kB gzipped on this page —
 * with 323 cards, an icon used inline is an icon paid for 323 times.
 *
 * Presentation (fill, stroke, caps, joins) lives in one CSS rule on `.icon`
 * in global.css, so the sprite carries geometry only.
 *
 * Icons are ISC licensed (c) Lucide Icons and Contributors.
 */
import bedDouble from 'lucide-static/icons/bed-double.svg?raw';
import utensils from 'lucide-static/icons/utensils.svg?raw';
import stethoscope from 'lucide-static/icons/stethoscope.svg?raw';
import packageIcon from 'lucide-static/icons/package.svg?raw';
import handshake from 'lucide-static/icons/handshake.svg?raw';
import phone from 'lucide-static/icons/phone.svg?raw';
import externalLink from 'lucide-static/icons/external-link.svg?raw';
import navigation from 'lucide-static/icons/navigation.svg?raw';
import clock from 'lucide-static/icons/clock.svg?raw';
import heart from 'lucide-static/icons/heart.svg?raw';
import busFront from 'lucide-static/icons/bus-front.svg?raw';
import triangleAlert from 'lucide-static/icons/triangle-alert.svg?raw';
import clipboardList from 'lucide-static/icons/clipboard-list.svg?raw';

const RAW = {
  'bed-double': bedDouble,
  utensils,
  stethoscope,
  package: packageIcon,
  handshake,
  phone,
  'external-link': externalLink,
  navigation,
  clock,
  heart,
  'bus-front': busFront,
  'triangle-alert': triangleAlert,
  'clipboard-list': clipboardList,
};

const symbolId = (name) => `i-${name}`;

/** Strips a Lucide file down to the drawing commands inside its <svg>. */
function innerMarkup(raw) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The sprite itself. Render once per page, before anything that references
 * it. Hidden from layout and from assistive tech.
 */
export function iconSprite() {
  const symbols = Object.keys(RAW)
    .map((name) => `<symbol id="${symbolId(name)}" viewBox="0 0 24 24">${innerMarkup(RAW[name])}</symbol>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" class="icon-sprite" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>`;
}

/**
 * A reference to one sprite symbol. Every icon here sits beside a real text
 * label, so they are all decorative to assistive tech.
 */
export function icon(name, { size = 16, className = '' } = {}) {
  if (!RAW[name]) throw new Error(`Unknown icon: ${name}`);
  const cls = `icon ${className}`.trim();
  return `<svg class="${cls}" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#${symbolId(name)}"/></svg>`;
}
