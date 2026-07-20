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

Defined in `frontend/src/components/pestel/pestelTheme.ts`:

| Dimension | Header color | Tint (content background) |
| --- | --- | --- |
| POLITICAL | `#1e3a5f` | `#e8eef5` |
| ECONOMIC | `#2d5a4c` | `#e9f2ef` |
| SOCIOCULTURAL | `#9a7340` | `#f4efe6` |
| TECHNOLOGICAL | `#b8573a` | `#f7ece8` |
| ENVIRONMENTAL | `#6b2d38` | `#f0e8ea` |
| LEGAL | `#4a4568` | `#ebeaf2` |

### 2.5 SWOT quadrant theme colors

| Quadrant | Header color | Tint | Title |
| --- | --- | --- | --- |
| Strengths | `#2D5A4C` | `#E9F2EF` | Strengths |
| Weaknesses | `#A04A26` | `#F7EEEA` | Weaknesses |
| Opportunities | `#1D6391` | `#E8F1F6` | Opportunities |
| Threats | `#B01E43` | `#F6E8EB` | Threats |

### 2.6 Porter Five Forces accent colors

Defined in `frontend/src/components/porter/porterTheme.ts`:

| Force | Accent color |
| --- | --- |
| Threat of new entry | `#dc2626` (red-600) |
| Supplier power | `#2563eb` (blue-600) |
| Buyer power | `#2563eb` (blue-600) |
| Threat of substitutes | `#0ea5e9` (sky-500) |
| Competitive rivalry | `#64748b` (slate-500) |

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

### 2.9 Global choropleth map scale

Defined in `frontend/src/components/global/GlobalChoropleth.tsx`:
- No-data fill: `#e2e8f0` (slate-200)
- Data range: light `#fef3c7` → dark `#c2410c` (amber-to-orange sequential scale)
- Highlighted country border: `#0f172a` (slate-900)

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

Tables are a core analysis output. Standards:
- Sorting enabled on analytical comparison tables.
- Header background should use `slate-50` or an equivalent subtle elevation.
- Font size for fullscreen tables must be readable (the UI uses a dedicated fullscreen table sizing class).

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
