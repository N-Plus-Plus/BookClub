/** Presentation only: round the wait up to whole minutes and omit empty units. */
export function formatRetryDuration(seconds: number): string {
  const totalMinutes = Math.ceil(seconds/60);
  const hours = Math.floor(totalMinutes/60), minutes = totalMinutes%60;
  return [hours ? `${hours} hr` : '',minutes ? `${minutes} min` : ''].filter(Boolean).join(' ');
}
