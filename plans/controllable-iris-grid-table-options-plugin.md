# Plan: Plugin Replacement of the Table Options Sidebar

> Companion to [controllable-iris-grid-state.md](./controllable-iris-grid-state.md). That plan defines the framework (Phase 0) and two competing controllability models (Branch A imperative-ref vs Branch B expanded-override). This plan stress-tests both branches against a single concrete, demanding consumer: a plugin that replaces **all** built-in Table Options sidebar features. Use it to evaluate which branch to invest in.
>
> Filename uses a descriptive slug; rename to `DH-XXXXX-table-options-sidebar-plugin.md` once a ticket is opened (matches the convention in [iris/plans/README.md](../../iris/plans/README.md)).

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

These extend [controllable-iris-grid-state.md](./controllable-iris-grid-state.md), Phase 0:

1. **Sidebar-slot extension point.** Add a new prop on `IrisGrid`:
   ```ts
   sidebarPages?: Partial<Record<OptionType, SidebarPageComponent>>;
   menuItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
   ```
   `SidebarPageComponent` is rendered inside the existing `<Page>` ([IrisGrid.tsx#L5400](../packages/iris-grid/src/IrisGrid.tsx#L5400)) and receives the `IrisGridControlContext` from Phase 0 #6. `menuItems` lets the plugin add, remove, or reorder entries. Both default to the current built-ins.
2. **Open/close as controllable state.** Promote `isMenuShown` and `openOptions` (the page stack) to first-class controllable fields — otherwise a plugin that replaces a page can't programmatically pop back to the menu after applying a change. Today these are `IrisGridState` only ([IrisGrid.tsx#L466](../packages/iris-grid/src/IrisGrid.tsx#L466)); they belong in the registry.
3. **Sidebar-only state fields.** `conditionalFormatEditIndex`, `conditionalFormatPreview`, `selectedAggregation`, gotoRow draft fields (`gotoRow`, `gotoValue`, `gotoValueSelectedColumnName`, `gotoValueSelectedFilter`, `gotoValueManuallyChanged`), download progress fields. These are scratch state for the built-in sidebar UIs. **Do not** put them in the registry — they're an internal detail of those components. A replacement plugin owns its own scratch state. Document this exclusion in the registry and forbid built-in sidebars from leaking these into `onStateDidChange` events.
4. **Workspace-level callbacks** (`onAdvancedSettingsChange`, `onCreateChart`, CSV worker fetch). Stay as callbacks, not state. Plugins receive them via the context.

---

## Branch evaluation against this consumer

### Branch A — imperative-ref handle

**Plugin shape.** Plugin renders its own React tree inside the `sidebarPages` slot. Each page calls `irisGridHandle.applyRollupConfig(cfg)`, `applyCustomColumns(cols)`, etc. To display current values it uses `useIrisGridState(handle, s => s.rollupConfig)`.

**What works well**
- Toggle features (`QUICK_FILTERS`, `SEARCH_BAR`, `GOTO`) map cleanly to `handle.toggleX()` calls.
- Long-running flows (`TABLE_EXPORTER` writes a CSV via a service worker) match imperative semantics — start/cancel/poll is naturally a method.
- Plugin's internal scratch state (e.g. half-edited conditional format) lives in plugin-owned React state, never ping-pongs through `IrisGrid`.
- `CHART_BUILDER`'s `onCreateChart` callback works unchanged — handle exposes it as `handle.createChart(settings)`.

**Pain points**
- **Every page needs both `useIrisGridState` and `apply` calls.** That's ~12 pages × 2 wirings = 24 hookups, each a potential subscription bug.
- **Visibility/Ordering** mutates `userColumnWidthsByName`, `movedColumns`, `frozenColumns`, and `columnHeaderGroups` together (drag-and-drop). The plugin must batch these to avoid intermediate re-renders. Need `handle.batch(() => { ... })`.
- **Aggregations editor** opens a sub-page (`AGGREGATION_EDIT`) and needs to know when it's closed to commit. Without controlled `openOptions`, the plugin can't observe the page-stack pop. Phase 0 #2 above is mandatory.
- **`searchFilter` is derived** from `searchValue + selectedSearchColumns + invertSearchColumns`. The handle must expose either the derived value (read-only) or a single `applySearch(text, cols, invert)` to keep them consistent.

**Net**: workable but verbose. The plugin ends up writing a `useIrisGridStateBindings()` helper to package up "bind this field for read+write" in one line. Perf is fine — only the subscribed fields trigger re-renders.

### Branch B — expanded-override (controlled props)

**Plugin shape.** Plugin owns a redux/zustand store with the full controllable state. Renders `<IrisGridPanel stateOverrides={store} onStateOverrideChange={dispatch} sidebarPages={...} />`. Sidebar pages read from the same store directly.

**What works well**
- One source of truth. The plugin's store *is* the grid state. No subscription dance.
- Persistence is trivial: the plugin's store is already serializable, dehydrate via existing codecs.
- Visibility/Ordering batching is free — store updates are atomic, single re-render per dispatch.
- `searchFilter` derivation: declare it read-only in the registry; plugin computes it from store inputs the same way the built-in does. One `useSearchFilter(state)` selector shared with `iris-grid`.

**Pain points**
- **Every controllable field must round-trip** even for fields the plugin doesn't care about (it has to echo them back unchanged). Mitigated by the framework offering `<IrisGridPanel uncontrolledFields={['frozenColumns', …]}>` to opt out per field — but that's extra surface area.
- **Long-running flows** (`TABLE_EXPORTER`'s download progress) are awkward as controlled state. Either the grid still owns the progress fields (Phase 0 #3 above flags these as "scratch, not registry") and the plugin calls a callback to start the download, or the plugin owns the worker too. Recommend the former.
- **Sub-page state.** `AGGREGATION_EDIT` opens a child page. With controlled `openOptions`, the plugin dispatches push/pop. With uncontrolled, the grid manages it. Either is fine, but the plugin must pick one and stick with it.
- **Re-render budget.** The grid's render path is hot (canvas redraw on every state change). Passing 30+ controlled fields means careful memoization at every layer — even one `new Map()` per render in the plugin store can tank perf. The framework must enforce stable references and provide a `useStableSnapshot` helper in `@deephaven/iris-grid`.

**Net**: cleaner architecture, more upfront work to get perf right. Pays off if multiple plugins reuse the controllable contract.

### Side-by-side scoring (this consumer only)

| Concern | Branch A | Branch B |
| --- | --- | --- |
| Lines of plugin code (estimated) | ~1.8k | ~1.2k |
| Lines of `iris-grid` change | ~600 | ~1500 |
| Atomic multi-field updates | needs `handle.batch()` | free |
| Long-running flows (CSV download) | natural | awkward; needs callback escape hatch |
| Persistence to plugin's backend | extra serialization layer | direct |
| Re-render risk | low (selector-driven) | high without strict memoization |
| Test surface | 2 channels (write, observe) | 1 (controlled props), but more fields |
| Python-side reach (deephaven-plugins) | needs RPC layer | natural (values cross the bridge) |
| Risk of regressions in built-in sidebar | low (built-in path untouched) | medium (every `applyX` gains a controlled branch) |

**Recommendation for *this* consumer**: Branch B is a better structural fit (single source of truth, natural Python reach, atomic updates) **iff** the perf work in Phase 0 is taken seriously. If Phase 0 perf landings slip, Branch A is the safer interim and can co-exist with B later.

This recommendation is consumer-specific. The framework decision in [controllable-iris-grid-state.md](./controllable-iris-grid-state.md) Phase D should weigh other consumers too (linker, FilterSetManager, `simple-pivot`, `ui` pivots).

---

## Implementation plan for the plugin

Assumes the framework's Phase 0 has landed and *one* of A/B has been picked. Plan is staged so the same milestones apply to either branch — only the binding code at each step differs.

### Milestone 0 — Plumbing (1 PR, web-client-ui)

- Land Phase 0 additions from [controllable-iris-grid-state.md](./controllable-iris-grid-state.md): registry, `applyX` normalization, `onStateDidChange`, `IrisGridControlContext`, `modelFactory` prop on panel.
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

---

## Decision checkpoint

Run Milestones 0–2 on **both** branches in parallel feature flags (matches the parallel-branch strategy of the framework plan). Compare:

- Implementation effort for the toggles (smallest functional slice).
- Render-count under a 1k-row stress test with the plugin mounted.
- DX of binding a single page (lines of plugin code, mental model).

Pick the winner before starting Milestone 3, since Milestone 3 is where the cost diverges sharply.
