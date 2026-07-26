/** 120min -> "2 hr"; 95min -> "1 hr 35 min"; 45min -> "45 min"; under 10min -> "9:45" mm:ss. */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '0:00';
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 10) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
