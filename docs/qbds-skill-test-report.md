# QBDS frontend workflow: test report

**What was tested:** the open-source QBDS design system (Apache-2.0), by building one real app from zero: **GeoJSON Studio**, a QBDS version of geojson.tools. This covered:
- the `qb-frontend-react` agent skill
- its `setup-qbds-vite.sh` scaffold
- the public `@qbds` registry and its examples
- DESIGN.md and TOKENS.md

**How:** all four stages in order, in the skill's "just build" mode (no confirmation gates, every stage still run). The plan is in [`docs/plan/geojson-studio.ui-plan.json`](plan/geojson-studio.ui-plan.json). The app was then verified with `tsc`, oxlint, 54 unit tests and 11 Playwright tests with screenshots.

**Result:** the workflow produces a good app, but the scaffold does not build out of the box, and several docs and registry items contradict each other. Each problem below was hit during the build, not found by reading.

---

## Stage by stage

| Stage | What happened | Verdict |
| --- | --- | --- |
| 1. Requirements | The `goal / delivery / scope / constraints / assumptions` schema worked well. `delivery.mode = greenfield` with `targets` made the write location unambiguous. Researching the reference app first (its source was in the bundle) gave a precise `context`. | Works |
| 2. UX design | Splitting one goal into 6 stories (load, edit, inspect, measure, style, map) gave a clear build checklist. Separating `visual` from `interaction` helped. | Works |
| 3. UI structure | The "examples win" rule plus the registry check stopped me inventing components. 23 `@qbds` installs, 5 `newComponents`, each with a `whyNotQbds`. Writing `jsx` as an escaped string inside JSON is awkward. | Works; format friction |
| 4. Build | The scaffold failed (F1, F2) and needed manual fixes before any app code. After that, registry components composed as the examples show. | Blocked until fixed |

---

## Findings

Severity: **Blocker** stops the build. **High** gives wrong output or breaks a QBDS rule by default. **Medium** means docs disagree. **Low** is polish.

### Blockers

**F1. `setup-qbds-vite.sh` produces a project that does not build.**
`npm create vite@latest` now ships TypeScript 7, where `baseUrl` is removed. The script writes `"baseUrl": "."` into `tsconfig.json` and `tsconfig.app.json`:

```
tsconfig.app.json(18,5): error TS5102: Option 'baseUrl' has been removed.
```

Fix: drop `baseUrl` (and `ignoreDeprecations`). `paths` resolves relative to the tsconfig without it. Also pin the `create-vite` version: the script pins `shadcn@4.20.0` but takes `create-vite@latest`, so it changes under you. Ending the script with `npm run build` would catch this kind of drift immediately.

**F2. `@qbds/dropdown-menu` installs a site demo file that breaks the type check.**
It writes `src/components/dropdown-menu.tsx` (in addition to `ui/dropdown-menu.tsx`), which imports `@/app/demo/[name]/ui/action-menu-examples.shared`. That path only exists on the QBDS site, so the result is 4 TS errors. Fix: remove the demo file from the registry item's `files[]`.

### High

**F3. The scaffold imports all Material Symbols fonts.**
`index.css` gets `@import 'material-symbols'`, which bundles Sharp, Outlined and Rounded (about 13 MB of woff2). DESIGN.md §6 allows only Sharp, and `Icon` only uses `material-symbols-sharp`. Fix: `@import 'material-symbols/sharp.css'`.

**F4. Some registry components break DESIGN.md rules by default.**
| Where | What | Rule |
| --- | --- | --- |
| `sonner.tsx` | `border-l-4` coloured side stripe on every toast | §12: never a coloured side-stripe on alerts or panels |
| `table.json#TableSizes` | `text-sm font-medium` | §3: weights 300/400/600 only; named type classes |
| `badge.tsx` (brand-accent) | `text-mist-50` | §12: no primitives in product UI |
| `button.tsx` (accent) | `text-[var(--slate-900-opacity-88)]` | TOKENS: no inline vars or primitives |
| `scroll-area.tsx` | `focus-visible:ring-ring/50`, `bg-border` | stock shadcn tokens, not QBDS |
| `toolbar.tsx` | default `shape="circle"` gives `rounded-full` buttons | §12: no `rounded-full` on rectangular buttons |

