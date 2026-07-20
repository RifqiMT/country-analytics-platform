import { fetchWdiGlobalRowsForYear, type GlobalRow } from "./globalSnapshot.js";
import { fetchCountryByIso3Direct, type CountrySummary } from "./restCountries.js";
import { fetchIndicatorSeries } from "./worldBank.js";
import type { SeriesPoint } from "./series.js";
import { MIN_DATA_YEAR } from "./yearBounds.js";
import { isUsableNumber } from "./wdiParse.js";

/** World Bank WDI — land area (sq km). Same series as country profile API. */
const WDI_LAND_AREA_KM2 = "AG.LND.TOTL.K2";
const WDI_SURFACE_AREA_KM2 = "AG.SRF.TOTL.K2";

const SNAPSHOT_LOOKBACK_YEARS = 14;
const MIN_COUNTRIES_FOR_WDI_GEO_AGG = 80;

export type CountryGeography = {
  landAreaKm2: number | null;
  totalAreaKm2: number | null;
  landSource: "wdi" | "rest_countries" | "none";
  totalSource: "wdi" | "rest_countries" | "none";
  refYear: number | null;
};

type GeographyAggregateSlice = {
  median: number | null;
  global: number | null;
  refYear: number | null;
  reportingCount: number;
  globalMethod: "wld_wdi" | "sum_economies_wdi" | "sum_economies_rest" | "none";
};

export type GeographyAggregates = {
  land: GeographyAggregateSlice;
  total: GeographyAggregateSlice;
};

function lastNonNullValue(points: SeriesPoint[]): { value: number; year: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]?.value;
    const y = points[i]?.year;
    if (isUsableNumber(v) && typeof y === "number") return { value: v, year: y };
  }
  return null;
}

function medianFromSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function aggregateWdiGeographyRows(
  rows: GlobalRow[],
  members: Set<string>
): { median: number | null; sumMembers: number | null; wld: number | null; count: number } {
  const memberVals: number[] = [];
  let wld: number | null = null;
  for (const r of rows) {
    const iso = r.countryIso3.toUpperCase();
    if (iso === "WLD") {
      if (isUsableNumber(r.value)) wld = r.value;
      continue;
    }
    if (!members.has(iso)) continue;
    if (isUsableNumber(r.value)) memberVals.push(r.value);
  }
  memberVals.sort((a, b) => a - b);
  return {
    median: medianFromSorted(memberVals),
    sumMembers: memberVals.length > 0 ? memberVals.reduce((a, b) => a + b, 0) : null,
    wld,
    count: memberVals.length,
  };
}

function aggregateFromRestAreas(all: CountrySummary[]): { median: number | null; sum: number | null } {
  const areas = all.map((c) => c.area).filter((a) => isUsableNumber(a) && a > 0);
  if (areas.length === 0) return { median: null, sum: null };
  areas.sort((a, b) => a - b);
  return { median: medianFromSorted(areas), sum: areas.reduce((a, b) => a + b, 0) };
}

/**
 * Resolve land and total area for one economy using WDI (primary) with REST Countries fallback,
 * matching `/api/country/:cca3` profile behaviour.
 */
export async function resolveCountryGeography(
  iso3: string,
  restArea?: number,
  endYear?: number
): Promise<CountryGeography> {
  const upper = iso3.toUpperCase();
  const yEnd = endYear ?? new Date().getFullYear() - 1;
  const startYear = MIN_DATA_YEAR;

  const [landSeries, totalSeries, directRest] = await Promise.all([
    fetchIndicatorSeries(upper, WDI_LAND_AREA_KM2, startYear, yEnd).catch(() => [] as SeriesPoint[]),
    fetchIndicatorSeries(upper, WDI_SURFACE_AREA_KM2, startYear, yEnd).catch(() => [] as SeriesPoint[]),
    fetchCountryByIso3Direct(upper).catch(() => null),
  ]);

  const landWdi = lastNonNullValue(landSeries);
  const totalWdi = lastNonNullValue(totalSeries);
  const restFromDirect =
    directRest?.area != null && Number.isFinite(directRest.area) && directRest.area > 0
      ? directRest.area
      : null;
  const restFromMeta = restArea != null && Number.isFinite(restArea) && restArea > 0 ? restArea : null;
  const restFallback = restFromDirect ?? restFromMeta;

  const landAreaKm2 = landWdi?.value ?? restFallback;
  const totalAreaKm2 = totalWdi?.value ?? restFallback ?? landWdi?.value ?? null;
  const refYear = Math.max(landWdi?.year ?? 0, totalWdi?.year ?? 0) || null;

  const totalSource: CountryGeography["totalSource"] = totalWdi
    ? "wdi"
    : restFallback
      ? "rest_countries"
      : landWdi
        ? "wdi"
        : "none";

  return {
    landAreaKm2: isUsableNumber(landAreaKm2) ? landAreaKm2 : null,
    totalAreaKm2: isUsableNumber(totalAreaKm2) ? totalAreaKm2 : null,
    landSource: landWdi ? "wdi" : restFallback ? "rest_countries" : "none",
    totalSource,
    refYear,
  };
}

async function snapshotGeographySlice(
  indicator: string,
  year: number,
  members: Set<string>,
  restFallback: { median: number | null; sum: number | null }
): Promise<GeographyAggregateSlice> {
  const yMin = Math.max(MIN_DATA_YEAR, year - SNAPSHOT_LOOKBACK_YEARS);
  for (let y = year; y >= yMin; y--) {
    const rows = await fetchWdiGlobalRowsForYear(indicator, y);
    const agg = aggregateWdiGeographyRows(rows, members);
    if (agg.count >= MIN_COUNTRIES_FOR_WDI_GEO_AGG) {
      const global = agg.wld ?? agg.sumMembers;
      return {
        median: agg.median,
        global,
        refYear: y,
        reportingCount: agg.count,
        globalMethod: agg.wld != null ? "wld_wdi" : "sum_economies_wdi",
      };
    }
  }
  if (restFallback.median != null || restFallback.sum != null) {
    return {
      median: restFallback.median,
      global: restFallback.sum,
      refYear: null,
      reportingCount: 0,
      globalMethod: restFallback.sum != null ? "sum_economies_rest" : "none",
    };
  }
  return { median: null, global: null, refYear: null, reportingCount: 0, globalMethod: "none" };
}

/** Cross-country land/total area medians and global totals from WDI with REST fallback. */
export async function resolveGeographyAggregates(
  year: number,
  members: Set<string>,
  restCountries: CountrySummary[]
): Promise<GeographyAggregates> {
  const rest = aggregateFromRestAreas(restCountries);
  const [land, total] = await Promise.all([
    snapshotGeographySlice(WDI_LAND_AREA_KM2, year, members, rest),
    snapshotGeographySlice(WDI_SURFACE_AREA_KM2, year, members, rest),
  ]);
  return { land, total };
}
