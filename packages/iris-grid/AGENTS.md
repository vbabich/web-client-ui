# IrisGrid agent quick-reference

Concise, high-signal notes for working in `@deephaven/iris-grid`. Skim before
editing; cross-link from feature plans rather than duplicating.

## What it is

`iris-grid` is the Deephaven-aware data grid. It wraps the framework-agnostic
`@deephaven/grid` (canvas renderer) with knowledge of the JS API: filters,
sorts, totals/aggregations, rollups, snapshots, formatters, links, etc.

```
@deephaven/grid           → generic canvas grid + GridMetricCalculator
@deephaven/iris-grid      → Deephaven model + metric calculator + UI controls
@deephaven/dashboard-core-plugins
                          → IrisGridPanel: golden-layout panel wrapper +
                            dehydrate/hydrate state for persistence
```

## Key files (all under `packages/iris-grid/src/`)

| File                              | Role                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `IrisGrid.tsx`                    | Top-level React component. Owns most state, event handlers, dispatch into the model & calculator. |
| `IrisGridProxyModel.ts`           | Mutable wrapper that swaps the underlying `IrisGridModel` (e.g. on rollup) and forwards events.   |
| `IrisGridTableModel*.ts`          | Concrete `IrisGridModel` impls backed by `dh.Table`/`TreeTable`/`PartitionedTable`.               |
| `IrisGridMetricCalculator.ts`     | Subclass of `GridMetricCalculator`. Owns user column widths (by **index** AND by **name**).       |
| `IrisGridUtils.ts`                | Stateless helpers + `dehydrateIrisGridState` / `hydrateIrisGridState` for persistence.            |
| `IrisGridCacheUtils.ts`           | Memoization helpers (input-stable maps/objects) used to avoid re-renders.                         |
| `sidebar/`                        | Sidebar panels: rollup rows, aggregations, custom columns, filters, search, etc.                  |
| `mousehandlers/` / `keyhandlers/` | Pluggable handlers extending `@deephaven/grid` handler interfaces.                                |

Outside `iris-grid` but tightly coupled:

- `packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx` — panel
  shell, owns the persisted state shape used by golden-layout.
- `packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx` — alt entry.
- `packages/jsapi-types`, `packages/jsapi-shim`, `packages/jsapi-bootstrap` —
  the JS API typings, runtime shim, and React context.

## State ownership (cheat sheet)

- **`IrisGrid` component state** — UI-level: filters, sorts, search, rollup
  config, frozen columns, column header groups, pending edits, selection,
  active overlays. Most public handlers (`handleRollupChange`,
  `handleFilterChange`, …) are `setState` orchestrators.
- **`IrisGridModel` (proxy)** — wraps the dh.Table/TreeTable. Subscriptions,
  snapshots, totals, formatters. Swapped by `IrisGridProxyModel` on rollup.
