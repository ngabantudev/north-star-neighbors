'use client';

import { getWeatherVisual, HEAT_ALERT_ICON } from '@/lib/weatherCodes';
import { NavTab } from '@/components/NavTab';
import type { WeatherPayload } from '@/app/api/weather/route';

interface WeatherToggleProps {
  weather: WeatherPayload | null;
  /** Whether the temperature map overlay is currently shown. */
  active: boolean;
  onToggle: () => void;
  /** Vertical icon+label tab for the mobile bottom nav, instead of the header pill. */
  compact?: boolean;
}

/**
 * Toggles the temperature map overlay (see TemperatureLayer.tsx) on/off —
 * same on/off-button idiom as the rest of the map controls, rather
 * than opening a summary popover. Still shows current temp on the button
 * itself, and a red dot when the National Weather Service has an actual
 * Heat Advisory / Excessive Heat Warning active for this location.
 */
export function WeatherToggle({ weather, active, onToggle, compact = false }: WeatherToggleProps) {
  const hasHeatAlert = !!weather?.heatAlert;
  const { Icon: ConditionIcon } = getWeatherVisual(weather?.code ?? -1);
  const Icon = hasHeatAlert ? HEAT_ALERT_ICON : ConditionIcon;
  const tempLabel = weather?.tempF != null ? `${Math.round(weather.tempF)}°` : '--°';
  const label = hasHeatAlert ? `Weather: ${weather?.heatAlert?.event} in effect` : `Weather: ${tempLabel}`;

  if (compact) {
    return <NavTab icon={Icon} label="Weather" active={active} badge={hasHeatAlert} onClick={onToggle} aria-label={label} />;
  }

  return (
    <button
      onClick={onToggle}
      aria-label={label}
      aria-pressed={active}
      className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm transition-transform active:scale-95 ${
        active ? 'bg-white text-mn-blue' : 'bg-white/90 text-mn-blue'
      }`}
    >
      <Icon size={16} color={hasHeatAlert ? '#dc2626' : '#0062b2'} strokeWidth={2.25} />
      <span className="font-medium">{tempLabel}</span>
      {hasHeatAlert && (
        <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-mn-blue" />
      )}
    </button>
  );
}
