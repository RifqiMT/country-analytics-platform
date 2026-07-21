# Comprehensive Design Guidelines (Enterprise UI/UX Standard)

This document defines the design and UX standards used by the Country Analytics Platform.

It is written for a wide audience (product, design, engineering, QA). It aims to prevent inconsistent UI patterns and to ensure that a reader unfamiliar with the codebase can still understand the visual and interaction rules.

## 1) Design principles

- **Clarity over decoration**: the UI should make analytical meaning obvious.
- **Evidence-first communication**: data context (units, years, scope) must be visible where users interpret values.
- **Progressive disclosure**: complex analysis should be shown step-by-step, with “generate” actions gated behind user intent where appropriate.
- **Consistency across modules**: similar controls should behave similarly (filters, toggles, exports, fullscreen).

## 2) Themes and palette tokens

The current UI ships with a light-first palette.

### 2.1 Light theme (core palette)

| Token purpose | Tailwind-style token |
| --- | --- |
| Primary text | `slate-900` |
| Secondary text | `slate-600` |
| Muted/tertiary text | `slate-500` |
| Background surface | `white` |
| Elevated surface | `slate-50` |
| Border / separators | `slate-200` |

### 2.2 Semantic colors (status & meaning)

| Semantic role | Use cases | Suggested tokens |
| --- | --- | --- |
| Positive / success / verified | Verified-web badge, success emphasis | `emerald-*` (e.g., `emerald-50/80`, `emerald-200`, `emerald-700`) |
| Warning / attention | Highlighted country callout, advisory tone | `amber-*` (e.g., `amber-50/60`, `amber-200`) |
| Critical / error | Errors, failed calls, destructive states | `red-*` (e.g., `red-50`, `red-600`) |
| Info / analytic accent | Accent headings, teal/cyan highlights | `teal-*` and `sky-*` |

### 2.2 Brand accent tokens (Tailwind custom colors)

Defined in `frontend/tailwind.config.js`:

| Token | Hex | Usage |
| --- | --- | --- |
| `ink-950` | `#0c1222` | Deepest text/background accent |
| `ink-900` | `#121a2e` | Primary dark surfaces |
| `ink-800` | `#1a2540` | Secondary dark surfaces |
| `ink-700` | `#243056` | Tertiary dark text |
| `sea-500` | `#2dd4bf` | Teal accent (highlights, links) |
| `sea-600` | `#14b8a6` | Teal hover/active |
| `sea-700` | `#0d9488` | Teal emphasis |
| `coral-500` | `#fb7185` | Coral accent (secondary highlights) |
| `coral-600` | `#f43f5e` | Coral emphasis |

### 2.3 Typography tokens

| Token | Font stack | Usage |
| --- | --- | --- |
| `font-sans` | Inter, DM Sans, system-ui | Body text, labels, controls |
| `font-display` | Outfit, Inter, system-ui | Headings, hero titles |

### 2.4 PESTEL dimension theme colors

Defined in `frontend/src/components/pestel/pestelTheme.ts` (professional, non-purple palette):

| Dimension | Header color | Tint (content background) |
| --- | --- | --- |
| POLITICAL | `#0f766e` | `#f0fdfa` |
| ECONOMIC | `#334155` | `#f8fafc` |
| SOCIOCULTURAL | `#b45309` | `#fffbeb` |
| TECHNOLOGICAL | `#0369a1` | `#f0f9ff` |
| ENVIRONMENTAL | `#15803d` | `#f0fdf4` |
| LEGAL | `#57534e` | `#fafaf9` |

### 2.5 SWOT quadrant theme colors

| Quadrant | Header color | Tint | Title |
| --- | --- | --- | --- |
| Strengths | `#0f766e` | `#f0fdfa` | Strengths |
| Weaknesses | `#b45309` | `#fffbeb` | Weaknesses |
| Opportunities | `#0369a1` | `#f0f9ff` | Opportunities |
| Threats | `#b91c1c` | `#fef2f2` | Threats |

