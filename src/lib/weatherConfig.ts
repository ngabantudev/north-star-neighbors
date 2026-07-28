// Single source of truth for how often weather data refreshes: how long the
// server caches upstream Open-Meteo/NWS responses, and how often clients
// poll for new data. Current-conditions data doesn't actually update more
// than roughly hourly under the hood, and temperature rarely moves more than
// a couple degrees in 15 minutes — fast enough to gauge a heat wave
// building, without hammering either API.
export const WEATHER_REFRESH_SECONDS = 15 * 60;
export const WEATHER_REFRESH_MS = WEATHER_REFRESH_SECONDS * 1000;
