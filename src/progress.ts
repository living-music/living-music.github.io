export function projectedPlaybackTime(
  currentTime: number,
  elapsedMilliseconds: number,
  duration: number,
): number {
  const projected = Math.max(0, currentTime + Math.max(0, elapsedMilliseconds) / 1_000);
  return duration > 0 ? Math.min(projected, duration) : projected;
}
