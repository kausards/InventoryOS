# ANTI-SLOP UI RULES — Growthomic Inventory & Business OS
**Audience:** every AI coding agent that builds or changes any UI.
**Status:** BINDING. Place at repo root next to `SECURITY_AND_TESTING_RULES.md` and `PROGRESS.md`.
**Goal:** the product must look like it was designed by a human product designer for a data-heavy business tool, not generated from default AI templates.

---

# 0. THE ONE RULE

**The owner's reference images are the design source of truth.** Never fall back to "what AI UIs usually look like." If a reference does not cover something, extend the reference's system (same tokens, same density, same component style) or ask the owner. Do not invent a new visual style.

---

# 1. REFERENCE-FIRST WORKFLOW (mandatory before any UI code)

1. The owner places reference images in `/design/reference/` (screenshots of dashboard, table/list page, detail/form page, modal, mobile screen, etc.).
2. **Before writing any UI**, the agent studies every reference image and writes `/docs/design-spec.md` containing:
   - **Layout:** sidebar/topbar structure, widths, grid, page max-width, content padding.
   - **Color tokens:** background, surface, border, text (primary/secondary/muted), accent, and semantic colors (success, warning, danger, info) as exact values sampled from the images.
   - **Typography:** font families (and Bangla font pairing), sizes, weights, line heights, letter spacing, numeric style.
   - **Spacing scale and radius scale** (the real values used in the references).
   - **Elevation:** which surfaces have shadows/borders and how strong (often none).
   - **Component inventory:** buttons (variants/sizes), inputs, selects, tables (row height, header style, zebra/hover), badges/status chips, tabs, cards, modals/drawers, toasts, empty states, pagination, filters, bulk-action bar, charts style.
   - **Density:** how compact rows and controls are.
   - **Iconography:** icon set, stroke width, size, when icons are used.
   - **Do/Don't notes** specific to the references.
3. The agent lists anything ambiguous or missing and **waits for owner approval** of `design-spec.md`.
4. The agent converts the approved spec into **design tokens** (Tailwind theme + CSS variables) in one place (`/apps/web/src/styles/tokens.css` and `tailwind.config`). Components may only use tokens.
5. Only then build components and pages. Each new page is compared against the reference (Section 9).

If no reference image exists yet, the agent must **stop and ask the owner for one**. It must not guess a style.

---

# 2. BANNED SLOP PATTERNS (never do these)

**Visual**
- Purple/blue/indigo gradients, gradient text, gradient buttons, gradient hero backgrounds.
- Glassmorphism/blur cards, neon glows, floating blobs, mesh gradients, decorative grid/dot backgrounds.
- Everything rounded-2xl/3xl with soft heavy shadows. Cards inside cards inside cards.
- Default shadcn/ui look left unchanged (default slate palette, default radius, default shadows). Components must be re-themed to the design spec.
- Icons inside colored circles/squares used as decoration on every card.
- Emojis used as icons or decoration in UI (👋 🚀 ✨ 📦). Allowed only if the owner's reference does it.
- Large illustrations or emoji in empty states, "Oops!" mascots.
- Pill-shaped everything; uniform same-size card grids with identical padding for unrelated content.
- Low-contrast gray text on gray backgrounds; decorative dividers everywhere.
- Dark-mode "cyberpunk" styling unless the reference is that.

**Layout**
- Marketing-style hero sections inside an operations app.
- Four identical KPI cards with big number + tiny icon + tiny trend arrow as the entire dashboard.
- Centered, narrow, wasteful layouts for data screens; excessive whitespace that hides data.
- Fake charts with no meaning; charts used where a number or table is clearer.
- Sidebar with 15 equal items, no grouping or hierarchy.

**Copy**
- Filler marketing words: "Seamlessly", "Unlock", "Elevate", "Supercharge", "Streamline", "Powerful", "Effortless", "Revolutionize".
- "Welcome back, <name>! 👋" greeting banners, motivational text, fake testimonials, fake statistics, lorem ipsum, "John Doe" data in production paths.
- Vague buttons ("Get Started", "Submit", "Click here"). Use specific verbs ("Confirm order", "Send to Steadfast").
- Error text like "Something went wrong." with no cause/next step.

**Behavior**
- Decorative animation (bouncing, floating, shimmer on non-loading elements, page-load fanfare). 
- Hover effects that move layout; scale-up cards on hover.
- Modals for things that should be inline or a page; toasts for errors that need to stay visible.
- Disabled buttons with no explanation.

**Process**
- Building UI from default component libraries "as is."
- Hard-coded colors, font sizes, spacing or radii inside components.
- Inventing new components/styles that are not in `design-spec.md`.

---

# 3. THIS IS A DATA-HEAVY BUSINESS TOOL — DESIGN ACCORDINGLY

Users are order staff, warehouse staff and accountants working all day, often on mobile (order entry, packing).