An agent following "use the registry" faithfully ships these violations.

**F5. Third-party CSS beats Tailwind v4 utilities (integration gotcha).**
`maplibre-gl.css` is unlayered and sets `.maplibregl-map { position: relative }`. That overrides Tailwind v4's layered `absolute inset-0` on the same element, so the map's hit area collapsed and no map clicks registered. This isn't a QBDS bug, but every QBDS app that adds a map, editor or chart library with its own CSS can hit it. The skill should say: put utilities on a wrapper, not on an element a library styles.

### Medium: docs disagree with each other

**F6. The logos are swapped in `component-guidelines.md`.** It lists `qb-logo-white.svg` as the light-mode logo and `qb-logo-black.svg` as dark. The SVG fills show the white one is for dark backgrounds.

**F7. `ui-structure.md` cites a component that doesn't exist.** Its schema example uses `@qbds/empty` and `examples/empty.json`, but `empty` is not in `registry.json`.

**F8. Examples import modules the skill doesn't mention.** The skill says to strip `@/components/registry/*` and `@/lib/demo-utils`. Examples also import:
- `@/components/ui/collapsible` (sidebar `SidebarApp`; not in the registry)
- `./input-group-config` (every input-group example)
- `@/app/demo/[name]/ui/action-menu-examples.shared` and `ACTION_MENU_PANEL_DEMO` (dropdown-menu)

**F9. The header height is defined twice, differently.** `app-layout-archetypes.md` says Navbar `h-14`; `sidebar.json#SidebarApp` uses `h-[72px]`. Since "example composition wins", the archetype rule is effectively dead.

**F10. Undocumented API traps.**
- Calling `toast('…')` directly gives an unstyled sonner toast. Only `toast.success/error/warning/info/default` use the QBDS look.
- `TableCell` has a fixed `h-[60px]`, so any dense table needs an override.
- A standalone pressed `ToolbarButton` (Base UI Toggle) shows a blank square, because the icon colour equals the pressed fill. It only works if you render the QBDS `Toggle` / `ToggleGroupItem`, as the example does.

### Low

**F11.** The `sonner` registry item installs `next-themes`, which isn't used (`sonner.tsx` has its own theme observer). It's dead weight in Vite apps.

**F12.** On day one, the scaffold's own `oxlint` reports 41 `only-export-components` warnings, all from registry files.

**F13.** There's no guidance for maps or geospatial data. DESIGN.md covers chart colours (ECharts) but not map layers. I treated features as chart data (qualitative #1 default, #7 selection, sequential for choropleth), which worked well. That could be a short "Maps" note in DESIGN.md.

**F14.** The scaffold sets up no tests, and the skill has no verify stage. Two of the biggest bugs in this build only showed up in a real browser:
- the map hit area (F5)
- MapLibre's `to-number(null) = 0`, which made every line 0 px wide

A "Stage 5: verify" with a build plus a Playwright smoke test would catch both classes of bug.

---

## What worked well

- **Plan-first with confirm gates:** the JSON plan made scope and decisions explicit and reviewable, and the stage docs are short and focused.
- **Delivery modes:** greenfield / pages / feature is a clear contract for where code lands.
- **Registry plus examples:** composition from the examples (toolbar, input-group, card, select, tabs, sonner) needed almost no custom styling. Nothing in the UI uses raw hex or primitives except the documented chart-colour exception.
- **Token-driven theming:** the CodeMirror editor is themed purely from QBDS CSS variables, so dark/light switching needed no extra work.

## Agent deviations from the skill

- All stage docs were read before stage 1, because they had already been read while explaining the skill. The skill asks to open only the current stage's doc.
- "Just build" mode skipped all confirmation gates.
- I used `examples/index.json`, which holds every example, instead of fetching `examples/<name>.json` per component. Same data, one request.
