# Growthomic Inventory & Business OS — Design Specification (Shopeers Reference)

> **Design Source of Truth:** Shopeers AI-Powered B2B eCommerce Analytics Dashboard  
> **Reference URL:** [dribbble.com/shots/26628350-Shopeers](https://dribbble.com/shots/26628350-Shopeers-AI-Powered-B2B-eCommerce-Analytics-Dashboard)  
> **Reference Asset:** `design/reference/shopeers_dashboard_reference.png`  
> **Compliance:** BINDING per `ANTI_SLOP_UI_RULES.md` and `DECISIONS.md`.

---

## 1. Visual Personality & Core Philosophy

- **Vibe:** Ultra-clean, modern, data-dense European/B2B SaaS dashboard (comparable to Linear, Supabase, and Stripe).
- **Dual Theme:** Native **Light Mode** (crisp, light gray canvas `#F4F6F9` with pure white `#FFFFFF` cards) and **Dark Mode** (deep midnight `#0B0F17` with dark slate surfaces `#121826` and subtle borders).
- **Elevation Philosophy:** Zero heavy drop shadows. Crisp 1px borders (`#E2E8F0` / dark: `#1E293B`) with micro-elevation (`0 1px 2px rgba(0,0,0,0.03)`).
- **One Signature Brand Accent:** Royal / Electric Blue (`#2563EB` / `#1D4ED8`) for primary actions, active navigational states, and prominent data highlights.

---

## 2. Color Tokens (Light & Dark)

### 2.1 Base Surfaces & Text
| Token | Light Value | Dark Value | Purpose |
|---|---|---|---|
| `bg-canvas` | `#F4F6F9` | `#0B0F17` | Root app background |
| `bg-card` | `#FFFFFF` | `#121826` | Card & panel surface |
| `bg-card-subtle` | `#F8FAFC` | `#182234` | Sub-card / table header / nested panel |
| `border-default` | `#E2E8F0` | `#1E293B` | Standard card and input border |
| `border-subtle` | `#F1F5F9` | `#172033` | Internal divider / secondary border |
| `text-primary` | `#0F172A` | `#F8FAFC` | Headings, main numbers, active labels |
| `text-secondary` | `#475569` | `#94A3B8` | Subtitles, table cells, form labels |
| `text-muted` | `#64748B` | `#64748B` | Timestamps, helper hints, shortcuts |
| `text-subtle` | `#94A3B8` | `#475569` | Placeholders, disabled states |

### 2.2 Brand & Semantic Accents
| Token | Hex Value | Background Tint (Light) | Purpose |
|---|---|---|---|
| `brand-primary` | `#2563EB` | `#EFF6FF` (`blue-50`) | Primary button, active menu item, Tuesday bar |
| `brand-hover` | `#1D4ED8` | `#DBEAFE` (`blue-100`) | Primary button hover state |
| `semantic-success` | `#10B981` | `#ECFDF5` (`emerald-50`) | Positive metrics (`+15.5%`), active status chips |
| `semantic-danger` | `#F43F5E` | `#FFF1F2` (`rose-50`) | Negative metrics (`-10.5%`), cancelled/failed items |
| `semantic-warning` | `#F59E0B` | `#FFFBEB` (`amber-50`) | Star ratings, hold status, pending items |
| `semantic-info` | `#0EA5E9` | `#F0F9FF` (`sky-50`) | Informational badges, sync notices |

---

## 3. Typography & Numerics

- **Primary Font Family:** `Inter`, `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Bangla Font Pairing:** `Hind Siliguri`, `Noto Sans Bengali`, sans-serif (for en/bn i18n support)
- **Numeric Font:** Tabular numerals (`font-feature-settings: 'tnum'`, `font-mono` on money/IDs)
- **Hierarchy Scale:**
  - `Hero Metric / KPI Large`: `32px` - `36px` | Bold (`font-bold`) | Line height `1.1`
  - `Section Title (H1/H2)`: `20px` - `24px` | Semi-bold (`font-semibold`) | Line height `1.25`
  - `Card Header (H3)`: `15px` - `16px` | Semi-bold (`font-semibold`) | Tracking `-0.01em`
  - `Body / Cell Text`: `13px` - `14px` | Medium / Regular (`font-normal` / `font-medium`)
  - `Sub-caption / Trend Label`: `11px` - `12px` | Medium (`font-medium`)

---

## 4. Layout Architecture (Shopeers Structure)

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: [Logo / Tenant Switcher]  [Search ⌘K]  [Date Filter 📅]  [+ Add widget] [Export]   │
├────────────────────┬───────────────────────────────────────────────────────────────────────┤
│ SIDEBAR (240px)    │ MAIN CONTENT AREA (fluid, p-6, max-w-[1600px])                         │
│                    │                                                                       │
│ • Dashboard (Active│ ┌─ KPI Grid (4 Cards: Page Views, Visitors, Clicks, Orders) ────────┐│
│ • Orders [Badge 46]│ └────────────────────────────────────────────────────────────────────┘│
│ • Products         │ ┌─ Main Grid (2-Column Split: 8 / 4 or 65% / 35%) ───────────────────┐│
│ • Customers        │ │ LEFT COLUMN:                                RIGHT COLUMN:           ││
│ • Finances ▾       │ │ • Total Profit Chart ($446.7K)             • Most Day Active (Bar)  ││
│   - Invoices       │ │   - Customer Breakdown (Retail/Dist/Whol)  • Repeat Cust (Gauge 68%)││
│   - Transactions   │ │ • Best Selling Products Table              • AI Assistant Orb & Chat││
│ • Settings         │ └─────────────────────────────────────────────┴───────────────────────┘│
│ [Upgrade Banner]   │                                                                       │
└────────────────────┴───────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component Inventory & Patterns

### 5.1 Navigation Sidebar
- Top: Logo + workspace/tenant dropdown indicator.
- Search button / shortcut indicator (`⌘K`).
- Navigation Items: Height `40px`, padding `x-3`, border radius `rounded-xl`.
  - Active state: Background `#EFF6FF` (dark: `#1E293B`), text `#2563EB` (dark: `#60A5FA`), left accent bar `w-1` or bold icon.
  - Hover state: Background `#F8FAFC` (dark: `#1E293B/50`).
  - Badges: Pill shaped `bg-emerald-100 text-emerald-700` (`46` orders).
- Upgrade Card: Vibrant royal blue gradient (`from-blue-600 to-indigo-700`) with rounded-2xl border, shield icon, and quick action button.

### 5.2 Header Bar
- Date Range Selector: Pill container `rounded-full border border-slate-200 bg-white px-3 py-1.5` with calendar icon + dropdown `Last 30 days ▾`.
- Search Bar: Centered or left-aligned `rounded-full` input with search icon and `⌘K` badge.
- Action Buttons:
  - `Add widget`: Outlined pill button (`border border-slate-200 bg-white hover:bg-slate-50`).
  - `Export`: Primary button (`bg-blue-600 text-white hover:bg-blue-700 rounded-full shadow-sm`).
- Utilities: Theme toggle (sun/moon switch), Notifications bell with unread dot, Avatar with dropdown.

### 5.3 Metric KPI Cards (Top Row)
- Card Container: `bg-white dark:bg-card border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]`.
- Metric Layout:
  - Top: Label (`Visitors`) + Right Icon in colored circular pill (`bg-blue-50 text-blue-600 p-2 rounded-full`).
  - Middle: Large value (`6,225`) in bold tabular numbers.
  - Bottom: Trend Badge (`+8.4%` in `bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full`) + Subtitle (`vs. 5,732 last period`).

### 5.4 Analytics Charts
- **Total Profit Area Chart:**
  - Area fill with gradient from `#2563EB` (opacity 0.2) to transparent.
  - Interactive tooltip card with rounded corners showing current month vs last month comparison.
  - Integrated customer segment pills below chart (`Retailers: 2,884`, `Distributors: 1,432`, `Wholesalers: 562`).
- **Most Day Active (Bar Chart):**
  - Days of week on X-axis (`Sun` - `Sat`).
  - Active peak day (`Tue - 8,162`) highlighted in bold `#2563EB` bar with floating tooltip.
  - Other days in subtle muted gray `#E2E8F0` (dark: `#334155`).
- **Repeat Customer Rate (Gauge Chart):**
  - Semi-circular radial gauge with emerald green ticks.
  - Center bold percentage (`68%`), goal marker (`On track for 80% target`), and "Show details" button.
- **AI Assistant Widget:**
  - Center 3D animated blue glowing sphere.
  - Pill input field at bottom: "Ask me anything..." with voice input icon and blue submit arrow.

### 5.5 Data Table (Best Selling Products)
- Headers: Uppercase `text-[11px] font-semibold text-slate-400 tracking-wider`.
- Row Height: `56px` with subtle `border-b border-slate-100 dark:border-slate-800`.
- Columns:
  - `ID`: Monospace `#83009`.
  - `NAME`: 36px rounded thumbnail avatar + product title with ellipsis truncation.
  - `SOLD`: `2,310 sold` in muted slate.
  - `REVENUE`: Bold formatted currency (`৳124,839` or `$124,839`).
  - `RATING`: Amber star icon + rating score `★ 5.0`.

---

## 6. Anti-Slop Checkpoints

- [x] **No generic purple/indigo AI gradients:** Used exact clean Shopeers royal blue `#2563EB` and neutral surfaces.
- [x] **No fuzzy glassmorphism blur:** Crisp, opaque cards with 1px border.
- [x] **No fake decorative emojis:** Used precise `lucide-react` line icons matching reference.
- [x] **Data-dense business UX:** Tabular numbers, clean padding, sticky headers, realistic inventory and sales data.
- [x] **Full Light and Dark Theme Tokens:** Both themes specified and tested.
