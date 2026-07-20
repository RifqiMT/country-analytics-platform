import type { CountrySummary } from "./restCountries.js";
import { listCountries } from "./restCountries.js";
import {
  fetchGlobalYearSnapshot,
  fetchWdiGlobalRowsForYear,
  type GlobalRow,
} from "./globalSnapshot.js";
import { METRIC_BY_ID } from "./metrics.js";
import { getMetricShortLabel } from "./metricShortLabels.js";
import { MIN_DATA_YEAR, resolveGlobalWdiYear } from "./yearBounds.js";
import { fetchWikidataGovernmentMap } from "./wikidataGovernmentMap.js";
import { resolveEezSqKmMap } from "./eezResolve.js";
import { fetchMetricSeriesForCountry } from "./worldBank.js";

export type TableCategory = "general" | "financial" | "health" | "education" | "crime";

export interface TableColumn {
  id: string;
  label: string;
  /** 'text' | 'number' | 'percent' — affects YoY display */
  format: "text" | "number" | "percent";
  /** Use basis points for YoY delta when true */
  yoyBps: boolean;
  description?: string;
}

interface TableCell {
  value: number | null;
  yoyPct: number | null;
  yoyBps: number | null;
}

export interface TableRow {
  iso3: string;
  name: string;
  flagPng?: string;
  cells: Record<string, string | TableCell>;
}

function headFromGov(gov?: string): string {
  if (!gov) return "";
  const s = gov.toLowerCase();
  if (s.includes("parliamentary")) return "Prime Minister";
  if (s.includes("constitutional monarchy") || s.includes("monarchy")) return "Monarch";
  if (s.includes("republic") || s.includes("presidential")) return "President";
  if (s.includes("federation") || s.includes("federal")) return "Head of government";
  return "";
}

function snapshotToMap(rows: GlobalRow[]): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const r of rows) m.set(r.countryIso3.toUpperCase(), r.value);
  return m;
}

type PickObs = { value: number | null; ladderIndex: number };

/** Every metric tab walks WDI from `dataYear` back to `MIN_DATA_YEAR` per cell. */
function fullWdiLadderYears(dataYear: number): number[] {
  const maxSteps = dataYear - MIN_DATA_YEAR + 1;
  const out: number[] = [];
  for (let i = 0; i < maxSteps && dataYear - i >= MIN_DATA_YEAR; i++) {
    out.push(dataYear - i);
  }
  return out;
}

