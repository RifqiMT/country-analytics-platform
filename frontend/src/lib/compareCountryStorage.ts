const KEY_A = "cap-compare-country-a";
const KEY_B = "cap-compare-country-b";

function read(key: string): string | null {
  try {
    const s = sessionStorage.getItem(key);
    if (s && /^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
  } catch {
    /* private mode */
  }
  return null;
}

function write(key: string, cca3: string): void {
  try {
    if (/^[A-Za-z]{3}$/.test(cca3)) sessionStorage.setItem(key, cca3.toUpperCase());
  } catch {
    /* ignore */
  }
}

export function readStoredCompareCountryA(): string | null {
  return read(KEY_A);
}

export function readStoredCompareCountryB(): string | null {
  return read(KEY_B);
}

export function writeStoredCompareCountries(a: string, b: string): void {
  write(KEY_A, a);
  write(KEY_B, b);
}