- **`IrisGridMetricCalculator`** — column widths and row heights:
  - `userColumnWidths: Map<ModelIndex, number>` — derived projection used by
    rendering. Rebuilt every `getMetrics()` via
    `updateColumnWidthsIfNecessary` from the by-name map.
  - `userColumnWidthsByName: Map<ColumnName, number>` — **source of truth**
    (post PR #2670). Survives model swaps because names are stable.
  - Width `0` means hidden (see `IrisGridUtils.getHiddenColumns`).
  - Public mutators: `setColumnWidth(modelIndex, width, name?)`,
    `resetColumnWidth(modelIndex)`, `resetColumnWidthByName(name)`,
    `getUserColumnWidthsByName()` (read-only view).
- **Redux** — only cross-panel things (workspace settings, plugins,
  layout). Per-grid state is component-local + dehydrated to layout config.

## Persistence (dehydrate/hydrate)

`IrisGridPanel` calls `IrisGridUtils.dehydrateIrisGridState(model, state)` →
plain serializable object → stored in golden-layout config →
`hydrateIrisGridState` on restore.

- Column widths are dehydrated **by name**: `[ [columnName, width], … ]`.
  This avoids index drift across schema changes and across rollup model
  swaps.
- Hydrate emits `userColumnWidthsByName` and a derived `userColumnWidths`
  scoped to the **current** model's columns. Names absent from the current
  model stay in the by-name map only and re-project when the model swaps.
- When constructing `IrisGridMetricCalculator`, pass
  `{ userColumnWidthsByName }` so the source-of-truth map seeds correctly.

## Rollup flow (the recurring hazard)

1. User edits rollup → `IrisGrid.handleRollupChange(rollupConfig)`.
2. Handler may need to un-hide group-by columns (a hidden group-by is
   meaningless). Filter `rollupConfig.columns` to those whose by-name width
   is `0` and call `metricCalculator.resetColumnWidthByName(name)`. Do
   **not** call `showAllColumns()` — that wipes unrelated hidden columns.
   Do **not** look up indices on `this.props.model`: when editing an existing
   rollup the model is the rolled-up one and may not contain newly-added
   group-by columns.
3. `setState({ rollupConfig })` → `IrisGridModelUpdater` propagates →
   `IrisGridProxyModel.set rollupConfig` calls `originalModel.table.rollup()`
   and swaps the inner model.
4. `COLUMNS_CHANGED` fires → next `getMetrics()` runs
   `updateColumnWidthsIfNecessary`, re-projecting by-name widths onto the new
   index space. Previously-hidden non-group-by columns re-hide automatically.

`showAllColumns()` is still used by other call sites
(`handleClearAllFilters`, the context menu). Don't change it.

## Components / UI primitives rule

- Use `@deephaven/components` (which curates Adobe React Spectrum). **Never
  import `@adobe/react-spectrum` directly**; ESLint blocks it.
- A package may not import its own `@deephaven/<self>` alias — use relative
  paths.

## Testing

- Jest config: `jest.config.cjs` (extends root `jest.config.base.cjs`).
  `moduleNameMapper` resolves workspace packages from source, so no rebuild
  step between edits to other packages.
- Mocks: global `__mocks__/dh-core` plus `@deephaven/test-utils`
  (`TestUtils.createMockProxy<T>()`).
- `irisGridTestUtils` (`src/IrisGridTestUtils.ts`) builds fake `Column`s,
  `Table`s, and `IrisGridModel`s. Use it; don't hand-roll.
- Component tests use `makeComponent(model)` then `act(() =>
  irisGrid.handleX(...))`. Spy on calculator methods with `jest.spyOn`.
- Run a focused test:
  ```
  npx --no-install jest --config=jest.config.unit.cjs \
    packages/iris-grid/src/<File>.test.ts[x] -t '<name pattern>'
  ```
- Before pushing: `npx tsc -b packages/iris-grid packages/dashboard-core-plugins`
  then ESLint on touched files.

## Conventions / gotchas

- Conventional Commit PR titles required. Breaking changes use a
  `BREAKING CHANGE:` footer, **not** the `!` shorthand.
- Width `0` is the hidden sentinel everywhere — search for it before
  introducing a new "hidden" flag.
- `cachedModelColumnNames` inside the calculator can be stale relative to
  the *next* model during a swap. Prefer by-name operations during transitions
  and let `updateColumnWidthsIfNecessary` reconcile by-index on the next
  metrics pass.
- `IrisGridModelUpdater` is the funnel between `IrisGrid` state and the
  proxy model. New rollup-like features should flow through it rather than
  poking the model directly.
- For long-lived JS-only edits while iterating, the lerna watcher rebuilds
  on save; just refresh the browser. Reinstall plugins only on Python or
  version changes.

## Where to put new docs

- Feature plans: `web-client-ui/plans/<TICKET>-<slug>.md` (template in
  `iris/plans/README.md`).
- Architectural notes that future agents need: extend this file rather than
  creating siblings.
