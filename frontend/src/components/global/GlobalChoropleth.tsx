import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { scaleLinear } from "d3-scale";
import type { FeatureCollection, GeoJsonProperties } from "geojson";
import { formatCompactNumber } from "../../lib/formatValue";
import { resolveIso3FromGeoName } from "../../lib/geoNameToIso3";
import {
  CHART_TOOLTIP_SURFACE_CLASS,
  ChartTooltipFootnote,
  ChartTooltipTitle,
} from "../charts/ChartTooltipShell";

type FlagMeta = { emoji: string; flagPng?: string };

const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

type RsmGeography = { rsmKey: string; properties?: GeoJsonProperties };

type ValueFormat = "compact" | "percent";

type Props = {
  valueByIso3: Map<string, number>;
  /** Map topology only provides `properties.name`; keys = normalized names → ISO3. */
  geoNameToIso3: Map<string, string>;
  regionFilter: string;
  /** ISO3 codes included when region is not "All" */
  allowedIso3: Set<string>;
  metricLabel: string;
  metricDescription: string;
  /** Calendar year of the values shown (WDI publish year after any API fallback). */
  year: number;
  /** How to format numeric values in the tooltip (matches metric unit). */
  valueFormat?: ValueFormat;
  /** ISO3 → flag emoji (from alpha-2) and REST Countries PNG for SVG pattern hover fill */
  flagByIso3: Map<string, FlagMeta>;
};

