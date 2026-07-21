import { useEffect, useState } from "react";
import { getJsonWithMeta, type SeriesPoint } from "../../../api";
import { MIN_DATA_YEAR, maxSelectableYear } from "../../../lib/yearBounds";

export type WldSeriesLoadState = {
  loading: boolean;
  progress: number;
  err: string | null;
  warning: string | null;
  series: Record<string, SeriesPoint[]>;
  start: number;
  end: number;
  loaded: boolean;
};

/**
 * Loads series for one chart card via `/api/global/wld-series`.
 * Keeps each visualization independent of sibling charts in the same accordion.
 */
export function useWldChartSeries(
  metricIds: readonly string[],
  enabled: boolean
): WldSeriesLoadState {
  const idsKey = metricIds.join(",");
  const [state, setState] = useState<WldSeriesLoadState>(() => ({
    loading: false,
    progress: 0,
    err: null,
    warning: null,
    series: {},
    start: MIN_DATA_YEAR,
    end: maxSelectableYear(),
    loaded: false,
  }));

  useEffect(() => {
    if (!enabled || metricIds.length === 0) return;
    let active = true;
    const end = maxSelectableYear();
    setState({
      loading: true,
      progress: 15,
      err: null,
      warning: null,
      series: {},
      start: MIN_DATA_YEAR,
      end,
      loaded: false,
    });

    const tick = window.setTimeout(() => {
      if (active) setState((s) => (s.loading ? { ...s, progress: Math.min(70, s.progress + 20) } : s));
    }, 800);

    void (async () => {
      try {
        const query = encodeURIComponent(idsKey);
        const { data, warning } = await getJsonWithMeta<{
          start: number;
          end: number;
          series: Record<string, SeriesPoint[]>;
        }>(`/api/global/wld-series?metrics=${query}&start=${MIN_DATA_YEAR}&end=${end}`);
        if (!active) return;
        const series = data.series ?? {};
        const hasAny = Object.values(series).some((arr) =>
          (arr ?? []).some((p) => p.value !== null && Number.isFinite(p.value))
        );
        let userWarning: string | null = null;
        if (warning === "global-wld-series-fallback-null" || !hasAny) {
          userWarning = "No world-aggregate values for this chart yet.";
        } else if (warning === "global-wld-series-partial") {
          userWarning = "Some series on this chart are incomplete.";
        }
        setState({
          loading: false,
          progress: 100,
          err: null,
          warning: userWarning,
          series,
          start: data.start ?? MIN_DATA_YEAR,
          end: data.end ?? end,
          loaded: true,
        });
      } catch (e) {
        if (!active) return;
        setState({
          loading: false,
          progress: 0,
          err: e instanceof Error ? e.message : "Failed to load chart series.",
          warning: null,
          series: {},
          start: MIN_DATA_YEAR,
          end,
          loaded: true,
        });
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(tick);
    };
    // idsKey captures metricIds membership
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, enabled]);

  return state;
}
