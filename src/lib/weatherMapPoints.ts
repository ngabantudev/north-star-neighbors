export interface WeatherMapPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Real US cities spanning every state (+ DC), denser in populous areas and
// around the Twin Cities specifically. The temperature map picks the
// nearest ~18 of these to whoever's actually looking, so the "weather
// radar" effect works wherever a user is, not just Minnesota.
export const US_CITIES: WeatherMapPoint[] = [
  // Minnesota + immediate neighbors — the original, denser cluster
  { name: 'Minneapolis', lat: 44.9778, lng: -93.265 },
  { name: 'Saint Paul', lat: 44.9537, lng: -93.09 },
  { name: 'Duluth', lat: 46.7867, lng: -92.1005 },
  { name: 'Rochester', lat: 44.0121, lng: -92.4802 },
  { name: 'St. Cloud', lat: 45.5579, lng: -94.1632 },
  { name: 'Mankato', lat: 44.1636, lng: -93.9994 },
  { name: 'Bemidji', lat: 47.4737, lng: -94.8803 },
  { name: 'International Falls', lat: 48.6011, lng: -93.4108 },
  { name: 'Alexandria', lat: 45.885, lng: -95.3775 },
  { name: 'Marshall', lat: 44.4469, lng: -95.7889 },
  { name: 'Winona', lat: 44.0499, lng: -91.6393 },
  { name: 'Brainerd', lat: 46.358, lng: -94.2008 },

  // Alabama
  { name: 'Birmingham', lat: 33.5186, lng: -86.8104 },
  { name: 'Montgomery', lat: 32.3792, lng: -86.3077 },
  // Alaska
  { name: 'Anchorage', lat: 61.2181, lng: -149.9003 },
  { name: 'Juneau', lat: 58.3019, lng: -134.4197 },
  // Arizona
  { name: 'Phoenix', lat: 33.4484, lng: -112.074 },
  { name: 'Tucson', lat: 32.2226, lng: -110.9747 },
  // Arkansas
  { name: 'Little Rock', lat: 34.7465, lng: -92.2896 },
  // California
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  { name: 'Fresno', lat: 36.7378, lng: -119.7871 },
  { name: 'San Jose', lat: 37.3382, lng: -121.8863 },
  { name: 'Oakland', lat: 37.8044, lng: -122.2712 },
  { name: 'Bakersfield', lat: 35.3733, lng: -119.0187 },
  // Colorado
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Colorado Springs', lat: 38.8339, lng: -104.8214 },
  // Connecticut
  { name: 'Hartford', lat: 41.7658, lng: -72.6734 },
  // Delaware
  { name: 'Dover', lat: 39.1582, lng: -75.5244 },
  // Florida
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
  { name: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { name: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { name: 'Tallahassee', lat: 30.4383, lng: -84.2807 },
  // Georgia
  { name: 'Atlanta', lat: 33.749, lng: -84.388 },
  { name: 'Savannah', lat: 32.0809, lng: -81.0912 },
  // Hawaii
  { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
  // Idaho
  { name: 'Boise', lat: 43.615, lng: -116.2023 },
  // Illinois
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Springfield', lat: 39.7817, lng: -89.6501 },
  // Indiana
  { name: 'Indianapolis', lat: 39.7684, lng: -86.1581 },
  // Iowa
  { name: 'Des Moines', lat: 41.5868, lng: -93.625 },
  { name: 'Sioux City', lat: 42.4999, lng: -96.4003 },
  // Kansas
  { name: 'Wichita', lat: 37.6872, lng: -97.3301 },
  { name: 'Topeka', lat: 39.0473, lng: -95.6752 },
  // Kentucky
  { name: 'Louisville', lat: 38.2527, lng: -85.7585 },
  // Louisiana
  { name: 'New Orleans', lat: 29.9511, lng: -90.0715 },
  { name: 'Baton Rouge', lat: 30.4515, lng: -91.1871 },
  // Maine
  { name: 'Portland (ME)', lat: 43.6591, lng: -70.2568 },
  // Maryland
  { name: 'Baltimore', lat: 39.2904, lng: -76.6122 },
  // Massachusetts
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  // Michigan
  { name: 'Detroit', lat: 42.3314, lng: -83.0458 },
  { name: 'Grand Rapids', lat: 42.9634, lng: -85.6681 },
  // Mississippi
  { name: 'Jackson (MS)', lat: 32.2988, lng: -90.1848 },
  // Missouri
  { name: 'Kansas City', lat: 39.0997, lng: -94.5786 },
  { name: 'St. Louis', lat: 38.627, lng: -90.1994 },
  // Montana
  { name: 'Billings', lat: 45.7833, lng: -108.5007 },
  { name: 'Helena', lat: 46.5891, lng: -112.0391 },
  // Nebraska
  { name: 'Omaha', lat: 41.2565, lng: -95.9345 },
  // Nevada
  { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
  { name: 'Reno', lat: 39.5296, lng: -119.8138 },
  // New Hampshire
  { name: 'Manchester (NH)', lat: 42.9956, lng: -71.4548 },
  // New Jersey
  { name: 'Newark', lat: 40.7357, lng: -74.1724 },
  // New Mexico
  { name: 'Albuquerque', lat: 35.0844, lng: -106.6504 },
  // New York
  { name: 'New York City', lat: 40.7128, lng: -74.006 },
  { name: 'Buffalo', lat: 42.8864, lng: -78.8784 },
  { name: 'Albany', lat: 42.6526, lng: -73.7562 },
  { name: 'Syracuse', lat: 43.0481, lng: -76.1474 },
  // North Carolina
  { name: 'Charlotte', lat: 35.2271, lng: -80.8431 },
  { name: 'Raleigh', lat: 35.7796, lng: -78.6382 },
  // North Dakota
  { name: 'Fargo', lat: 46.8772, lng: -96.7898 },
  { name: 'Bismarck', lat: 46.8083, lng: -100.7837 },
  // Ohio
  { name: 'Columbus', lat: 39.9612, lng: -82.9988 },
  { name: 'Cleveland', lat: 41.4993, lng: -81.6944 },
  { name: 'Cincinnati', lat: 39.1031, lng: -84.512 },
  // Oklahoma
  { name: 'Oklahoma City', lat: 35.4676, lng: -97.5164 },
  { name: 'Tulsa', lat: 36.154, lng: -95.9928 },
  // Oregon
  { name: 'Portland (OR)', lat: 45.5152, lng: -122.6784 },
  { name: 'Salem (OR)', lat: 44.9429, lng: -123.0351 },
  // Pennsylvania
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'Pittsburgh', lat: 40.4406, lng: -79.9959 },
  // Rhode Island
  { name: 'Providence', lat: 41.824, lng: -71.4128 },
  // South Carolina
  { name: 'Columbia (SC)', lat: 34.0007, lng: -81.0348 },
  { name: 'Charleston (SC)', lat: 32.7765, lng: -79.9311 },
  // South Dakota
  { name: 'Sioux Falls', lat: 43.5446, lng: -96.7311 },
  { name: 'Rapid City', lat: 44.0805, lng: -103.231 },
  // Tennessee
  { name: 'Nashville', lat: 36.1627, lng: -86.7816 },
  { name: 'Memphis', lat: 35.1495, lng: -90.049 },
  // Texas
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'Dallas', lat: 32.7767, lng: -96.797 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'Fort Worth', lat: 32.7555, lng: -97.3308 },
  { name: 'El Paso', lat: 31.7619, lng: -106.485 },
  { name: 'Lubbock', lat: 33.5779, lng: -101.8552 },
  // Utah
  { name: 'Salt Lake City', lat: 40.7608, lng: -111.891 },
  // Vermont
  { name: 'Burlington (VT)', lat: 44.4759, lng: -73.2121 },
  // Virginia
  { name: 'Richmond', lat: 37.5407, lng: -77.436 },
  { name: 'Virginia Beach', lat: 36.8529, lng: -75.978 },
  // Washington
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Spokane', lat: 47.6588, lng: -117.426 },
  // Washington, D.C.
  { name: 'Washington, D.C.', lat: 38.9072, lng: -77.0369 },
  // West Virginia
  { name: 'Charleston (WV)', lat: 38.3498, lng: -81.6326 },
  // Wisconsin
  { name: 'Milwaukee', lat: 43.0389, lng: -87.9065 },
  { name: 'Madison', lat: 43.0731, lng: -89.4012 },
  { name: 'Eau Claire', lat: 44.8113, lng: -91.4985 },
  { name: 'La Crosse', lat: 43.8014, lng: -91.2396 },
  // Wyoming
  { name: 'Cheyenne', lat: 41.14, lng: -104.8202 },
];

function haversineDistanceKm(a: WeatherMapPoint, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The `count` cities in US_CITIES closest to (lat, lng), nearest first. */
export function selectNearestCities(lat: number, lng: number, count: number): WeatherMapPoint[] {
  return [...US_CITIES]
    .sort((a, b) => haversineDistanceKm(a, { lat, lng }) - haversineDistanceKm(b, { lat, lng }))
    .slice(0, count);
}

/**
 * A bounding box around a set of points, padded so the outermost cities
 * aren't sitting right at the edge of the rendered gradient. Padding scales
 * with the points' own spread (dense clusters get a small pad, sparse
 * regions like the Mountain West get a bigger one) with a sensible floor.
 */
export function computeBounds(points: WeatherMapPoint[]): LatLngBounds {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);

  const latPad = Math.max(0.6, (north - south) * 0.15);
  const lngPad = Math.max(0.6, (east - west) * 0.15);

  return {
    north: Math.min(north + latPad, 71), // northern Alaska
    south: Math.max(south - latPad, 18), // southern Hawaii
    east: Math.min(east + lngPad, -66),
    west: Math.max(west - lngPad, -170),
  };
}
