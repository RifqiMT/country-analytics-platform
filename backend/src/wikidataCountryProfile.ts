import { getCache, setCache } from "./cache.js";
import { OUTBOUND_USER_AGENT } from "./httpClient.js";

export type WikidataCountryEnrichment = {
  government?: string;
  headOfGovernmentTitle?: string;
  headOfGovernmentName?: string;
};

/** Short label for dashboard: "President of Indonesia" → "President". */
export function shortenHeadOfGovernmentOffice(officeLabel: string): string {
  const t = officeLabel.trim();
  const m = t.match(
    /^(Prime Minister|President|Monarch|Chancellor|Premier|Chief Executive|Federal Chancellor)(?=\s+of\b)/i
  );
  if (m) return m[1]!.replace(/\b\w/g, (c) => c.toUpperCase());
  return t;
}

/**
 * REST Countries v3.1 no longer populates `government` for countries.
 * Wikidata P122 (basic form of government) + P1313 (head-of-government office) fill the gap.
 */
export async function fetchWikidataCountryEnrichment(iso3: string): Promise<WikidataCountryEnrichment | null> {
  const key = `wikidata:gov:${iso3.toUpperCase()}`;
  const hit = getCache<WikidataCountryEnrichment | null>(key);
  if (hit !== undefined) return hit;

  const q = `
    SELECT ?govLabel ?officeLabel ?personLabel WHERE {
      ?c wdt:P298 "${iso3.toUpperCase()}" .
      ?c wdt:P31/wdt:P279* wd:Q3624078 .
      OPTIONAL { ?c wdt:P122 ?gov . }
      OPTIONAL { ?c wdt:P1313 ?office . }
      OPTIONAL { ?c wdt:P6 ?person . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": OUTBOUND_USER_AGENT },
    });
    if (!res.ok) {
      setCache(key, null, 1000 * 60 * 30);
      return null;
    }
    const raw = (await res.json()) as {
      results?: { bindings?: Array<Record<string, { value: string }>> };
    };
    const rows = raw.results?.bindings ?? [];
    const govLabels = new Set<string>();
    let officeLabel: string | undefined;
    let personLabel: string | undefined;
    for (const b of rows) {
      const gl = b.govLabel?.value;
      if (gl) govLabels.add(gl);
      const ol = b.officeLabel?.value;
      if (ol && !officeLabel) officeLabel = ol;
      const pl = b.personLabel?.value;
      if (pl && !personLabel) personLabel = pl;
    }
    if (govLabels.size === 0 && !officeLabel && !personLabel) {
      setCache(key, null, 1000 * 60 * 60 * 6);
      return null;
    }
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const government =
      govLabels.size > 0
        ? [...govLabels].sort((a, b) => a.localeCompare(b)).map(cap).join("; ")
        : undefined;
    const headOfGovernmentTitle = officeLabel ? shortenHeadOfGovernmentOffice(officeLabel) : undefined;
    const headOfGovernmentName = personLabel?.trim() || undefined;
    const out: WikidataCountryEnrichment = { government, headOfGovernmentTitle, headOfGovernmentName };
    setCache(key, out, 1000 * 60 * 60 * 24);
    return out;
  } catch {
    setCache(key, null, 1000 * 60 * 30);
    return null;
  }
}

/** Current head-of-government person (Wikidata P6), cached separately for lightweight lookups. */
export async function fetchWikidataHeadOfGovernmentName(iso3: string): Promise<string | null> {
  const enrichment = await fetchWikidataCountryEnrichment(iso3);
  const name = enrichment?.headOfGovernmentName?.trim();
  return name && name.length > 0 ? name : null;
}
