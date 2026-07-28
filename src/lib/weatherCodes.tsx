import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  ThermometerSun,
  type LucideIcon,
} from 'lucide-react';

/**
 * Open-Meteo's `weather_code` follows the WMO code table (same values used by
 * most national weather services). Grouped down to the handful of icons/
 * labels this UI actually distinguishes.
 */
export function getWeatherVisual(code: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: 'Clear sky', Icon: Sun };
  if (code === 1 || code === 2) return { label: 'Partly cloudy', Icon: CloudSun };
  if (code === 3) return { label: 'Overcast', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Foggy', Icon: CloudFog };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', Icon: CloudDrizzle };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorms', Icon: CloudLightning };
  return { label: 'Cloudy', Icon: Cloud };
}

/** Overrides the code-based icon during an active heat alert — the heat itself is the story, not whether it's sunny or hazy. */
export const HEAT_ALERT_ICON: LucideIcon = ThermometerSun;
