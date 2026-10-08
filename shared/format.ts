const wholeNumber = new Intl.NumberFormat('en-AU', {maximumFractionDigits: 0});

/** Presentation only: never use formatted counts as calculation or persistence inputs. */
export const formatCount = (value: number) => wholeNumber.format(value);

/** Quota headers remain opaque when they are not safe whole-number counts. */
export function formatCountText(value: string) {
  const count = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(count) ? formatCount(count) : value;
}
