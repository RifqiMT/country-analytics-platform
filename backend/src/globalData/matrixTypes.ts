/** Country × year numeric grid for one metric (iso3 upper-case keys). */
export type YearIsoMatrix = Map<number, Map<string, number | null>>;

export function emptyYearIsoMatrix(startYear: number, endYear: number): YearIsoMatrix {
  const m: YearIsoMatrix = new Map();
  for (let y = startYear; y <= endYear; y++) m.set(y, new Map());
  return m;
}

/** Fill null / missing cells in `base` from `fill` (does not overwrite finite values). */
export function mergeMatrixFill(base: YearIsoMatrix, fill: YearIsoMatrix): YearIsoMatrix {
  for (const [year, byIso] of fill) {
    if (!base.has(year)) base.set(year, new Map());
    const dest = base.get(year)!;
    for (const [iso, v] of byIso) {
      if (v === null || !Number.isFinite(v)) continue;
      const cur = dest.get(iso);
      if (cur === null || cur === undefined || !Number.isFinite(cur)) {
        dest.set(iso, v);
      }
    }
  }
  return base;
}

export function matrixFromYearRows(
  byYear: Map<number, Array<{ countryIso3: string; value: number | null }>>,
  startYear: number,
  endYear: number
): YearIsoMatrix {
  const out = emptyYearIsoMatrix(startYear, endYear);
  for (let y = startYear; y <= endYear; y++) {
    const rows = byYear.get(y) ?? [];
    const dest = out.get(y)!;
    for (const r of rows) {
      const iso = r.countryIso3.toUpperCase();
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      dest.set(iso, r.value);
    }
  }
  return out;
}

export function countFiniteInMatrix(matrix: YearIsoMatrix): number {
  let n = 0;
  for (const byIso of matrix.values()) {
    for (const v of byIso.values()) {
      if (v !== null && Number.isFinite(v)) n += 1;
    }
  }
  return n;
}