### 2.6 Porter Five Forces accent colors

Defined in `frontend/src/components/porter/porterTheme.ts`:

| Force | Accent color | Short label (`PORTER_FORCE_SHORT`) |
| --- | --- | --- |
| Threat of new entry | `#0f766e` | New entrants |
| Supplier power | `#334155` | Suppliers |
| Buyer power | `#0369a1` | Buyers |
| Threat of substitutes | `#b45309` | Substitutes |
| Competitive rivalry | `#115e59` | Rivalry |

### 2.6.1 Compare Countries pair colors

Defined in `frontend/src/lib/compareChartMerge.ts`:

| Role | Hex | Usage |
| --- | --- | --- |
| Country A | `#1d4ed8` | Solid series / legend for first country |
| Country B | `#c2410c` | Distinct series / legend for second country |

### 2.7 Crime & safety dashboard section

The dashboard **Crime & public safety** accordion follows standard section patterns:
- Section label: "Safety" in dashboard navigation
- Three chart groups: Homicide rates, Conflict indicators, Governance indices
- KPI cards use standard metric card component with unit-aware formatting
- Trend charts use the shared `ToggleLineChart` with chart/table toggle and PNG export
- No custom color theme—uses platform semantic palette (slate backgrounds, teal accents)

### 2.8 Dashboard chart series colors

Dashboard trend charts assign **per-metric hex colors** in `frontend/src/pages/Dashboard.tsx` for visual distinction within multi-series charts. Colors follow a domain-consistent palette:

| Domain | Color range | Example hex values |
| --- | --- | --- |
| Financial (rates) | Orange/brown/red | `#ea580c`, `#78350f`, `#dc2626`, `#991b1b` |
| Financial (levels) | Red/brown/teal | `#991b1b`, `#92400e`, `#0d9488`, `#0f172a` |
| Health | Teal/green/blue/red | `#0f766e`, `#22c55e`, `#2563eb`, `#dc2626` |
| Education | Rose/amber/violet | `#be123c`, `#d97706`, `#7c3aed` |
| Labour | Blue/green | `#2563eb`, `#059669`, `#16a34a` |
| Crime & safety | Red/slate/amber | `#dc2626`, `#64748b`, `#f59e0b` |
| FX series | Blue/green | `#2563eb` (USD), `#059669` (EUR) |

**Rules:**
- Multi-axis charts use `yAxisId: "left"` for primary metrics and `"right"` for secondary scale (e.g. population alongside per-capita).
- Percentage metrics use `tooltipFormat: "percent"` for consistent tooltip rendering.
- Colors are assigned at chart-group level—not globally unique across the entire dashboard—to keep related metrics visually grouped.

### 2.9 Global choropleth map scale (quintile tiers)

Defined in `frontend/src/lib/choroplethTiers.ts` and consumed by `GlobalChoropleth.tsx` + `ChoroplethTierLegend.tsx`:

**Semantic fills (non-tier):**

| Token | Hex | Usage |
| --- | --- | --- |
| `CHOROPLETH_NO_DATA` | `#e2e8f0` | Country with no published value for selected metric/year |
| `CHOROPLETH_EXCLUDED` | `#f1f5f9` | Economies excluded from current map scope |
| `CHOROPLETH_ANTARCTICA` | `#f8fafc` | Antarctica neutral fill |

**Five rank tiers (quantile breaks within current map scope):**

| Tier | Short label | Rank label | Color |
| --- | --- | --- | --- |
| 1 | Lowest | Bottom 20% | `#bae6fd` (sky-200) |
| 2 | Low | Lower 20% | `#0ea5e9` (sky-500) |
| 3 | Mid | Middle 20% | `#0369a1` (sky-700) |
| 4 | High | Upper 20% | `#1e3a8a` (blue-900) |
| 5 | Highest | Top 20% | `#172554` (blue-950) |

