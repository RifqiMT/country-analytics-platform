import { getCountry, fetchCountryByIso3Direct, type CountrySummary } from "./restCountries.js";
import { fetchWikidataCountryEnrichment } from "./wikidataCountryProfile.js";

/** Mirror dashboard / global table heuristics when Wikidata office label is absent. */
export function inferHeadOfGovernmentFromGovernmentType(gov?: string): string | undefined {
  if (!gov?.trim()) return undefined;
  const s = gov.trim().toLowerCase();
  if (s.includes("parliamentary")) return "Prime Minister";
  if (s.includes("constitutional monarchy") || s.includes("monarchy")) return "Monarch";
  if (s.includes("republic") || s.includes("presidential")) return "President";
  if (s.includes("federation") || s.includes("federal")) return "Head of government";
  return undefined;
}

function pickGovernment(...candidates: Array<string | undefined>): string | undefined {
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return undefined;
}

/**
 * Country directory row plus Wikidata enrichment — same government fields as GET /api/country/:cca3.
 */
export async function fetchEnrichedCountryMeta(cca3: string): Promise<CountrySummary | undefined> {
  const iso = String(cca3 ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso)) return undefined;

  const [base, direct, wd] = await Promise.all([
    getCountry(iso),
    fetchCountryByIso3Direct(iso),
    fetchWikidataCountryEnrichment(iso),
  ]);

  const seed = base ?? direct;
  if (!seed && !wd) return undefined;

  const government = pickGovernment(base?.government, direct?.government, wd?.government);
  const headOfGovernmentTitle =
    wd?.headOfGovernmentTitle?.trim() || inferHeadOfGovernmentFromGovernmentType(government);
  const headOfGovernmentName = wd?.headOfGovernmentName?.trim() || undefined;

  if (!seed) {
    return {
      cca3: iso,
      name: direct?.name ?? iso,
      region: direct?.region ?? "",
      subregion: direct?.subregion ?? "",
      capital: direct?.capital ?? [],
      population: direct?.population ?? 0,
      area: direct?.area ?? 0,
      latlng: direct?.latlng ?? [0, 0],
      flags: direct?.flags ?? {},
      timezones: direct?.timezones ?? [],
      currencies: direct?.currencies ?? [],
      government,
      headOfGovernmentTitle,
      headOfGovernmentName,
    };
  }

  return {
    ...seed,
    government,
    headOfGovernmentTitle,
    headOfGovernmentName,
  };
}