function isFiniteMetric(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

function firstPerCapitaAtOrAfter(
  iso3: string,
  gdpIdx: number,
  popIdx: number,
  startLi: number,
  metricMaps: Map<string, number | null>[][]
): { value: number; li: number } | null {
  const iso = iso3.toUpperCase();
  for (let li = startLi; li < metricMaps.length; li++) {
    const g = metricMaps[li][gdpIdx].get(iso);
    const p = metricMaps[li][popIdx].get(iso);
    if (isFiniteMetric(g) && isFiniteMetric(p) && p !== 0) {
      return { value: g / p, li };
    }
  }
  return null;
}

function firstDebtUsdFromPartsAtOrAfter(
  iso3: string,
  pctIdx: number,
  gdpIdx: number,
  startLi: number,
  metricMaps: Map<string, number | null>[][]
): { value: number; li: number } | null {
  const iso = iso3.toUpperCase();
  for (let li = startLi; li < metricMaps.length; li++) {
    const pct = metricMaps[li][pctIdx].get(iso);
    const gdp = metricMaps[li][gdpIdx].get(iso);
    if (isFiniteMetric(pct) && isFiniteMetric(gdp)) {
      return { value: (pct / 100) * gdp, li };
    }
  }
  return null;
}

/**
 * After WDI ladder picks, fill remaining gaps using same-calendar-year pairs in the ladder
 * (GDP ÷ population; GDP PPP ÷ population; debt % × nominal GDP).
 */
function applyFinancialDerivedFills(
  rows: TableRow[],
  metricMaps: Map<string, number | null>[][],
  fetchIds: string[],
  columns: TableColumn[]
): void {
  const idx = (id: string) => fetchIds.indexOf(id);
  const popI = idx("population");
  const gdpI = idx("gdp");
  const gdpPppI = idx("gdp_ppp");
  const pctI = idx("gov_debt_pct_gdp");

  for (const row of rows) {
    const cells = row.cells as Record<string, TableCell>;
    const iso = row.iso3;

    const colYo = (id: string) => columns.find((x) => x.id === id)?.yoyBps ?? false;

    if (popI >= 0 && gdpI >= 0) {
      const cell = cells.gdp_per_capita;
      if (!cell || !isFiniteMetric(cell.value)) {
        const cur = firstPerCapitaAtOrAfter(iso, gdpI, popI, 0, metricMaps);
        if (cur) {
          const prev = firstPerCapitaAtOrAfter(iso, gdpI, popI, cur.li + 1, metricMaps);
          const yo = yoy(cur.value, prev?.value ?? null, colYo("gdp_per_capita"));
          cells.gdp_per_capita = { value: cur.value, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
        }
      }
    }

    if (popI >= 0 && gdpPppI >= 0) {
      const cell = cells.gdp_per_capita_ppp;
      if (!cell || !isFiniteMetric(cell.value)) {
        const cur = firstPerCapitaAtOrAfter(iso, gdpPppI, popI, 0, metricMaps);
        if (cur) {
          const prev = firstPerCapitaAtOrAfter(iso, gdpPppI, popI, cur.li + 1, metricMaps);
          const yo = yoy(cur.value, prev?.value ?? null, colYo("gdp_per_capita_ppp"));
          cells.gdp_per_capita_ppp = { value: cur.value, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
        }
      }
    }

    if (pctI >= 0 && gdpI >= 0) {
      const cell = cells.gov_debt_usd;
      if (!cell || !isFiniteMetric(cell.value)) {
        const cur = firstDebtUsdFromPartsAtOrAfter(iso, pctI, gdpI, 0, metricMaps);
        if (cur) {
          const prev = firstDebtUsdFromPartsAtOrAfter(iso, pctI, gdpI, cur.li + 1, metricMaps);
          const yo = yoy(cur.value, prev?.value ?? null, colYo("gov_debt_usd"));
          cells.gov_debt_usd = { value: cur.value, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
        }
      }
    }
  }
}

function clampPopulationSharePct(x: number): number {
  return Math.min(100, Math.max(0, x));
}

/** When exactly one of the three age-band shares is missing at ladder year `li`, derive it as 100 − other two. */
function deriveMissingAgeShareAtLi(
  iso3: string,
  li: number,
  i014: number,
  i1564: number,
  i65: number,
  metricMaps: Map<string, number | null>[][]
): { id: "pop_age_0_14" | "pop_15_64_pct" | "pop_age_65_plus"; value: number } | null {
  const iso = iso3.toUpperCase();
  const a = metricMaps[li][i014].get(iso);
  const b = metricMaps[li][i1564].get(iso);
  const c = metricMaps[li][i65].get(iso);
  const fa = isFiniteMetric(a);
  const fb = isFiniteMetric(b);
  const fc = isFiniteMetric(c);
  const nMiss = (!fa ? 1 : 0) + (!fb ? 1 : 0) + (!fc ? 1 : 0);
  if (nMiss !== 1) return null;
  let raw: number;
  let id: "pop_age_0_14" | "pop_15_64_pct" | "pop_age_65_plus";
  if (!fa) {
    id = "pop_age_0_14";
    raw = 100 - (b as number) - (c as number);
  } else if (!fb) {
    id = "pop_15_64_pct";
    raw = 100 - (a as number) - (c as number);
  } else {
    id = "pop_age_65_plus";
    raw = 100 - (a as number) - (b as number);
  }
  if (!Number.isFinite(raw) || raw < -1 || raw > 101) return null;
  return { id, value: clampPopulationSharePct(raw) };
}

function firstAgeDeriveForTarget(
  iso3: string,
  targetId: "pop_age_0_14" | "pop_15_64_pct" | "pop_age_65_plus",
  i014: number,
  i1564: number,
  i65: number,
  startLi: number,
  metricMaps: Map<string, number | null>[][]
): { value: number; li: number } | null {
  for (let li = startLi; li < metricMaps.length; li++) {
    const d = deriveMissingAgeShareAtLi(iso3, li, i014, i1564, i65, metricMaps);
    if (d && d.id === targetId) return { value: d.value, li };
  }
  return null;
}

/**
 * Fill missing population age shares when WDI has the other two bands in the same ladder year (they sum to ~100%).
 */
function applyHealthDerivedFills(
  rows: TableRow[],
  metricMaps: Map<string, number | null>[][],
  fetchIds: string[],
  columns: TableColumn[]
): void {
  const i014 = fetchIds.indexOf("pop_age_0_14");
  const i1564 = fetchIds.indexOf("pop_15_64_pct");
  const i65 = fetchIds.indexOf("pop_age_65_plus");
  if (i014 < 0 || i1564 < 0 || i65 < 0) return;

  const colYo = (id: string) => columns.find((x) => x.id === id)?.yoyBps ?? false;
  const bandIds = ["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"] as const;

  for (const row of rows) {
    const cells = row.cells as Record<string, TableCell>;
    const iso = row.iso3;
    for (const mid of bandIds) {
      const cell = cells[mid];
      if (cell && isFiniteMetric(cell.value)) continue;
      const cur = firstAgeDeriveForTarget(iso, mid, i014, i1564, i65, 0, metricMaps);
      if (!cur) continue;
      const prev = firstAgeDeriveForTarget(iso, mid, i014, i1564, i65, cur.li + 1, metricMaps);
      const yo = yoy(cur.value, prev?.value ?? null, colYo(mid));
      cells[mid] = { value: cur.value, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
    }
  }
}

/** WDI enrollment series used only to approximate OOSC when direct OOSC + UIS are still null (same ladder year). */
const EDU_OOSC_ENROLL_BY_COL = [
  { col: "oosc_primary" as const, wdiCode: "SE.PRM.NENR" },
  { col: "oosc_secondary" as const, wdiCode: "SE.SEC.NENR" },
  { col: "oosc_tertiary" as const, wdiCode: "SE.TER.ENRR" },
];

function ooscProxyFromEnrollmentPct(enrollmentPct: number): number {
  const e = Math.min(100, Math.max(0, enrollmentPct));
  return clampPopulationSharePct(100 - e);
}

async function buildEducationOoscProxyMaps(
  ladderYears: number[]
): Promise<Map<string, number | null>[][]> {
  const snaps = await Promise.all(
    ladderYears.map((y) =>
      Promise.all(EDU_OOSC_ENROLL_BY_COL.map((x) => fetchWdiGlobalRowsForYear(x.wdiCode, y)))
    )
  );
  return snaps.map((perY) => perY.map((rws) => snapshotToMap(rws)));
}

function applyEducationOoscProxyFills(
  rows: TableRow[],
  ooscProxyMaps: Map<string, number | null>[][],
  columns: TableColumn[]
): void {
  const colYo = (id: string) => columns.find((x) => x.id === id)?.yoyBps ?? false;

  const proxyAt = (iso: string, li: number, dim: number): number | null => {
    const e = ooscProxyMaps[li][dim].get(iso.toUpperCase());
    if (!isFiniteMetric(e)) return null;
    return ooscProxyFromEnrollmentPct(e);
  };

  for (const row of rows) {
    const cells = row.cells as Record<string, TableCell>;
    const iso = row.iso3;
    EDU_OOSC_ENROLL_BY_COL.forEach((spec, dim) => {
      const cell = cells[spec.col];
      if (cell && isFiniteMetric(cell.value)) return;
      for (let li = 0; li < ooscProxyMaps.length; li++) {
        const v = proxyAt(iso, li, dim);
        if (v === null) continue;
        let prevVal: number | null = null;
        for (let lj = li + 1; lj < ooscProxyMaps.length; lj++) {
          const p = proxyAt(iso, lj, dim);
          if (p !== null) {
            prevVal = p;
            break;
          }
        }
        const yo = yoy(v, prevVal, colYo(spec.col));
        cells[spec.col] = { value: v, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
        return;
      }
    });
  }
}

function pickObservation(
  iso3: string,
  metricIndex: number,
  startLadderIndex: number,
  metricMaps: Map<string, number | null>[][]
): PickObs {
  const iso = iso3.toUpperCase();
  for (let li = startLadderIndex; li < metricMaps.length; li++) {
    const v = metricMaps[li][metricIndex].get(iso);
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      return { value: v, ladderIndex: li };
    }
  }
  return { value: null, ladderIndex: -1 };
}

function yoy(
  cur: number | null,
  prev: number | null,
  yoyBps: boolean
): { yoyPct: number | null; yoyBps: number | null } {
  if (cur === null || prev === null || Number.isNaN(cur) || Number.isNaN(prev)) {
    return { yoyPct: null, yoyBps: null };
  }
  if (prev === 0) return { yoyPct: null, yoyBps: null };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const bps = (cur - prev) * 100;
  return { yoyPct: pct, yoyBps: yoyBps ? bps : null };
}

async function fillTableMissingFromCountrySeries(
  rows: TableRow[],
  metricIds: string[],
  dataYear: number,
  columns: TableColumn[]
): Promise<void> {
  const colById = new Map(columns.map((c) => [c.id, c] as const));
  const latestAndPrev = (series: Array<{ year: number; value: number | null }>): { cur: number; prev: number | null } | null => {
    let cur: number | null = null;
    let prev: number | null = null;
    let curYear = -Infinity;
    for (let i = series.length - 1; i >= 0; i--) {
      const p = series[i]!;
      if (p.year > dataYear) continue;
      if (p.value === null || !Number.isFinite(p.value)) continue;
      if (cur === null) {
        cur = p.value;
        curYear = p.year;
      } else if (p.year < curYear) {
        prev = p.value;
        break;
      }
    }
    if (cur === null) return null;
    return { cur, prev };
  };

  const tasks: Array<{ row: TableRow; metricId: string }> = [];
  for (const row of rows) {
    for (const mid of metricIds) {
      const cell = row.cells[mid];
      if (!cell || typeof cell === "string" || cell.value === null || Number.isNaN(cell.value)) {
        tasks.push({ row, metricId: mid });
      }
    }
  }
  if (tasks.length === 0) return;

  const promiseByKey = new Map<string, Promise<{ cur: number; prev: number | null } | null>>();
  const getSeriesStats = (iso: string, metricId: string): Promise<{ cur: number; prev: number | null } | null> => {
    const key = `${iso}:${metricId}:${dataYear}`;
    const existing = promiseByKey.get(key);
    if (existing) return existing;
    const p = fetchMetricSeriesForCountry(iso, metricId, MIN_DATA_YEAR, dataYear)
      .then((series) => latestAndPrev(series))
      .catch(() => null);
    promiseByKey.set(key, p);
    return p;
  };

  const concurrency = 16;
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      const t = tasks[i]!;
      const stats = await getSeriesStats(t.row.iso3, t.metricId);
      if (!stats) continue;
      const col = colById.get(t.metricId);
      const yo = yoy(stats.cur, stats.prev, col?.yoyBps ?? false);
      t.row.cells[t.metricId] = { value: stats.cur, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
    }
  };
  await Promise.all(new Array(Math.min(concurrency, Math.max(1, tasks.length))).fill(0).map(worker));
}

const FINANCIAL_METRICS = [
  "gdp",
  "gdp_ppp",
  "gdp_per_capita",
  "gdp_per_capita_ppp",
  "gni_per_capita_atlas",
  "gov_debt_usd",
  "inflation",
  "gov_debt_pct_gdp",
  "lending_rate",
  "unemployment_ilo",
] as const;

const HEALTH_METRICS = [
  "population",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
  "life_expectancy",
  "mortality_under5",
  "maternal_mortality",
  "undernourishment",
  "birth_rate",
  "tb_incidence",
  "uhc_service_coverage",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
] as const;

const EDU_METRICS = [
  "oosc_primary",
  "oosc_secondary",
  "oosc_tertiary",
  "school_primary_completion",
  "completion_secondary",
  "completion_tertiary",
] as const;

const CRIME_METRICS = [
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "gbv_women_pct",
  "idp_conflict_violence",
  "battle_related_deaths",
  "rule_of_law_wgi",
  "political_stability_wgi",
  "corruption_control_wgi",
] as const;

function columnsForCategory(cat: TableCategory): TableColumn[] {
  if (cat === "general") {
    return [
      { id: "region", label: "Region", format: "text", yoyBps: false },
      { id: "government", label: "Government type", format: "text", yoyBps: false },
      { id: "head", label: "Head of government", format: "text", yoyBps: false },
      { id: "area", label: "Total area (km²)", format: "number", yoyBps: false },
      { id: "eez", label: "EEZ (km²)", format: "number", yoyBps: false },
    ];
  }
  if (cat === "financial") {
    return FINANCIAL_METRICS.map((id) => {
      const def = METRIC_BY_ID[id];
      const isRate = ["inflation", "gov_debt_pct_gdp", "lending_rate", "unemployment_ilo"].includes(id);
      return {
        id,
        label: getMetricShortLabel(id),
        format: isRate ? "percent" : "number",
        yoyBps: isRate,
        description: def?.description,
      };
    });
  }
  if (cat === "health") {
    return HEALTH_METRICS.map((id) => {
      const def = METRIC_BY_ID[id];
      const pctMetric = [
        "pop_age_0_14",
        "pop_15_64_pct",
        "pop_age_65_plus",
        "undernourishment",
        "immunization_dpt",
        "immunization_measles",
        "health_expenditure_gdp",
        "smoking_prevalence",
      ].includes(id);
      const yoyBps = pctMetric;
      const numericMetric = [
        "population",
        "maternal_mortality",
        "mortality_under5",
        "life_expectancy",
        "birth_rate",
        "tb_incidence",
        "uhc_service_coverage",
        "hospital_beds",
        "physicians_density",
        "nurses_midwives_density",
      ].includes(id);
      return {
        id,
        label: getMetricShortLabel(id),
        format: numericMetric ? "number" : "percent",
        yoyBps,
        description: def?.description,
      };
    });
  }
  if (cat === "crime") {
    return CRIME_METRICS.map((id) => {
      const def = METRIC_BY_ID[id];
      const pctMetric = ["gbv_women_pct"].includes(id);
      return {
        id,
        label: getMetricShortLabel(id),
        format: pctMetric ? "percent" : "number",
        yoyBps: pctMetric,
        description: def?.description,
      };
    });
  }
  return EDU_METRICS.map((id) => {
    const def = METRIC_BY_ID[id];
    return {
      id,
      label: getMetricShortLabel(id),
      format: "percent",
      yoyBps: true,
      description: def?.description,
    };
  });
}

export async function buildGlobalTable(
  requestedYear: number,
  region: string,
  category: TableCategory
): Promise<{
  requestedYear: number;
  dataYear: number;
  category: TableCategory;
  columns: TableColumn[];
  rows: TableRow[];
  /** WDI calendar years scanned per cell (1 = headline year only). */
  wdiLookbackYears: number;
}> {
  const dataYear = resolveGlobalWdiYear(requestedYear);
  const all = await listCountries();
  let countries = all.filter((c) => /^[A-Z]{3}$/.test(c.cca3));
  if (region && region !== "All" && region !== "all") {
    countries = countries.filter((c) => c.region === region);
  }
  countries.sort((a, b) => a.name.localeCompare(b.name));

  const columns = columnsForCategory(category);

  if (category === "general") {
    const [wdMap, eezMap] = await Promise.all([
      fetchWikidataGovernmentMap(),
      resolveEezSqKmMap(countries),
    ]);
    const rows: TableRow[] = countries.map((c) => {
      const iso = c.cca3.toUpperCase();
      const wd = wdMap.get(iso);
      const fromRest = c.government?.trim();
      const fromWd = wd?.government?.trim();
      const government =
        fromRest && fromRest.length > 0
          ? fromRest
          : fromWd && fromWd.length > 0
            ? fromWd
            : "Not reported";
      const headWd = wd?.headOfGovernmentTitle?.trim();
      const headHeuristic = headFromGov(government !== "Not reported" ? government : undefined);
      const head =
        headWd && headWd.length > 0
          ? headWd
          : headHeuristic.length > 0
            ? headHeuristic
            : "Not reported";
      const eezKm = c.landlocked === true ? null : (eezMap.get(iso) ?? null);
      return {
        iso3: c.cca3,
        name: c.name,
        flagPng: c.flags?.png,
        cells: {
          region: (c.region && c.region.trim()) || "Not classified",
          government,
          head,
          area:
            typeof c.area === "number" && Number.isFinite(c.area) && c.area > 0
              ? String(c.area)
              : "Not reported",
          eez:
            c.landlocked === true
              ? "Landlocked (no EEZ)"
              : eezKm != null
                ? String(eezKm)
                : "EEZ not in reference dataset",
        },
      };
    });
    return { requestedYear, dataYear, category, columns, rows, wdiLookbackYears: 0 };
  }

  const metricIds = columns.map((c) => c.id).filter((id) => METRIC_BY_ID[id]);
  const extraFetchIds: string[] =
    category === "financial" && !metricIds.includes("population") ? ["population"] : [];
  const fetchIds = [...metricIds, ...extraFetchIds];

  const ladderYears = fullWdiLadderYears(dataYear);
  const snaps = await Promise.all(
    ladderYears.map((y) => Promise.all(fetchIds.map((id) => fetchGlobalYearSnapshot(id, y))))
  );
  const metricMaps = snaps.map((perMetric) => perMetric.map((rws) => snapshotToMap(rws)));

  const rows: TableRow[] = countries.map((c) => {
    const cells: Record<string, TableCell> = {};
    metricIds.forEach((mid) => {
      const mi = fetchIds.indexOf(mid);
      if (mi < 0) return;
      const col = columns.find((x) => x.id === mid);
      const curP = pickObservation(c.cca3, mi, 0, metricMaps);
      const prevP =
        curP.ladderIndex >= 0
          ? pickObservation(c.cca3, mi, curP.ladderIndex + 1, metricMaps)
          : pickObservation(c.cca3, mi, 1, metricMaps);
      const yo = yoy(curP.value, prevP.value, col?.yoyBps ?? false);
      cells[mid] = { value: curP.value, yoyPct: yo.yoyPct, yoyBps: yo.yoyBps };
    });
    return { iso3: c.cca3, name: c.name, flagPng: c.flags?.png, cells };
  });

  if (category === "financial") {
    applyFinancialDerivedFills(rows, metricMaps, fetchIds, columns);
  }
  if (category === "health") {
    applyHealthDerivedFills(rows, metricMaps, fetchIds, columns);
  }
  if (category === "education") {
    const ooscProxyMaps = await buildEducationOoscProxyMaps(ladderYears);
    applyEducationOoscProxyFills(rows, ooscProxyMaps, columns);
  }
  await fillTableMissingFromCountrySeries(rows, metricIds, dataYear, columns);

  return {
    requestedYear,
    dataYear,
    category,
    columns,
    rows,
    wdiLookbackYears: ladderYears.length,
  };
}