**Rules:**
- Tier breaks are computed from **countries in the current map scope** (respects region filter), not a fixed global scale.
- `CHOROPLETH_TIER_GRADIENT` is reused in the map tooltip distribution bar for visual consistency.
- Legend shows tier labels, rank bands, economy count, and hover titles with value ranges + country counts.
- Hovered country border: `#0f172a` (slate-900); accent dot uses the country’s tier color.

### 2.10 Map country tooltip (`MapCountryTooltip.tsx`)

Rich analytics tooltip for choropleth hover (not shared with chart tooltips):

| Element | Design token / pattern |
| --- | --- |
| Surface | `rounded-xl border-slate-200 bg-white shadow-lg`; max width `19.5rem` |
| Accent bar | 4px top strip in tier accent color |
| Context chip | Tier badge with color swatch + `{shortLabel} · {rankLabel}` (replaces prior above/below-average chip) |
| Value panel | `bg-slate-50` with large tabular value (`1.5rem` bold) |
| Distribution bar | Tier gradient fill + median marker + country position marker |
| Rank highlight | `text-teal-700` for rank cell and percentile sub-label |
| Stat grid | 3×2 grid: bottom/top/median/mean/mode/rank with hint microcopy |

Curated metric blurbs (`metricTooltipBlurb.ts`) provide plain-English one-liners; fallback tightens the first catalog sentence to ≤108 characters.

### 2.11 Motion and feedback tokens (`frontend/src/index.css`)

| Class / animation | Purpose | Behavior |
| --- | --- | --- |
| `.toast-slide-in` / `cap-toast-in` | Toast entrance | 0.32s cubic-bezier; opacity + scale 0.98→1 |
| `.toast-progress` / `cap-toast-progress` | Auto-dismiss progress bar | Linear width 100%→0%; pauses on `.group:hover` |
| `.tools-live-pulse` / `cap-tools-pulse` | Header tools activity pulse | Emerald ring pulse (~1.2s) |
| `.assistant-thinking-dot` / `assistant-thinking-bounce` | Assistant “thinking” indicator | Three staggered dots (0 / 0.15s / 0.3s delay) |
| `.cap-map-tooltip` / `cap-map-tooltip--visible` | Map hover tooltip entrance | Fade + slight scale; respects `prefers-reduced-motion` |
| `.cap-map-tooltip-marker` | Distribution bar position marker | Subtle pulse on value marker |
| `.cap-map-tooltip-track` | Tooltip positioning layer | `translate3d` for smooth cursor follow |

### 2.12 PageIntro and Sources chrome

- Top accent bar: `from-teal-500/70 via-slate-200 to-red-500/50`
- Eyebrow text: `text-teal-700`
- Shared copy source: `frontend/src/lib/platformCopy.ts` (`PAGE_INTRO`, `APP_TAGLINE_*`, `PLATFORM_DATA_SOURCES`)

### 2.13 Shared data table system (`DataTable.tsx` + `index.css`)

Canonical table UI for Dashboard comparison, Compare Countries pair table, Global Analytics tables, and chart/table series views.

**Component API** (`frontend/src/components/ui/DataTable.tsx`):

| Component | Purpose |
| --- | --- |
| `DataTableShell` | Scroll container with optional framed border, footer slot, wide mode |
| `DataTable` | Base `<table>` with `compact` / `wide` size modifiers |
| `DataTableHead` / `DataTableBody` / `DataTableRow` | Semantic table sections with shared row hover |
| `DataTableCell` | Cell with modifiers: `numeric`, `label`, `sticky`, `muted`, `accent` (`a`/`b`), `highlight` |
| `DataTableGroupRow` | Category divider row (Compare Countries metric groups) |
| `DataTableEmpty` | Standard missing-value placeholder (`—`) |
| `DataTableMetricValue` | Primary value + optional inline YoY/delta badge |
| `DataTableFooterBar` | Row count + optional “Scroll for more columns” hint |

