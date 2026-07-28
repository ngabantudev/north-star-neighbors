export interface WeatherMapPoint {
  name: string;
  /** 2-letter USPS state code (or 'DC'). */
  state: string;
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Real US cities — several per state (more for Minnesota, this app's home
// turf) so a viewport zoomed into a single state/metro still has enough
// resolution to show "major and minor cities," not just one point per state.
export const US_CITIES: WeatherMapPoint[] = [
  // Alabama
  { name: 'Birmingham', state: 'AL', lat: 33.5186, lng: -86.8104 },
  { name: 'Montgomery', state: 'AL', lat: 32.3792, lng: -86.3077 },
  { name: 'Huntsville', state: 'AL', lat: 34.7304, lng: -86.5861 },
  { name: 'Mobile', state: 'AL', lat: 30.6954, lng: -88.0399 },
  { name: 'Tuscaloosa', state: 'AL', lat: 33.2098, lng: -87.5692 },
  // Alaska
  { name: 'Anchorage', state: 'AK', lat: 61.2181, lng: -149.9003 },
  { name: 'Juneau', state: 'AK', lat: 58.3019, lng: -134.4197 },
  { name: 'Fairbanks', state: 'AK', lat: 64.8378, lng: -147.7164 },
  // Arizona
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.074 },
  { name: 'Tucson', state: 'AZ', lat: 32.2226, lng: -110.9747 },
  { name: 'Mesa', state: 'AZ', lat: 33.4152, lng: -111.8315 },
  { name: 'Flagstaff', state: 'AZ', lat: 35.1983, lng: -111.6513 },
  { name: 'Yuma', state: 'AZ', lat: 32.6927, lng: -114.6277 },
  // Arkansas
  { name: 'Little Rock', state: 'AR', lat: 34.7465, lng: -92.2896 },
  { name: 'Fayetteville (AR)', state: 'AR', lat: 36.0626, lng: -94.1574 },
  { name: 'Fort Smith', state: 'AR', lat: 35.3859, lng: -94.3985 },
  // California
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { name: 'Sacramento', state: 'CA', lat: 38.5816, lng: -121.4944 },
  { name: 'Fresno', state: 'CA', lat: 36.7378, lng: -119.7871 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
  { name: 'Oakland', state: 'CA', lat: 37.8044, lng: -122.2712 },
  { name: 'Bakersfield', state: 'CA', lat: 35.3733, lng: -119.0187 },
  { name: 'Long Beach', state: 'CA', lat: 33.7701, lng: -118.1937 },
  { name: 'Anaheim', state: 'CA', lat: 33.8366, lng: -117.9143 },
  { name: 'Riverside', state: 'CA', lat: 33.9806, lng: -117.3755 },
  { name: 'Santa Barbara', state: 'CA', lat: 34.4208, lng: -119.6982 },
  { name: 'Eureka', state: 'CA', lat: 40.8021, lng: -124.1637 },
  { name: 'Redding', state: 'CA', lat: 40.5865, lng: -122.3917 },
  { name: 'Palm Springs', state: 'CA', lat: 33.8303, lng: -116.5453 },
  // Colorado
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { name: 'Colorado Springs', state: 'CO', lat: 38.8339, lng: -104.8214 },
  { name: 'Fort Collins', state: 'CO', lat: 40.5853, lng: -105.0844 },
  { name: 'Grand Junction', state: 'CO', lat: 39.0639, lng: -108.5506 },
  { name: 'Pueblo', state: 'CO', lat: 38.2544, lng: -104.6091 },
  { name: 'Durango', state: 'CO', lat: 37.2753, lng: -107.8801 },
  // Connecticut
  { name: 'Hartford', state: 'CT', lat: 41.7658, lng: -72.6734 },
  { name: 'Bridgeport', state: 'CT', lat: 41.1865, lng: -73.1952 },
  { name: 'New Haven', state: 'CT', lat: 41.3083, lng: -72.9279 },
  // Delaware
  { name: 'Dover (DE)', state: 'DE', lat: 39.1582, lng: -75.5244 },
  { name: 'Wilmington (DE)', state: 'DE', lat: 39.7447, lng: -75.5484 },
  // Florida
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { name: 'Orlando', state: 'FL', lat: 28.5383, lng: -81.3792 },
  { name: 'Tampa', state: 'FL', lat: 27.9506, lng: -82.4572 },
  { name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557 },
  { name: 'Tallahassee', state: 'FL', lat: 30.4383, lng: -84.2807 },
  { name: 'Fort Myers', state: 'FL', lat: 26.6406, lng: -81.8723 },
  { name: 'Pensacola', state: 'FL', lat: 30.4213, lng: -87.2169 },
  { name: 'Key West', state: 'FL', lat: 24.5551, lng: -81.78 },
  // Georgia
  { name: 'Atlanta', state: 'GA', lat: 33.749, lng: -84.388 },
  { name: 'Savannah', state: 'GA', lat: 32.0809, lng: -81.0912 },
  { name: 'Augusta', state: 'GA', lat: 33.4735, lng: -82.0105 },
  { name: 'Columbus (GA)', state: 'GA', lat: 32.461, lng: -84.9877 },
  { name: 'Macon', state: 'GA', lat: 32.8407, lng: -83.6324 },
  // Hawaii
  { name: 'Honolulu', state: 'HI', lat: 21.3069, lng: -157.8583 },
  { name: 'Hilo', state: 'HI', lat: 19.7297, lng: -155.09 },
  { name: 'Kahului', state: 'HI', lat: 20.8893, lng: -156.4729 },
  // Idaho
  { name: 'Boise', state: 'ID', lat: 43.615, lng: -116.2023 },
  { name: 'Idaho Falls', state: 'ID', lat: 43.4666, lng: -112.0362 },
  { name: "Coeur d'Alene", state: 'ID', lat: 47.6777, lng: -116.7805 },
  // Illinois
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Springfield (IL)', state: 'IL', lat: 39.7817, lng: -89.6501 },
  { name: 'Peoria', state: 'IL', lat: 40.6936, lng: -89.589 },
  { name: 'Rockford', state: 'IL', lat: 42.2711, lng: -89.094 },
  { name: 'Champaign', state: 'IL', lat: 40.1164, lng: -88.2434 },
  // Indiana
  { name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
  { name: 'Fort Wayne', state: 'IN', lat: 41.0793, lng: -85.1394 },
  { name: 'South Bend', state: 'IN', lat: 41.6764, lng: -86.252 },
  { name: 'Evansville', state: 'IN', lat: 37.9716, lng: -87.5711 },
  // Iowa
  { name: 'Des Moines', state: 'IA', lat: 41.5868, lng: -93.625 },
  { name: 'Sioux City', state: 'IA', lat: 42.4999, lng: -96.4003 },
  { name: 'Cedar Rapids', state: 'IA', lat: 41.9779, lng: -91.6656 },
  { name: 'Davenport', state: 'IA', lat: 41.5236, lng: -90.5776 },
  { name: 'Dubuque', state: 'IA', lat: 42.5006, lng: -90.6646 },
  // Kansas
  { name: 'Wichita', state: 'KS', lat: 37.6872, lng: -97.3301 },
  { name: 'Topeka', state: 'KS', lat: 39.0473, lng: -95.6752 },
  { name: 'Overland Park', state: 'KS', lat: 38.9822, lng: -94.6708 },
  { name: 'Salina', state: 'KS', lat: 38.8403, lng: -97.6114 },
  // Kentucky
  { name: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585 },
  { name: 'Lexington', state: 'KY', lat: 38.0406, lng: -84.5037 },
  { name: 'Bowling Green (KY)', state: 'KY', lat: 36.9685, lng: -86.4808 },
  // Louisiana
  { name: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
  { name: 'Baton Rouge', state: 'LA', lat: 30.4515, lng: -91.1871 },
  { name: 'Shreveport', state: 'LA', lat: 32.5252, lng: -93.7502 },
  { name: 'Lafayette (LA)', state: 'LA', lat: 30.2241, lng: -92.0198 },
  // Maine
  { name: 'Portland (ME)', state: 'ME', lat: 43.6591, lng: -70.2568 },
  { name: 'Bangor', state: 'ME', lat: 44.8016, lng: -68.7712 },
  { name: 'Augusta (ME)', state: 'ME', lat: 44.3106, lng: -69.7795 },
  // Maryland
  { name: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122 },
  { name: 'Annapolis', state: 'MD', lat: 38.9784, lng: -76.4922 },
  { name: 'Frederick (MD)', state: 'MD', lat: 39.4143, lng: -77.4105 },
  // Massachusetts
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  { name: 'Worcester', state: 'MA', lat: 42.2626, lng: -71.8023 },
  { name: 'Springfield (MA)', state: 'MA', lat: 42.1015, lng: -72.5898 },
  { name: 'Barnstable (Cape Cod)', state: 'MA', lat: 41.7003, lng: -70.3002 },
  // Michigan
  { name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458 },
  { name: 'Grand Rapids', state: 'MI', lat: 42.9634, lng: -85.6681 },
  { name: 'Lansing', state: 'MI', lat: 42.7325, lng: -84.5555 },
  { name: 'Flint', state: 'MI', lat: 43.0125, lng: -83.6875 },
  { name: 'Marquette', state: 'MI', lat: 46.5436, lng: -87.3954 },
  // Minnesota — the app's home turf, deliberately denser
  { name: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.265 },
  { name: 'Saint Paul', state: 'MN', lat: 44.9537, lng: -93.09 },
  { name: 'Duluth', state: 'MN', lat: 46.7867, lng: -92.1005 },
  { name: 'Rochester (MN)', state: 'MN', lat: 44.0121, lng: -92.4802 },
  { name: 'St. Cloud', state: 'MN', lat: 45.5579, lng: -94.1632 },
  { name: 'Mankato', state: 'MN', lat: 44.1636, lng: -93.9994 },
  { name: 'Bemidji', state: 'MN', lat: 47.4737, lng: -94.8803 },
  { name: 'International Falls', state: 'MN', lat: 48.6011, lng: -93.4108 },
  { name: 'Alexandria (MN)', state: 'MN', lat: 45.885, lng: -95.3775 },
  { name: 'Marshall (MN)', state: 'MN', lat: 44.4469, lng: -95.7889 },
  { name: 'Winona', state: 'MN', lat: 44.0499, lng: -91.6393 },
  { name: 'Brainerd', state: 'MN', lat: 46.358, lng: -94.2008 },
  { name: 'Moorhead', state: 'MN', lat: 46.8738, lng: -96.7678 },
  { name: 'Hibbing', state: 'MN', lat: 47.4272, lng: -92.9377 },
  { name: 'Red Wing', state: 'MN', lat: 44.5619, lng: -92.5335 },
  { name: 'Austin (MN)', state: 'MN', lat: 43.6666, lng: -92.9746 },
  { name: 'Willmar', state: 'MN', lat: 45.122, lng: -95.0433 },
  { name: 'Hutchinson (MN)', state: 'MN', lat: 44.8891, lng: -94.3688 },
  { name: 'Worthington (MN)', state: 'MN', lat: 43.62, lng: -95.5964 },
  { name: 'Virginia (MN)', state: 'MN', lat: 47.5227, lng: -92.5366 },
  { name: 'Fergus Falls', state: 'MN', lat: 46.2833, lng: -96.0776 },
  { name: 'Owatonna', state: 'MN', lat: 44.0836, lng: -93.2261 },
  { name: 'Fairmont (MN)', state: 'MN', lat: 43.6522, lng: -94.4197 },
  { name: 'Cloquet', state: 'MN', lat: 46.7221, lng: -92.4593 },
  // Twin Cities metro suburbs — the immediate metro area (this app's
  // default view) has enough sprawl that the outer-MN cities above leave a
  // conspicuous gap right where most users are actually looking.
  { name: 'Bloomington (MN)', state: 'MN', lat: 44.8408, lng: -93.2983 },
  { name: 'Eagan', state: 'MN', lat: 44.8041, lng: -93.1669 },
  { name: 'Burnsville', state: 'MN', lat: 44.7677, lng: -93.2777 },
  { name: 'Shakopee', state: 'MN', lat: 44.7974, lng: -93.5269 },
  { name: 'Edina', state: 'MN', lat: 44.8897, lng: -93.3499 },
  { name: 'Plymouth (MN)', state: 'MN', lat: 45.0105, lng: -93.4555 },
  { name: 'Minnetonka', state: 'MN', lat: 44.9133, lng: -93.4687 },
  { name: 'Brooklyn Park', state: 'MN', lat: 45.0941, lng: -93.3563 },
  { name: 'Coon Rapids', state: 'MN', lat: 45.1732, lng: -93.303 },
  { name: 'Woodbury', state: 'MN', lat: 44.9239, lng: -92.9594 },
  { name: 'Maple Grove', state: 'MN', lat: 45.0725, lng: -93.4557 },
  { name: 'Eden Prairie', state: 'MN', lat: 44.8547, lng: -93.4708 },
  { name: 'Blaine', state: 'MN', lat: 45.1608, lng: -93.2349 },
  { name: 'Lakeville', state: 'MN', lat: 44.6497, lng: -93.2427 },
  { name: 'Maplewood', state: 'MN', lat: 44.953, lng: -92.9961 },
  { name: 'Roseville', state: 'MN', lat: 45.0061, lng: -93.1566 },
  { name: 'Richfield', state: 'MN', lat: 44.8833, lng: -93.2831 },
  { name: 'Cottage Grove (MN)', state: 'MN', lat: 44.8277, lng: -92.9438 },
  { name: 'Inver Grove Heights', state: 'MN', lat: 44.8483, lng: -93.0424 },
  { name: 'Andover', state: 'MN', lat: 45.2333, lng: -93.2913 },
  { name: 'White Bear Lake', state: 'MN', lat: 45.0844, lng: -93.0155 },
  { name: 'Stillwater', state: 'MN', lat: 45.0563, lng: -92.806 },
  { name: 'Chanhassen', state: 'MN', lat: 44.8619, lng: -93.5305 },
  { name: 'Savage (MN)', state: 'MN', lat: 44.7794, lng: -93.3402 },
  { name: 'Prior Lake', state: 'MN', lat: 44.7133, lng: -93.4222 },
  { name: 'Apple Valley', state: 'MN', lat: 44.7319, lng: -93.2177 },
  { name: 'Champlin', state: 'MN', lat: 45.1911, lng: -93.3941 },
  { name: 'Anoka', state: 'MN', lat: 45.1977, lng: -93.3874 },
  { name: 'Forest Lake', state: 'MN', lat: 45.2775, lng: -92.9866 },
  { name: 'Elk River', state: 'MN', lat: 45.3038, lng: -93.5672 },
  // Mississippi
  { name: 'Jackson (MS)', state: 'MS', lat: 32.2988, lng: -90.1848 },
  { name: 'Gulfport', state: 'MS', lat: 30.3674, lng: -89.0928 },
  { name: 'Hattiesburg', state: 'MS', lat: 31.3271, lng: -89.2903 },
  // Missouri
  { name: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786 },
  { name: 'St. Louis', state: 'MO', lat: 38.627, lng: -90.1994 },
  { name: 'Springfield (MO)', state: 'MO', lat: 37.209, lng: -93.2923 },
  { name: 'Columbia (MO)', state: 'MO', lat: 38.9517, lng: -92.3341 },
  // Montana
  { name: 'Billings', state: 'MT', lat: 45.7833, lng: -108.5007 },
  { name: 'Helena', state: 'MT', lat: 46.5891, lng: -112.0391 },
  { name: 'Missoula', state: 'MT', lat: 46.8721, lng: -113.994 },
  { name: 'Great Falls', state: 'MT', lat: 47.5053, lng: -111.3008 },
  { name: 'Bozeman', state: 'MT', lat: 45.677, lng: -111.0429 },
  // Nebraska
  { name: 'Omaha', state: 'NE', lat: 41.2565, lng: -95.9345 },
  { name: 'Lincoln (NE)', state: 'NE', lat: 40.8136, lng: -96.7026 },
  { name: 'Grand Island (NE)', state: 'NE', lat: 40.9264, lng: -98.342 },
  { name: 'North Platte', state: 'NE', lat: 41.1239, lng: -100.7654 },
  // Nevada
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  { name: 'Reno', state: 'NV', lat: 39.5296, lng: -119.8138 },
  { name: 'Carson City', state: 'NV', lat: 39.1638, lng: -119.7674 },
  { name: 'Elko', state: 'NV', lat: 40.8324, lng: -115.7631 },
  // New Hampshire
  { name: 'Manchester (NH)', state: 'NH', lat: 42.9956, lng: -71.4548 },
  { name: 'Concord (NH)', state: 'NH', lat: 43.2081, lng: -71.5376 },
  { name: 'Nashua', state: 'NH', lat: 42.7654, lng: -71.4676 },
  // New Jersey
  { name: 'Newark', state: 'NJ', lat: 40.7357, lng: -74.1724 },
  { name: 'Jersey City', state: 'NJ', lat: 40.7178, lng: -74.0431 },
  { name: 'Trenton', state: 'NJ', lat: 40.2206, lng: -74.7597 },
  { name: 'Atlantic City', state: 'NJ', lat: 39.3643, lng: -74.4229 },
  // New Mexico
  { name: 'Albuquerque', state: 'NM', lat: 35.0844, lng: -106.6504 },
  { name: 'Santa Fe', state: 'NM', lat: 35.687, lng: -105.9378 },
  { name: 'Las Cruces', state: 'NM', lat: 32.3199, lng: -106.7637 },
  { name: 'Roswell', state: 'NM', lat: 33.3943, lng: -104.523 },
  // New York
  { name: 'New York City', state: 'NY', lat: 40.7128, lng: -74.006 },
  { name: 'Buffalo', state: 'NY', lat: 42.8864, lng: -78.8784 },
  { name: 'Albany', state: 'NY', lat: 42.6526, lng: -73.7562 },
  { name: 'Syracuse', state: 'NY', lat: 43.0481, lng: -76.1474 },
  { name: 'Rochester (NY)', state: 'NY', lat: 43.1566, lng: -77.6088 },
  { name: 'Yonkers', state: 'NY', lat: 40.9312, lng: -73.8988 },
  // North Carolina
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { name: 'Raleigh', state: 'NC', lat: 35.7796, lng: -78.6382 },
  { name: 'Greensboro', state: 'NC', lat: 36.0726, lng: -79.792 },
  { name: 'Durham', state: 'NC', lat: 35.994, lng: -78.8986 },
  { name: 'Asheville', state: 'NC', lat: 35.5951, lng: -82.5515 },
  { name: 'Wilmington (NC)', state: 'NC', lat: 34.2257, lng: -77.9447 },
  // North Dakota
  { name: 'Fargo', state: 'ND', lat: 46.8772, lng: -96.7898 },
  { name: 'Bismarck', state: 'ND', lat: 46.8083, lng: -100.7837 },
  { name: 'Grand Forks', state: 'ND', lat: 47.9253, lng: -97.0329 },
  { name: 'Minot', state: 'ND', lat: 48.2325, lng: -101.2963 },
  // Ohio
  { name: 'Columbus (OH)', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { name: 'Cleveland', state: 'OH', lat: 41.4993, lng: -81.6944 },
  { name: 'Cincinnati', state: 'OH', lat: 39.1031, lng: -84.512 },
  { name: 'Toledo', state: 'OH', lat: 41.6528, lng: -83.5379 },
  { name: 'Akron', state: 'OH', lat: 41.0814, lng: -81.519 },
  { name: 'Dayton', state: 'OH', lat: 39.7589, lng: -84.1916 },
  // Oklahoma
  { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164 },
  { name: 'Tulsa', state: 'OK', lat: 36.154, lng: -95.9928 },
  { name: 'Norman', state: 'OK', lat: 35.2226, lng: -97.4395 },
  { name: 'Lawton', state: 'OK', lat: 34.6087, lng: -98.3903 },
  // Oregon
  { name: 'Portland (OR)', state: 'OR', lat: 45.5152, lng: -122.6784 },
  { name: 'Salem (OR)', state: 'OR', lat: 44.9429, lng: -123.0351 },
  { name: 'Eugene', state: 'OR', lat: 44.0521, lng: -123.0868 },
  { name: 'Bend', state: 'OR', lat: 44.0582, lng: -121.3153 },
  { name: 'Medford', state: 'OR', lat: 42.3265, lng: -122.8756 },
  // Pennsylvania
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { name: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959 },
  { name: 'Allentown', state: 'PA', lat: 40.6084, lng: -75.4902 },
  { name: 'Erie (PA)', state: 'PA', lat: 42.1292, lng: -80.0851 },
  { name: 'Harrisburg', state: 'PA', lat: 40.2732, lng: -76.8867 },
  // Rhode Island
  { name: 'Providence', state: 'RI', lat: 41.824, lng: -71.4128 },
  { name: 'Warwick (RI)', state: 'RI', lat: 41.7001, lng: -71.4162 },
  { name: 'Newport (RI)', state: 'RI', lat: 41.4901, lng: -71.3128 },
  // South Carolina
  { name: 'Columbia (SC)', state: 'SC', lat: 34.0007, lng: -81.0348 },
  { name: 'Charleston (SC)', state: 'SC', lat: 32.7765, lng: -79.9311 },
  { name: 'Greenville (SC)', state: 'SC', lat: 34.8526, lng: -82.394 },
  { name: 'Myrtle Beach', state: 'SC', lat: 33.6891, lng: -78.8867 },
  // South Dakota
  { name: 'Sioux Falls', state: 'SD', lat: 43.5446, lng: -96.7311 },
  { name: 'Rapid City', state: 'SD', lat: 44.0805, lng: -103.231 },
  { name: 'Aberdeen (SD)', state: 'SD', lat: 45.4647, lng: -98.4865 },
  { name: 'Pierre (SD)', state: 'SD', lat: 44.3683, lng: -100.3509 },
  // Tennessee
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.049 },
  { name: 'Knoxville', state: 'TN', lat: 35.9606, lng: -83.9207 },
  { name: 'Chattanooga', state: 'TN', lat: 35.0456, lng: -85.3097 },
  // Texas
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.797 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { name: 'Fort Worth', state: 'TX', lat: 32.7555, lng: -97.3308 },
  { name: 'El Paso', state: 'TX', lat: 31.7619, lng: -106.485 },
  { name: 'Lubbock', state: 'TX', lat: 33.5779, lng: -101.8552 },
  { name: 'Amarillo', state: 'TX', lat: 35.222, lng: -101.8313 },
  { name: 'Corpus Christi', state: 'TX', lat: 27.8006, lng: -97.3964 },
  { name: 'Laredo', state: 'TX', lat: 27.5306, lng: -99.4803 },
  { name: 'Brownsville', state: 'TX', lat: 25.9018, lng: -97.4975 },
  { name: 'Midland (TX)', state: 'TX', lat: 31.9974, lng: -102.0779 },
  // Utah
  { name: 'Salt Lake City', state: 'UT', lat: 40.7608, lng: -111.891 },
  { name: 'Provo', state: 'UT', lat: 40.2338, lng: -111.6585 },
  { name: 'St. George (UT)', state: 'UT', lat: 37.0965, lng: -113.5684 },
  { name: 'Ogden', state: 'UT', lat: 41.223, lng: -111.9738 },
  // Vermont
  { name: 'Burlington (VT)', state: 'VT', lat: 44.4759, lng: -73.2121 },
  { name: 'Montpelier', state: 'VT', lat: 44.2601, lng: -72.5754 },
  { name: 'Rutland (VT)', state: 'VT', lat: 43.6106, lng: -72.9726 },
  // Virginia
  { name: 'Richmond', state: 'VA', lat: 37.5407, lng: -77.436 },
  { name: 'Virginia Beach', state: 'VA', lat: 36.8529, lng: -75.978 },
  { name: 'Norfolk', state: 'VA', lat: 36.8508, lng: -76.2859 },
  { name: 'Roanoke', state: 'VA', lat: 37.271, lng: -79.9414 },
  { name: 'Charlottesville', state: 'VA', lat: 38.0293, lng: -78.4767 },
  // Washington
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Spokane', state: 'WA', lat: 47.6588, lng: -117.426 },
  { name: 'Tacoma', state: 'WA', lat: 47.2529, lng: -122.4443 },
  { name: 'Olympia', state: 'WA', lat: 47.0379, lng: -122.9007 },
  { name: 'Vancouver (WA)', state: 'WA', lat: 45.6387, lng: -122.6615 },
  { name: 'Yakima', state: 'WA', lat: 46.6021, lng: -120.5059 },
  // Washington, D.C.
  { name: 'Washington, D.C.', state: 'DC', lat: 38.9072, lng: -77.0369 },
  // West Virginia
  { name: 'Charleston (WV)', state: 'WV', lat: 38.3498, lng: -81.6326 },
  { name: 'Huntington (WV)', state: 'WV', lat: 38.4192, lng: -82.4452 },
  { name: 'Morgantown', state: 'WV', lat: 39.6295, lng: -79.9559 },
  // Wisconsin
  { name: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065 },
  { name: 'Madison', state: 'WI', lat: 43.0731, lng: -89.4012 },
  { name: 'Eau Claire', state: 'WI', lat: 44.8113, lng: -91.4985 },
  { name: 'La Crosse', state: 'WI', lat: 43.8014, lng: -91.2396 },
  { name: 'Green Bay', state: 'WI', lat: 44.5133, lng: -88.0133 },
  { name: 'Kenosha', state: 'WI', lat: 42.5847, lng: -87.8212 },
  // Wyoming
  { name: 'Cheyenne', state: 'WY', lat: 41.14, lng: -104.8202 },
  { name: 'Casper', state: 'WY', lat: 42.8501, lng: -106.3252 },
  { name: 'Jackson (WY)', state: 'WY', lat: 43.4799, lng: -110.7624 },
];

/** Cities from US_CITIES whose coordinates fall within `bounds`, capped to `cap`. */
export function citiesInBounds(bounds: LatLngBounds, cap: number): WeatherMapPoint[] {
  const inBounds = US_CITIES.filter(
    (c) => c.lat <= bounds.north && c.lat >= bounds.south && c.lng <= bounds.east && c.lng >= bounds.west,
  );
  return inBounds.length <= cap ? inBounds : inBounds.slice(0, cap);
}
