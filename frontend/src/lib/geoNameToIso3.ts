import type { CountrySummary } from "../api";

/**
 * world-atlas@2 countries topojson only exposes `properties.name` (no ISO_A3).
 * We bridge map labels → ISO3 using REST Countries (common + official names),
 * World Bank snapshot country names, and a few Natural Earth quirks.
 */
function normalizeGeoName(raw: string): string {
  let s = raw.normalize("NFKD").replace(/\p{M}/gu, "");
  s = s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/,/g, " ")
    .replace(/\./g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Normalized display names → ISO3 where they differ from REST `name` / `nameOfficial`. */
const EXTRA_NORMALIZED_NAME_TO_ISO3: Record<string, string> = {
  congo: "COG",
  "dem rep congo": "COD",
  "democratic republic of the congo": "COD",
  "congo dem rep": "COD",
  "w sahara": "ESH",
  "western sahara": "ESH",
  "s sudan": "SSD",
  "south sudan": "SSD",
  micronesia: "FSM",
  laos: "LAO",
  moldova: "MDA",
  "north korea": "PRK",
  "south korea": "KOR",
  russia: "RUS",
  "russian federation": "RUS",
  tanzania: "TZA",
  "united republic of tanzania": "TZA",
  vietnam: "VNM",
  bolivia: "BOL",
  "plurinational state of bolivia": "BOL",
  venezuela: "VEN",
  iran: "IRN",
  "iran islamic republic of": "IRN",
  yemen: "YEM",
  somalia: "SOM",
  sudan: "SDN",
  "united states of america": "USA",
  eswatini: "SWZ",
  swaziland: "SWZ",
  czechia: "CZE",
  "czech republic": "CZE",
  brunei: "BRN",
  "brunei darussalam": "BRN",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "turkiye": "TUR",
  turkey: "TUR",
};

export function buildGeoNameToIso3Lookup(
  countries: CountrySummary[],
  snapshotRows?: { countryIso3: string; countryName: string }[]
): Map<string, string> {
  const m = new Map<string, string>();
  const add = (label: string | undefined, iso3: string) => {
    if (!label) return;
    const iso = iso3.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso)) return;
    const k = normalizeGeoName(label);
    if (!k) return;
    if (!m.has(k)) m.set(k, iso);
  };

  for (const [k, iso] of Object.entries(EXTRA_NORMALIZED_NAME_TO_ISO3)) {
    if (!m.has(k)) m.set(k, iso);
  }

  for (const c of countries) {
    add(c.name, c.cca3);
    if (c.nameOfficial) add(c.nameOfficial, c.cca3);
  }

  if (snapshotRows) {
    for (const r of snapshotRows) {
      add(r.countryName, r.countryIso3);
    }
  }

  return m;
}

export function resolveIso3FromGeoName(geoName: string | undefined, lookup: Map<string, string>): string | null {
  if (!geoName) return null;
  const k = normalizeGeoName(geoName);
  if (!k) return null;
  return lookup.get(k) ?? null;
}
