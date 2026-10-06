/** Minimal provider-title validation; preserve supplied spelling and punctuation. */
export function usableTitle(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.trim() !== 'N/A' ? value.trim() : null;
}