export default function GlobalChoropleth({
  valueByIso3,
  geoNameToIso3,
  regionFilter,
  allowedIso3,
  metricLabel,
  metricDescription,
  year,
  valueFormat = "compact",
  flagByIso3,
}: Props) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [pos, setPos] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 20],
    zoom: 1,
  });
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    name: string;
    iso3: string;
    emoji: string;
    value: number | null;
    x: number;
    y: number;
  } | null>(null);

  const mapBoxRef = useRef<HTMLDivElement>(null);
  const [mapDims, setMapDims] = useState({ w: 800, h: 440 });

  useLayoutEffect(() => {
    const el = mapBoxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(160, Math.floor(r.width));
      const h = Math.max(160, Math.floor(r.height));
      setMapDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries as never) as unknown as FeatureCollection;
        setGeo(fc);
      })
      .catch(() => setGeo(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const { minV, maxV } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of valueByIso3.values()) {
      if (v === null || Number.isNaN(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { minV: 0, maxV: 1 };
    if (min === max) return { minV: min, maxV: min + 1 };
    return { minV: min, maxV: max };
  }, [valueByIso3]);

  const colorScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([minV, maxV])
        .range(["#e2e8f0", "#c2410c"])
        .clamp(true),
    [minV, maxV]
  );

  const formatMapValue = useCallback(
    (v: number) =>
      valueFormat === "percent"
        ? `${v.toFixed(1)}%`
        : formatCompactNumber(v, { maxFrac: 2 }),
    [valueFormat]
  );

  const fillFor = useCallback(
    (iso: string) => {
      if (!iso || iso === "ATA") return "#f1f5f9";
      if (regionFilter !== "All" && !allowedIso3.has(iso)) return "#f8fafc";
      const v = valueByIso3.get(iso);
      if (v === undefined || v === null || Number.isNaN(v)) return "#e2e8f0";
      return colorScale(v);
    },
    [allowedIso3, colorScale, regionFilter, valueByIso3]
  );

  const zoomIn = () => setPos((p) => ({ ...p, zoom: Math.min(p.zoom * 1.25, 8) }));
  const zoomOut = () => setPos((p) => ({ ...p, zoom: Math.max(p.zoom / 1.25, 0.6) }));
  const reset = () => setPos({ coordinates: [0, 20], zoom: 1 });

  if (!geo) {
    return (
      <div className="flex h-full min-h-[280px] w-full flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Loading map…
      </div>
    );
  }

  return (
    <div className="cap-choropleth-shell relative flex h-full min-h-0 w-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">
            {valueFormat === "percent" ? "Lower %" : "Lower values"}
          </span>
          <div
            className="h-3 flex-1 rounded-full bg-gradient-to-r from-slate-200 to-orange-700"
            style={{ minWidth: 120, maxWidth: 320 }}
          />
          <span className="text-xs text-slate-500">
            {valueFormat === "percent" ? "Higher %" : "Higher values"}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={zoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={mapBoxRef}
        className="cap-choropleth-map-box relative min-h-[240px] w-full min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [0, 20] }}
          width={mapDims.w}
          height={mapDims.h}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            {hoveredIso ? (() => {
              const png = flagByIso3.get(hoveredIso)?.flagPng;
              if (!png) return null;
              return (
                <pattern
                  key={hoveredIso}
                  id="choroplethFlagHover"
                  patternContentUnits="objectBoundingBox"
                  width={1}
                  height={1}
                >
                  <image href={png} width={1} height={1} preserveAspectRatio="xMidYMid slice" />
                </pattern>
              );
            })() : null}
          </defs>
          <ZoomableGroup
            zoom={pos.zoom}
            center={pos.coordinates}
            minZoom={0.5}
            maxZoom={8}
            onMoveEnd={(p: { coordinates: [number, number]; zoom: number }) =>
              setPos({ coordinates: p.coordinates, zoom: p.zoom })
            }
          >
            <Geographies geography={geo}>
              {({ geographies }: { geographies: RsmGeography[] }) =>
                geographies.map((g: RsmGeography) => {
                  const geoName = String((g.properties as GeoJsonProperties)?.name ?? "");
                  const iso = resolveIso3FromGeoName(geoName, geoNameToIso3) ?? "";
                  const isoU = iso.toUpperCase();
                  const baseFill = fillFor(isoU);
                  const displayName = geoName || iso || "—";
                  const flagMeta = isoU ? flagByIso3.get(isoU) : undefined;
                  const flagPng = flagMeta?.flagPng;
                  const showFlagOnHover = Boolean(flagPng);
                  const hoverFill =
                    hoveredIso === isoU && showFlagOnHover ? "url(#choroplethFlagHover)" : baseFill;
                  const hoverStroke =
                    baseFill === "#f8fafc" ? "#cbd5e1" : baseFill === "#f1f5f9" ? "#94a3b8" : "#0f172a";
                  return (
                    <Geography
                      key={g.rsmKey}
                      geography={g}
                      fill={baseFill}
                      stroke="#cbd5e1"
                      strokeWidth={0.35}
                      style={{
                        default: { outline: "none", fill: baseFill },
                        hover: {
                          outline: "none",
                          fill: hoverFill,
                          stroke: hoverStroke,
                          strokeWidth: 1.1,
                          cursor: "pointer",
                        },
                        pressed: {
                          outline: "none",
                          fill: hoverFill,
                          stroke: hoverStroke,
                          strokeWidth: 1.1,
                        },
                      }}
                      onMouseEnter={(e: MouseEvent<SVGPathElement>) => {
                        const v = isoU ? valueByIso3.get(isoU) : undefined;
                        setHoveredIso(isoU || null);
                        setHover({
                          name: displayName,
                          iso3: isoU || "—",
                          emoji: flagMeta?.emoji ?? "",
                          value: v ?? null,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredIso(null);
                        setHover(null);
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {hover && (
        <div
          className={`pointer-events-none fixed z-[100] ${CHART_TOOLTIP_SURFACE_CLASS} p-4`}
          style={{ left: hover.x + 14, top: hover.y + 14 }}
          role="status"
        >
          <div className="flex items-start gap-3">
            {hover.emoji ? (
              <span className="text-2xl leading-none drop-shadow-sm" aria-hidden>
                {hover.emoji}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <ChartTooltipTitle subtle="Country / economy">{hover.name}</ChartTooltipTitle>
              <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-slate-500">
                {metricLabel}
              </p>
              <p
                className={`text-[1.125rem] font-bold tabular-nums tracking-tight ${
                  hover.value === null || Number.isNaN(hover.value) ? "text-slate-500" : "text-orange-700"
                }`}
              >
                {hover.value === null || Number.isNaN(hover.value) ? "No data reported" : formatMapValue(hover.value)}
              </p>
              <p className="mt-2 text-[0.6875rem] font-medium tabular-nums text-slate-400">Data year · {year}</p>
            </div>
          </div>
          <ChartTooltipFootnote>{metricDescription}</ChartTooltipFootnote>
        </div>
      )}

      <p className="mt-3 shrink-0 text-xs text-slate-500">
        Hover for name, flag emoji, and values; the country fill shows its flag image when a flag is available from REST
        Countries. Values use year {year}.
      </p>
    </div>
  );
}
