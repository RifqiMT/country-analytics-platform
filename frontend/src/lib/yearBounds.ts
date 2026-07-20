/** Upper bound for year pickers and WDI ranges (today’s calendar year). */
export function maxSelectableYear(): number {
  return new Date().getFullYear();
}

export const MIN_DATA_YEAR = 2000;

/** Single year in a picker: [MIN_DATA_YEAR, maxSelectableYear()]. */
export function clampPickerYear(y: number): number {
  const maxY = maxSelectableYear();
  const v = Math.floor(y);
  if (!Number.isFinite(v)) return maxY;
  return Math.min(Math.max(v, MIN_DATA_YEAR), maxY);
}

/** Range “from” field: stays ≤ end and within bounds. */
export function clampSpanStart(raw: number, end: number): number {
  const maxY = maxSelectableYear();
  let v = Math.floor(raw);
  if (!Number.isFinite(v)) v = MIN_DATA_YEAR;
  const hi = Math.min(Math.max(end, MIN_DATA_YEAR), maxY);
  return Math.min(Math.max(v, MIN_DATA_YEAR), hi);
}

/** Range “to” field: stays ≥ start and within bounds. */
export function clampSpanEnd(raw: number, start: number): number {
  const maxY = maxSelectableYear();
  let v = Math.floor(raw);
  if (!Number.isFinite(v)) v = maxY;
  const lo = Math.min(Math.max(start, MIN_DATA_YEAR), maxY);
  return Math.min(Math.max(v, lo), maxY);
}
