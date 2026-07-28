// A TV-weather-style diverging scale: deep blue (cold) through green/yellow
// to red and magenta (dangerous heat). Stops are °F -> [r,g,b].
const STOPS: [number, [number, number, number]][] = [
  [0, [30, 58, 138]], // deep blue
  [32, [59, 130, 246]], // blue
  [50, [34, 197, 194]], // teal
  [65, [34, 197, 94]], // green
  [75, [163, 230, 53]], // yellow-green
  [85, [234, 179, 8]], // yellow
  [95, [249, 115, 22]], // orange
  [105, [220, 38, 38]], // red
  [115, [124, 45, 18]], // deep red/maroon
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Maps a Fahrenheit temperature to an [r,g,b] color via the scale above. */
export function tempToRgb(tempF: number): [number, number, number] {
  if (tempF <= STOPS[0][0]) return STOPS[0][1];
  const last = STOPS[STOPS.length - 1];
  if (tempF >= last[0]) return last[1];

  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i];
    const [t1, c1] = STOPS[i + 1];
    if (tempF >= t0 && tempF <= t1) {
      const t = (tempF - t0) / (t1 - t0);
      return [
        Math.round(lerp(c0[0], c1[0], t)),
        Math.round(lerp(c0[1], c1[1], t)),
        Math.round(lerp(c0[2], c1[2], t)),
      ];
    }
  }
  return last[1];
}

/** Stops used to render the on-map legend gradient bar. */
export const TEMPERATURE_LEGEND_STOPS = STOPS;

const MIN_STOP = STOPS[0][0];
const MAX_STOP = STOPS[STOPS.length - 1][0];

/** Ready-to-use CSS `linear-gradient()` stop list matching the scale above. */
export const TEMPERATURE_GRADIENT_CSS = STOPS.map(
  ([t, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${(((t - MIN_STOP) / (MAX_STOP - MIN_STOP)) * 100).toFixed(1)}%`,
).join(', ');