**Sortable headers** (`SortableTh.tsx`):
- Uses `cap-data-table-sort-th` styling; active sort column uses `cap-data-table-sort-th--active` (teal `rgb(13 148 136)`)
- Supports `sticky` first column, `align="right"`, and `aria-sort` for accessibility

**CSS token reference** (`frontend/src/index.css`):

| Token | Behavior |
| --- | --- |
| `.cap-data-table-wrap--framed` | Rounded border shell (`slate-200`), white background |
| `.cap-data-table-head` | Sticky header with backdrop blur |
| `.cap-data-table-row` | Hover `slate-50`; zebra striping on even rows |
| `.cap-data-table-cell--sticky` | Sticky first column with row-parity background sync |
| `.cap-data-table-cell--accent-a` | Sky tint (`rgb(240 249 255 / 0.25)`) — Compare country A |
| `.cap-data-table-cell--accent-b` | Amber tint (`rgb(255 251 235 / 0.25)`) — Compare country B |
| `.cap-data-table-cell--highlight` | Teal metric value emphasis for leading country |
| `.cap-data-table-metric-delta--neutral` | Inline delta badge styling |
| `.cap-data-table-group-cell` | Section header row for grouped metrics |
| `.cap-data-table-scroll-hint` | Visible on wide tables when horizontal scroll is expected |
| `.cap-fs-table-shell` / `.cap-viz-fs-table` | Fullscreen table density overrides |

**Adopted in:**
- `DashboardComparisonTable.tsx` — country vs regional vs global
- `CountryPairTable.tsx` — dual-country comparison with A/B accents
- `GlobalAnalytics.tsx` — map-side metric table + category tables
- `SeriesLineDataTable.tsx` — chart/table toggle time-series tables

### 2.14 Global WLD Charts UI (`wldCharts/*`)

Modular Global Analytics → Charts surface (replaces monolithic `GlobalWldCharts` body):

| Piece | Role |
| --- | --- |
| `catalog.ts` | Chart groups + line colors + `WLD_PERCENT_KEYS` (mirrors backend `wldChartCatalog.ts`) |
| `WldChartGroupSection.tsx` | Controlled accordion; fetch only after open |
| `WldLineChartCard.tsx` | Recharts card, granularity, table toggle, labour derived rows |
| `useWldChartSeries.ts` | Per-chart `GET /api/global/wld-series`; maps `global-wld-series-*` warnings |
| `axisScale.ts` | Dual-axis when catalog `dualAxis` or max/min ≥ 8 |

**Color notes:** Line colors follow Dashboard chart series conventions (§2.8). Labour group may derive unemployed counts from `unemployment_ilo × labor_force_total`. FX charts are country-only and omitted from WLD.

## 3) Component standards

### 3.1 Surfaces and cards

Standard “content card” look:
- Rounded container (commonly `rounded-2xl`)
- Border based on `slate-200`
- Background `white`
- Soft shadow (`shadow-sm`)
- Padding for spacing hierarchy (commonly `p-4` / `sm:p-5`)

### 3.2 Typography

- Use strong hierarchy for analysis blocks (H2/H3).
- Avoid dense paragraphs for numeric-heavy areas; prefer short paragraphs and structured lists.
- Numeric values and tables should favor monospaced/tabular emphasis when meaning depends on precise reading.

### 3.3 Buttons and actions

Primary actions:
- Use dark/neutral emphasis (commonly `bg-slate-900` + `text-white`)

Secondary or constructive actions:
- Use accent colors (commonly red for “generate” in analysis modules and teal for “hover/soft actions”)

Button states:
- Disabled: reduce opacity and prevent pointer events.
- Focus: ensure visible focus ring for keyboard users.

### 3.4 Inputs, selects, and checkboxes

- Inputs/selects should use consistent border and internal padding.
- Labels should be explicit and remain close to the control.
- The UI must not rely solely on color to indicate selection (checkbox + label).

