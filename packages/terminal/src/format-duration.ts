export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 1) return `${String(Math.round(seconds * 1000))}ms`;
  return `${seconds.toFixed(1)}s`;
}