1. **Tables are first-class:** sticky header, fixed row height per the reference density, column alignment (text left, numbers/money right with tabular numerals), sortable columns, column visibility, sticky first column on horizontal scroll, server-side pagination, row hover and keyboard focus, bulk-select with a bulk-action bar.
2. **Status is semantic and consistent:** one status-chip component mapping every order/payment/shipment/return/risk status to a defined color + label. Risk uses red/amber/green with the triggering rule available on hover/click.
3. **Filters:** visible filter bar, applied filters shown as removable chips, saved filters, URL-synced filters.
4. **Forms:** labels always visible (not placeholder-only), inline validation with specific messages, logical grouping, sensible defaults, keyboard-friendly, autosave drafts only where specified. Quick-order screen optimized for fast entry (phone first, customer lookup, product search by SKU/barcode).
5. **Detail pages:** key facts and primary action in the header, tabs/sections for the rest, a clear timeline, destructive actions separated and confirmed.
6. **Money and numbers:** ৳ formatting from one shared formatter, right-aligned, tabular numerals, negative values clearly marked; Bangla numerals optional by setting.
7. **Empty states:** one short line explaining what goes here + the primary action. No illustration unless in the reference.
8. **Loading:** skeletons shaped like the real content for tables/cards; spinners only for button actions.
9. **Errors:** show what failed, why if known, and what to do (retry, contact, fix field). Integration errors show provider, time and request ID.
10. **Confirmations:** destructive or irreversible actions (cancel order, adjust stock, finalize) show consequence in plain words.

---

# 4. DESIGN TOKENS & CODE RULES

1. All colors, font sizes, spacing, radii, shadows, z-index and breakpoints come from tokens. **No raw hex, no arbitrary pixel values** in components (a lint/CI check should flag them).
2. **One accent color** (from the reference) plus semantic status colors. No extra decorative colors.
3. Type scale limited to the reference's sizes (typically 5–7 steps). No random `text-[13px]`.
4. Spacing from a fixed scale (e.g., 4/8 base). Same kind of element uses the same spacing everywhere.
5. Components live in a shared UI package/folder; pages compose them. No one-off styled copies.
6. Every component has: default, hover, focus-visible, active, disabled, loading, error states where relevant.
7. Dark mode only if the reference includes it; otherwise light only. If both, tokens must define both.

---

# 5. TYPOGRAPHY & BANGLA

1. Use the font(s) from the reference. Do not default to the same generic font everywhere without checking the reference.
2. **Bangla:** pair with a proper Bangla font (e.g., Noto Sans Bengali / Hind Siliguri / the reference's choice), with correct line-height (Bangla needs more vertical room), no clipped matras, and verified rendering in tables, buttons, badges and printed PDFs.
3. Layouts must not break when Bangla text is longer or taller than English. Test every screen in both languages.
4. Never hard-code UI strings; use i18n keys (en/bn).

---

# 6. ICONS, IMAGES, CHARTS

1. One icon set only, one stroke width, consistent sizes; icons support meaning (actions, statuses), never decoration.
2. Product images: consistent aspect ratio, placeholder style from the reference, lazy loading.
3. Charts: only when they answer a question. Minimal chart chrome (no 3D, no heavy gridlines, no gradient fills unless in reference), direct labels where possible, colors from tokens, accessible without color alone, tooltips with exact values, axis units shown (৳, orders).

---

# 7. MOTION

1. Motion is functional only: 100–200ms transitions for hover/focus/open-close. Respect `prefers-reduced-motion`.
2. No parallax, no entrance animations for content, no looping animations (except loading indicators).

---

# 8. ACCESSIBILITY & RESPONSIVENESS (NOT OPTIONAL)

1. Text contrast ≥ 4.5:1 (3:1 for large text and UI borders). Verify tokens, not just visuals.
2. Visible focus ring on all interactive elements; full keyboard operation for tables, dialogs, menus, forms.
3. Proper semantic HTML, ARIA only where needed, labels tied to inputs, error text linked via `aria-describedby`.
4. Touch targets ≥ 44px on mobile.
5. Breakpoints verified at **1440, 1024, 768, 390** widths. Order entry, order list, packing/receiving screens must be fully usable at 390px (tables become cards or scroll with sticky key columns).
6. No horizontal page scroll; wide content scrolls inside its own container.

---

# 9. UI REVIEW GATE (every UI task)

For each page/component the agent must:
1. Take screenshots (Playwright) at 1440, 768, 390 in **English and Bangla**, saved to `/design/screenshots/<milestone>/<page>-<width>-<lang>.png`.
2. Compare against the closest reference and list **deviations** (spacing, color, type, density, component style) with a reason for each, or fix them.
3. Run the **Slop Checklist** below and report results.
4. Not mark the UI item `[x]` in `PROGRESS.md` until the checklist passes and the owner has had the chance to review screenshots for new screen types.

## Slop Checklist (all must be "yes")
- [ ] Matches the reference's layout, density and component style
- [ ] Uses only design tokens (no raw hex/px values)
- [ ] No banned pattern from Section 2 present
- [ ] One accent color + semantic status colors only
- [ ] Copy is specific, plain, real (no filler, no fake data)
- [ ] Tables/forms follow Section 3 rules
- [ ] Bangla renders correctly; layout survives longer text
- [ ] Loading, empty, error and permission-denied states exist and match the style
- [ ] Contrast, focus, keyboard and 390px mobile checked
- [ ] Money/number formatting uses the shared formatter
- [ ] No unrequested animation or decoration

---

# 10. UI SECTION OF THE COMPLETION REPORT

Add to every milestone's Completion Report:
```
UI PAGES/COMPONENTS ADDED: <list>
REFERENCE USED FOR EACH: <image file names>
DESIGN SPEC CHANGES: <none / list + approval>
SCREENSHOTS: <paths>
SLOP CHECKLIST: pass/fail per item
DEVIATIONS FROM REFERENCE: <list + reason>
```

---

# 11. WHEN IN DOUBT
Prefer plain, dense, readable and consistent over decorative. If a design choice cannot be traced to the reference or a rule in this file, do not make it. Ask the owner.