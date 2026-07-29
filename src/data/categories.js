/**
 * The kinds of aid this directory tracks, derived from what the TCMAP source
 * data actually records rather than from an abstract model of survival needs.
 *
 * Sites carry every tag that applies — about half provide more than one kind
 * of aid, so a single category per site would have thrown away real
 * information.
 *
 * ORDER MATTERS. The checkbox inputs are rendered in this order, and the
 * CSS-only filter rules chain sibling combinators (`~`) that depend on that
 * DOM order. It also decides a site's "primary" tag, which colors its map
 * marker. Scarcer aid sorts first so it wins that slot.
 *
 * There is no water category: the source has no column for it and no site
 * describes providing it. See README.
 */
export const CATEGORIES = [
  {
    id: 'shelter',
    label: 'Shelter & Warmth',
    emoji: '🛏️',
    blurb: 'Warming sites, housing support, drop-in space',
    color: '#7b61c9',
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍲',
    blurb: 'Food shelves, pantries, hot meals, produce',
    color: '#e2703a',
  },
  {
    id: 'health',
    label: 'Health',
    emoji: '🩺',
    blurb: 'Clinics, harm reduction, mental health care',
    color: '#3aa87a',
  },
  {
    id: 'supplies',
    label: 'Supplies',
    emoji: '🧺',
    blurb: 'Clothing, hygiene, diapers, household goods',
    color: '#2f80ed',
  },
  {
    id: 'support',
    label: 'Support Services',
    emoji: '🤝',
    blurb: 'Legal, immigration, education, case work',
    color: '#c9a227',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

export const CATEGORY_ORDER = CATEGORIES.map((c) => c.id);

/** Sorts a site's tags into canonical order; the first one is its primary. */
export function sortCategories(ids) {
  return [...ids].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );
}
