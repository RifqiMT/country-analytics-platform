import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, GeoJsonProperties } from "geojson";
import {
  buildChoroplethTierModel,
  CHOROPLETH_ANTARCTICA,
  CHOROPLETH_EXCLUDED,
  CHOROPLETH_NO_DATA,
} from "../../lib/choroplethTiers";
import { formatCompactNumber } from "../../lib/formatValue";
import { resolveIso3FromGeoName } from "../../lib/geoNameToIso3";
import ChoroplethTierLegend from "./ChoroplethTierLegend";
import MapCountryTooltip, {
  computeCountryRank,
  computeMapScopeStats,
  mapScopeValues,
  type MapTooltipPayload,
} from "./MapCountryTooltip";

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
  metricId: string;
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
  metricId,
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
  const [hover, setHover] = useState<MapTooltipPayload | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

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

  const scopeValues = useMemo(
    () => mapScopeValues(valueByIso3, allowedIso3, regionFilter),
    [valueByIso3, allowedIso3, regionFilter]
  );

  const tierModel = useMemo(
    () => buildChoroplethTierModel(scopeValues),
    [scopeValues]
  );

  const formatMapValue = useCallback(
    (v: number) =>
      valueFormat === "percent"
        ? `${v.toFixed(1)}%`
        : formatCompactNumber(v, { maxFrac: 2 }),
    [valueFormat]
  );

  const updateHoverFromEvent = useCallback(
    (
      e: MouseEvent<SVGPathElement>,
      displayName: string,
      isoU: string,
      flagMeta: FlagMeta | undefined
    ) => {
      const v = isoU ? valueByIso3.get(isoU) : undefined;
      setHoveredIso(isoU || null);
      setHover({
        name: displayName,
        iso3: isoU || "—",
        emoji: flagMeta?.emoji ?? "",
        flagPng: flagMeta?.flagPng,
        value: v ?? null,
        x: e.clientX,
        y: e.clientY,
      });
      setTooltipVisible(true);
    },
    [valueByIso3]
  );

  const clearHover = useCallback(() => {
    setTooltipVisible(false);
    setHoveredIso(null);
    setHover(null);
  }, []);

  const scopeStats = useMemo(() => computeMapScopeStats(scopeValues), [scopeValues]);

  const hoverAccent = useMemo(() => {
    if (!hover?.iso3 || hover.iso3 === "—") return "#94a3b8";
    const v = valueByIso3.get(hover.iso3);
    if (v === undefined || v === null || Number.isNaN(v)) return CHOROPLETH_NO_DATA;
    return tierModel?.colorForValue(v) ?? CHOROPLETH_NO_DATA;
  }, [hover?.iso3, valueByIso3, tierModel]);

  const hoverCountryRank = useMemo(() => {
    if (!hover?.iso3) return null;
    return computeCountryRank(hover.iso3, valueByIso3, allowedIso3, regionFilter);
  }, [hover?.iso3, valueByIso3, allowedIso3, regionFilter]);

  const hoverTierBadge = useMemo(() => {
    if (!hover?.iso3 || !tierModel) return null;
    const v = valueByIso3.get(hover.iso3);
    if (v === undefined || v === null || Number.isNaN(v)) return null;
    const tier = tierModel.tiers[tierModel.tierIndexForValue(v)];
    if (!tier) return null;
    return { shortLabel: tier.shortLabel, rankLabel: tier.rankLabel };
  }, [hover?.iso3, tierModel, valueByIso3]);

  const fillFor = useCallback(
    (iso: string) => {
      if (!iso || iso === "ATA") return CHOROPLETH_ANTARCTICA;
      if (regionFilter !== "All" && !allowedIso3.has(iso)) return CHOROPLETH_EXCLUDED;
      const v = valueByIso3.get(iso);
      if (v === undefined || v === null || Number.isNaN(v)) return CHOROPLETH_NO_DATA;
      return tierModel?.colorForValue(v) ?? CHOROPLETH_NO_DATA;
    },
    [allowedIso3, regionFilter, valueByIso3, tierModel]
  );

  const strokeFor = useCallback((fill: string, isHovered: boolean) => {
    if (isHovered) return "#0f172a";
    if (fill === CHOROPLETH_EXCLUDED || fill === CHOROPLETH_ANTARCTICA) return "#cbd5e1";
    if (fill === CHOROPLETH_NO_DATA) return "#94a3b8";
    return "#64748b";
  }, []);

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
      <div className="mb-3 flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <ChoroplethTierLegend
          model={tierModel}
          formatValue={formatMapValue}
          economyCount={scopeValues.length}
        />
        <div className="flex shrink-0 items-center gap-1 self-stretch sm:self-start">
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
        className="cap-choropleth-map-box relative min-h-[280px] w-full min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
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
                  const isHovered = hoveredIso === isoU;
                  const hoverStroke = strokeFor(baseFill, isHovered);
                  return (
                    <Geography
                      key={g.rsmKey}
                      geography={g}
                      fill={baseFill}
                      stroke={strokeFor(baseFill, false)}
                      strokeWidth={0.45}
                      style={{
                        default: { outline: "none", fill: baseFill },
                        hover: {
                          outline: "none",
                          fill: hoverFill,
                          stroke: hoverStroke,
                          strokeWidth: 1.25,
                          cursor: "pointer",
                        },
                        pressed: {
                          outline: "none",
                          fill: hoverFill,
                          stroke: hoverStroke,
                          strokeWidth: 1.25,
                        },
                      }}
                      onMouseEnter={(e: MouseEvent<SVGPathElement>) => {
                        updateHoverFromEvent(e, displayName, isoU, flagMeta);
                      }}
                      onMouseMove={(e: MouseEvent<SVGPathElement>) => {
                        if (hoveredIso !== isoU) return;
                        setHover((prev) =>
                          prev
                            ? {
                                ...prev,
                                x: e.clientX,
                                y: e.clientY,
                              }
                            : prev
                        );
                      }}
                      onMouseLeave={clearHover}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {hover ? (
        <MapCountryTooltip
          hover={hover}
          metricLabel={metricLabel}
          metricId={metricId}
          metricDescription={metricDescription}
          year={year}
          formatValue={formatMapValue}
          accentColor={hoverAccent}
          scopeStats={scopeStats}
          countryRank={hoverCountryRank}
          tierBadge={hoverTierBadge}
          visible={tooltipVisible}
        />
      ) : null}

      <p className="mt-3 shrink-0 text-xs text-slate-500">
        Hover a country for values · zoom with +/− · data year {year}
      </p>
    </div>
  );
}
