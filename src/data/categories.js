/**
 * The three survival categories. Order here drives the order of the filter
 * bar and the sidebar groupings, so it is deliberate: water first, because
 * it is the shortest-fuse need.
 */
export const CATEGORIES = [
  {
    id: 'water',
    label: 'Water',
    emoji: '💧',
    blurb: 'Drinking fountains, splash pads, hydration stations',
    color: '#2f80ed',
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍲',
    blurb: 'Food shelves, community pantries, meal sites',
    color: '#e2703a',
  },
  {
    id: 'shelter',
    label: 'Shelter & Relief',
    emoji: '🛏️',
    blurb: 'Libraries, community centers, emergency shelter',
    color: '#7b61c9',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);
