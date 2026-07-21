import { useEffect, useState } from "react";
import type { MetricDef } from "../../../api";
import AccordionSection from "../../dashboard/AccordionSection";
import { VisualizationStepperFromChildren } from "../../charts/VisualizationStepper";
import type { WldChartGroupDef } from "./catalog";
import WldLineChartCard from "./WldLineChartCard";

export default function WldChartGroupSection({
  group,
  metricCatalog,
  defaultOpen = false,
}: {
  group: WldChartGroupDef;
  metricCatalog: MetricDef[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  /** Activate chart fetches once the accordion has been opened. */
  const [fetchEnabled, setFetchEnabled] = useState(defaultOpen);
  useEffect(() => {
    if (open) setFetchEnabled(true);
  }, [open]);

  const meta = group.charts.map((c) => ({ title: c.title, summary: c.summary }));

  return (
    <AccordionSection title={group.title} open={open} onOpenChange={setOpen}>
      <p className="mb-3 text-xs text-slate-500">{group.description}</p>
      <VisualizationStepperFromChildren groupLabel={`${group.title} (WLD)`} meta={meta}>
        {group.charts.map((chart) => (
          <WldLineChartCard
            key={chart.id}
            def={chart}
            metricCatalog={metricCatalog}
            enabled={fetchEnabled}
          />
        ))}
      </VisualizationStepperFromChildren>
    </AccordionSection>
  );
}
