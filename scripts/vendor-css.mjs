/**
 * Copies MapLibre's stylesheet into public/vendor/ so the map can pull it in
 * at runtime.
 *
 * Importing the CSS from map.js would be tidier, but Astro hoists any
 * stylesheet reachable from a page's script graph into a render-blocking
 * <link> in the head — which puts ~10 kB gzipped in front of first paint for
 * a stylesheet only the map needs. Vendoring keeps the initial payload to the
 * directory itself.
 */
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/maplibre-gl/dist/maplibre-gl.css');
const dest = resolve(root, 'public/vendor/maplibre-gl.css');

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log('vendored maplibre-gl.css -> public/vendor/');
