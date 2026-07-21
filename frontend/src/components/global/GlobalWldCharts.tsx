import { useEffect, useState } from "react";
import { getJson, type MetricDef } from "../../api";
import { WLD_CHART_GROUPS } from "./wldCharts/catalog";
import WldChartGroupSection from "./wldCharts/WldChartGroupSection";

/**
 * Global Analytics → Charts.
 * Orchestrator only: each accordion group and each chart card load independently.
 */
export default function GlobalWldCharts() {
  const [metricCatalog, setMetricCatalog] = useState<MetricDef[]>([]);

  useEffect(() => {
    getJson<MetricDef[]>("/api/metrics").then(setMetricCatalog).catch(console.error);
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-1">
      <p className="text-xs leading-relaxed text-slate-500">
        Same line charts as the country dashboard (Financial, Health, Education, Crime, Labour),
        as world aggregates. Levels use official WLD or country sums; per-capita equals GDP÷population
        in-bundle; debt-to-GDP is Σdebt÷ΣGDP; unemployment is labour-force-weighted. Gaps use short
        interpolation / at most two-year carry — not invented long-range history. Exchange-rate
        evolution is country-only and omitted here.
      </p>
      {WLD_CHART_GROUPS.map((group, i) => (
        <WldChartGroupSection
          key={group.id}
          group={group}
          metricCatalog={metricCatalog}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