### 3.5 Tables

Tables are a core analysis output. All primary analytical tables use the **shared DataTable system** (§2.13).

Standards:
- Sorting enabled via `SortableTh` on analytical comparison tables
- Sticky first column (`label`) on wide tables for row context while scrolling
- Missing values render through `DataTableEmpty` (`—`) — never implicit zero
- Compare pair tables use accent-a/accent-b column tints and `highlight` for leading values
- Footer bar shows row count; wide tables show scroll hint
- Fullscreen tables use `.cap-fs-table-shell` density overrides for readability

### 3.6 Charts and chart/table toggles

- Chart/table toggles must preserve context so exports and comparisons remain consistent.
- If a chart and its table view are both available, the toggle should not reset filters or year ranges.

### 3.7 Fullscreen mode (charts, tables, maps)

Fullscreen is a first-class UX state:
- The fullscreen container expands to viewport width/height.
- Chart/table/map shells must resize dynamically to remove “dead space” and keep labels readable.
- Avoid nested duplicated actions inside the fullscreen modal.

The CSS behavior is controlled via the fullscreen wrapper classes (notably `.cap-viz-fullscreen`), which also increase tick/legend label font sizes for readability.

### 3.8 Badges and notices

Verified Web Answer Mode badge:
- Background uses the positive semantic palette.
- Should explain what “verified” means in plain language (time-sensitive web grounding).

Highlighted country callout:
- Uses the warning semantic palette so users can immediately see where emphasis is applied.

Error notices:
- Use red semantic palette and show actionable next steps (try again, adjust filters, check keys).

### 3.9 Header-level key management panel

The `AI API Keys (App-wide)` panel is a top-level operational control and must follow these rules:
- Render key inputs in one row on medium+ screens.
- Show per-key status chips (`Not checked`, `Checking`, `Valid`, `Invalid`) with text labels (not color-only meaning).
- Provide explicit actions: `Validate keys`, `Clear keys`, and remember mode controls.
- Keep helper text concise and security-aware (session vs persistent storage behavior).
- Ensure panel does not crowd/overlap API transport widget; both should share header row cleanly at desktop sizes.

### 3.10 Business Analytics control surface standard

- Use responsive grouped control cards (`lg:grid-cols-12`) for:
  - year range,
  - analysis options,
  - focus country,
  - variable selectors,
  - primary action.
- Keep the generate action visually dominant but layout-adaptive:
  - full-width on small screens,
  - compact right-aligned on desktop.
- Present runtime diagnostics as lightweight chips, not blocking banners.
- Maintain explicit loading progress bars for both:
  - correlation analysis fetch,
  - narrative generation.

### 3.11 Presentation mode standard

- Provide a clean “review mode” that hides filter/diagnostic chrome while preserving core outputs.
- Toggle must be available via:
  - explicit button,
  - keyboard shortcut (`P`) with safe guards (ignore while typing in editable controls).
- Presentation mode should never alter computed results; only visual chrome.

### 3.12 Sources page accordion pattern

- Major sections must support expand/collapse with consistent chevron behavior.
- Metric cards should support sub-section disclosure (`Formula`, `Sources`) for scanability.
- Default collapsed state is recommended for high-density sections to reduce visual load.

## 4) Accessibility standards (must-have)

- Ensure adequate contrast between text and backgrounds.
- All controls must be keyboard operable.
- Avoid color-only meaning: provide text labels for statuses and selections.
- Keep focus states visible and consistent.

## 5) UX writing rules

- Keep user-facing content direct and neutral.
- Separate fact from interpretation.
- Mention scope and uncertainty when evidence is limited (especially assistant outputs).

## 6) Practical QA checklist for releases

Before shipping UI changes, validate:
- Readability in normal and fullscreen states
- Export buttons work from fullscreen and non-fullscreen contexts
- Table sorting and toggle state remain stable
- Badges/notice bars show correct semantics (verified/warning/error)
