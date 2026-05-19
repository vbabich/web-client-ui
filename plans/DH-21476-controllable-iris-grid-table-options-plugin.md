# Plan: Plugin Replacement of the Table Options Sidebar

> **Status**: blocked on the chosen controllability branch landing on `main`.
> **Owner**: TBD (the plugin lives in `deephaven-plugins/plugins/table-options/`).
> **Working branch**: `feat/table-options-plugin` in `deephaven-plugins`; framework changes go through PRs in `web-client-ui`.
> **Depends on**: [Phase 0](./DH-21476-controllable-iris-grid-state.md#phase-0--shared-foundation-both-branches-build-on-this) **and** the winning controllability branch ([A](./DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md), [B](./DH-21476-controllable-iris-grid-state-branch-b-expanded-override.md), or [C](./DH-21476-controllable-iris-grid-state-branch-c-idiomatic-react-rewrite.md)).
> **Definition of Done**: every `OptionType` in the table below has a working plugin replacement; built-in pages remain available as the default; render-count regression test green; documentation in `deephaven-plugins/plugins/table-options/README.md`.
> **Quick commands**:
>
> ```bash
> # web-client-ui side (sidebar slot)
> npm run test:unit -- --testPathPattern="packages/iris-grid/src/sidebar"
> # deephaven-plugins side
> npm run test:unit -- --testPathPattern="plugins/table-options"
> npm run e2e:docker -- ./tests/table-options.spec.ts --reporter=list
> ```
>
> Filename uses a descriptive slug; rename to `DH-XXXXX-table-options-sidebar-plugin.md` once a ticket is opened.

## What "Table Options sidebar" means here

The Table Options menu ([IrisGrid.tsx#L5394](../packages/iris-grid/src/IrisGrid.tsx#L5394)) is a stack-based slide-in panel rendered by `IrisGrid` itself. Its contents are enumerated by `getCachedOptionItems` ([IrisGrid.tsx#L1168](../packages/iris-grid/src/IrisGrid.tsx#L1168)), keyed by [OptionType.ts](../packages/iris-grid/src/sidebar/OptionType.ts):

| OptionType | Sidebar component | Drives state field(s) |
| --- | --- | --- |
| `CHART_BUILDER` | [ChartBuilder.tsx](../packages/iris-grid/src/sidebar/ChartBuilder.tsx) | callback `onCreateChart` (no grid state) |
| `VISIBILITY_ORDERING_BUILDER` | [visibility-ordering-builder/](../packages/iris-grid/src/sidebar/visibility-ordering-builder) | `movedColumns`, `userColumnWidthsByName` (hide=0), `frozenColumns`, `columnHeaderGroups` |
| `CONDITIONAL_FORMATTING` (+ `_EDIT`) | [conditional-formatting/](../packages/iris-grid/src/sidebar/conditional-formatting) | `conditionalFormats`, `conditionalFormatPreview`, `conditionalFormatEditIndex` |
| `CUSTOM_COLUMN_BUILDER` | [CustomColumnBuilder.tsx](../packages/iris-grid/src/sidebar/CustomColumnBuilder.tsx) | `customColumns` (model swap) |
| `ROLLUP_ROWS` | [RollupRows.tsx](../packages/iris-grid/src/sidebar/RollupRows.tsx) | `rollupConfig` (model swap) |
| `AGGREGATIONS` (+ `_EDIT`) | [aggregations/](../packages/iris-grid/src/sidebar/aggregations) | `aggregationSettings`, `selectedAggregation` |
| `SELECT_DISTINCT` | [SelectDistinctBuilder.tsx](../packages/iris-grid/src/sidebar/SelectDistinctBuilder.tsx) | `selectDistinctColumns` (model swap) |
| `TABLE_EXPORTER` | [TableCsvExporter.tsx](../packages/iris-grid/src/sidebar/TableCsvExporter.tsx) | transient: `isTableDownloading`, `tableDownloadProgress`, … |
| `ADVANCED_SETTINGS` | [AdvancedSettingsMenu.tsx](../packages/iris-grid/src/sidebar/AdvancedSettingsMenu.tsx) | `advancedSettings` (workspace-level via callback) |
| `QUICK_FILTERS` (toggle) | n/a | `isFilterBarShown` |
| `SEARCH_BAR` (toggle) | n/a | `showSearchBar`, `searchValue`, `selectedSearchColumns`, `invertSearchColumns`, derived `searchFilter` |
| `GOTO` (toggle) | [GotoRow.tsx](../packages/iris-grid/src/GotoRow.tsx) | `isGotoShown`, `gotoRow`, `gotoValue`, `gotoValueSelectedColumnName`, `gotoValueSelectedFilter`, … |

A plugin that "implements all functionality" must therefore: (a) **render its own UI** in place of (or alongside) the built-in sidebar pages, and (b) **drive every listed state field** via the controllable framework. Two orthogonal extension surfaces. The framework plan covers (b); this plan adds the sidebar-slot mechanism for (a).

---

## Goals

1. Let an external `@deephaven/plugin` (e.g. a `deephaven-plugins/plugins/table-options` package) replace the entire Table Options sidebar with a custom React tree.
2. Allow partial replacement: a plugin may take over only some `OptionType`s and let the built-ins handle the rest.
3. Validate the framework end-to-end: by the time this plugin works, every controllable field in the registry has been exercised via an external consumer.

## Non-goals

- Not redesigning the sidebar UX inside `iris-grid`.
- Not refactoring the actual `ChartBuilder` / `RollupRows` / etc. components — they stay as built-in defaults.
- Not making `ChartBuilder.onCreateChart` (which spawns a chart panel) a state field; it stays a callback.

---

## Required additions to the framework plan

**Why this can't ship as a Phase 0 refactor.** The built-in sidebar pages ([RollupRows](../packages/iris-grid/src/sidebar/RollupRows.tsx), [AggregationsBuilder](../packages/iris-grid/src/sidebar/aggregations), [VisibilityOrderingBuilder](../packages/iris-grid/src/sidebar/visibility-ordering-builder), etc.) call `this.handleX` / `this.setState` directly on the `IrisGrid` class. Extracting them into a parent-rendered slot before the controllability framework exists would just turn private state coupling into a tangle of callback props piped across the new boundary — reinventing the very API Branch A or B is supposed to define. So Phase 0 only does the safe pieces (normalize sidebar mutators through `applyX`, register `isMenuShown` / `openOptions` as controllable fields). Full extraction lives **here**, on top of the chosen branch.

### Phase 1 — Extract the sidebar host (after Branch A or B lands)

1. Create `packages/iris-grid/src/sidebar/IrisGridSidebar.tsx`. It owns the `<Stack>` / `<Page>` rendering and the `OptionType → component` mapping currently inline in [IrisGrid.tsx#L5394](../packages/iris-grid/src/IrisGrid.tsx#L5394) and [getCachedOptionItems](../packages/iris-grid/src/IrisGrid.tsx#L1168). Built-in pages move with it.
2. Rewrite each built-in page to consume `IrisGridControlContext` for reads/writes instead of receiving private callbacks. With Branch A this means `useIrisGridState` + `handle.applyX`; with Branch B it means props derived from `getEffectiveState()` + `applyOverride`. Either way the page's source of truth is the public framework API — the same one a plugin would use.
3. `IrisGrid` keeps the toolbar gear button and the menu open/close state (already controllable from Phase 0 #7). It accepts a `renderSidebar?: (defaults: IrisGridSidebarProps) => ReactNode` prop. Default mounts `<IrisGridSidebar {...defaults} />` so behavior is unchanged.
4. Workspace-level callbacks (`onAdvancedSettingsChange`, `onCreateChart`, CSV worker fetch) flow through `IrisGridControlContext`; they remain callbacks, not state.

### Phase 2 — Plugin replacement surface

1. **Sidebar-slot extension point.** Add to `IrisGridSidebar` (and re-export through `IrisGrid` for ergonomics):
   ```ts
   sidebarPages?: Partial<Record<OptionType, SidebarPageComponent>>;
   menuItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
   ```
   `SidebarPageComponent` receives the `IrisGridControlContext` from Phase 0 #6. `menuItems` lets the plugin add, remove, or reorder entries. Both default to the current built-ins.
2. **Sidebar-only scratch state stays private.** Already excluded from the registry by Phase 0 #7. Replacement plugins own their own scratch state (half-edited conditional formats, gotoRow drafts, etc.) and never round-trip it through `IrisGrid`.
3. **Workspace-level callbacks** (`onAdvancedSettingsChange`, `onCreateChart`, CSV worker fetch). Still callbacks. Plugins receive them via the context.

---

## Branch evaluation

Detailed A-vs-B-vs-C scoring against this consumer is **not** speculated
here — the spike branches in the [process plan](./DH-21476-controllable-iris-grid-state-process.md)
produce real numbers that beat any up-front guess. The process plan
recommends using a smaller [Create Pivot plugin](./DH-21476-controllable-iris-grid-create-pivot-plugin.md)
as the spike consumer (faster signal, no scratch-state hazards). This
full-sidebar plugin is the **second** consumer, built on top of the
branch the spikes pick — not an evaluation tool.

Key demands this consumer places on the chosen branch (regardless of
which one wins) — use this list when reviewing the spike memos:

- Atomic multi-field updates for visibility/ordering (`movedColumns` +
  `userColumnWidthsByName` + `frozenColumns` + `columnHeaderGroups`
  changing together on a drag).
- Sub-page state for `AGGREGATIONS` → `AGGREGATION_EDIT` and
  `CONDITIONAL_FORMATTING` → `_EDIT` via the controllable `openOptions`
  page stack.
- Long-running flow escape hatch for `TABLE_EXPORTER` (download progress
  is grid-owned, not a controlled field).
- Stable-reference memoization: a 30-field round-trip on every render
  must not retrigger model fetches.
- Derived-field handling: `searchFilter` is read-only in the registry.

---

## Implementation plan for the plugin

Assumes the framework's Phase 0 has landed and *one* of A/B has been picked. Plan is staged so the same milestones apply to either branch — only the binding code at each step differs.

### Milestone 0 — Plumbing (1 PR, web-client-ui)

- Land Phase 0 additions from [DH-21476-controllable-iris-grid-state.md](./DH-21476-controllable-iris-grid-state.md): registry, `applyX` normalization, `onStateDidChange`, `IrisGridControlContext`, `modelFactory` prop on panel.
- Land the **sidebar-slot extension** described above (`sidebarPages`, `menuItems`, controllable `isMenuShown` + `openOptions`).
- Add a smoke test: render `<IrisGrid sidebarPages={{}}>` and assert built-in pages still work (regression guard).

### Milestone 1 — Skeleton plugin (1 PR, deephaven-plugins)

- New package `deephaven-plugins/plugins/table-options/` with the standard plugin scaffold ([build-plugin skill](../../deephaven-plugins/.github/skills/build-plugin/SKILL.md)).
- Registers itself as a `TablePlugin` consumer that supplies `sidebarPages` and `menuItems` overrides via `TablePluginProps`. Initially overrides **only** the menu list, replacing each entry's title with `"[plugin] <title>"` so we can see the plugin is in control end-to-end.
- E2E: docker test that opens Table Options and asserts the `[plugin]` prefix appears.

### Milestone 2 — Toggle features (1 PR)

Replace `QUICK_FILTERS`, `SEARCH_BAR`, `GOTO`. These are the simplest — single boolean (or a couple of fields) each. Validates the controllable contract for the easiest cases. JS unit tests + one Playwright e2e per feature.

### Milestone 3 — Single-field builders (1 PR each)

Replace in this order (lowest to highest blast radius):

1. `SELECT_DISTINCT` — single field, model swap.
2. `CUSTOM_COLUMN_BUILDER` — single field, model swap, async (column compile errors).
3. `ROLLUP_ROWS` — single field, model swap, plus the hidden-columns interaction landed in [DH-22326](./DH-22326-keep-hidden-columns-after-rollup.md). Reuse `resetColumnWidthByName` semantics through the plugin.
4. `AGGREGATIONS` (with `_EDIT` sub-page) — exercises the controllable `openOptions` page stack.
5. `CONDITIONAL_FORMATTING` (with `_EDIT`) — exercises preview state (which is plugin-owned, not in the registry).
6. `VISIBILITY_ORDERING_BUILDER` — multi-field atomic updates. The hardest case; first real test of the batching story.

Each step: plugin page + state binding + Jest test + one Playwright e2e. After each PR, run the conformance suite from Phase C of the framework plan to confirm no regressions in non-replaced fields.

### Milestone 4 — Workspace/long-running features (1 PR)

- `TABLE_EXPORTER` — needs a callback, not pure state. Plugin renders the form; clicks "Download" and calls `onStartDownload(settings)` from the context, which the grid implements (it owns the service worker). Progress flows back via a `downloadProgress` field that the grid emits but the plugin doesn't echo back (uncontrolled-by-design field).
- `ADVANCED_SETTINGS` — plugin renders the menu, calls `onAdvancedSettingsChange(key, value)`. No state field changes inside the grid.
- `CHART_BUILDER` — plugin renders the form, calls `onCreateChart(settings, model)`. Identical pattern.

### Milestone 5 — Persistence & dehydration (1 PR)

- Wire the plugin's state into its own panel-state envelope so layouts persist across reloads.
- Verify the built-in `IrisGridPanel.dehydrateIrisGridState` still produces the same output for fields the plugin echoes back unchanged (i.e., no drift between plugin-owned state and built-in panel persistence).

### Milestone 6 — Hardening (1 PR)

- Performance pass: render-count instrumentation in the conformance suite. Threshold: ≤ N renders per `applyX` (set N empirically from a pre-plugin baseline).
- Run the full `simple-pivot` and `ui` plugin test suites against the new `iris-grid` to confirm no compatibility breakage.
- Documentation: README in the new plugin package, plus a "Replacing the Table Options sidebar" section in the iris-grid plugin docs.

---

## Open questions

1. **Plugin granularity.** One plugin replacing all 12 features, or 12 small plugins each owning one `OptionType`? Recommendation: one package exposing 12 React components; the plugin host wires them in via `sidebarPages`. Leaves room for users to mix-and-match later.
2. **Ownership of `IrisGridPanel`.** Does the new plugin replace `IrisGridPanel` entirely (its own dashboard panel that wraps `IrisGrid` directly) or extend it via a registration hook? Recommendation: extend. Replacing the panel duplicates dehydrate/hydrate / linker / panel-state / context-menu wiring, all of which is non-trivial. A registration hook keeps that surface DRY.
3. **Backward compatibility window.** When the plugin is in use, the built-in sidebar is dead code for that grid. Should we (a) keep both code paths forever, (b) make the built-ins themselves consume the same `sidebarPages` API as a default registration, so there's only one path? Recommendation: (b) — converge the built-ins onto the same plugin contract as part of Milestone 0. Risk: bigger M0 PR. Reward: no two-path drift.
