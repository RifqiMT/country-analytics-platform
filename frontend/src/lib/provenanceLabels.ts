import type { SeriesProvenance } from "../api";

const LABELS: Record<SeriesProvenance, string> = {
  reported: "Reported (WDI / primary)",
  wb_alternate_code: "World Bank (alternate indicator)",
  imf_weo: "IMF WEO gap-fill",
  uis: "UNESCO UIS gap-fill",
  derived_cross_metric: "Derived from other series",
  carried_short: "Short carry-forward (lag)",
  interpolated: "Interpolated between years",
  filled_range: "Range fill (edge / step)",
  wld_proxy: "World aggregate (WLD) proxy",
};

export function provenanceLabel(p: SeriesProvenance | undefined): string | null {
  if (!p) return null;
  return LABELS[p] ?? p;
}
