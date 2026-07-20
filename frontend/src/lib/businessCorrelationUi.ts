export function strengthLabel(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "strong";
  if (a >= 0.4) return "moderate";
  if (a >= 0.2) return "weak";
  return "negligible";
}

export function parsePValueSort(s: string | null): number | null {
  if (!s || s === "—") return null;
  if (s.startsWith("<")) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
