# Plan: Make IrisGrid State Externally Controllable

> **Status**: Phase 0 plumbing **and** Phase 0.1 handler migration both
> implemented on the integration branch `vlad-DH-21476-o4.7`; not yet on
> `main`. Every registered field now writes through `applyState` /
> `applyStateMany`; conformance suite is 54 tests, full iris-grid suite
> is 424/424, full app suite is 3440/3440.
> **Owner**: TBD.
> **Working branch**: ship Phase 0 + 0.1 to `main` as a series of
> non-breaking PRs.
> **Unblocks**: [Imperative ref handle](./DH-21476-02-imperative-ref-handle.md),
> [Create Pivot plugin](./DH-21476-03-create-pivot-plugin.md),
> [Sidebar plugin extensibility](./DH-21476-05-sidebar-plugin-extensibility.md),
> [Table Options sidebar plugin](./DH-21476-04-post-decision-table-options-plugin.md).

Establish an architectural framework that lets plugins (both in-tree and external `@deephaven/plugin` consumers) drive every meaningful piece of `IrisGrid` state — filters, sorts, column structure, widths, rollup/aggregation/partition, formatting, and UI-transient state. Goal of this plan is the **framework**, not field-by-field migration; that comes later.

## User decisions captured

- **Use case**: a family of plugins that drive sorts, filters, the underlying model, and the Table Options sidebar contents from the outside — including adding and removing individual sidebar options.
- **Controllability model**: imperative ref handle (`forwardRef` + `useImperativeHandle`). Detailed in [DH-21476-02-imperative-ref-handle.md](./DH-21476-02-imperative-ref-handle.md).
- **Scope**: filters, sorts, column structure, widths/heights/visibility, rollup/aggregation/partition, formatting, UI-transient (sidebar, search bar, gotoRow, filter bar, menus). Out of scope: selection ranges, pending edits.
- **Compatibility**: soft — deprecate existing API, plan a follow-up major-version cleanup.
- **Plugin surface**: both in-tree (`dashboard-core-plugins`) and external (`deephaven-plugins/plugins/ui`, grid-toolbar, etc.).
- **Model handling**: implicit via state, with an explicit hook for swaps (see Phase 0 #5).
- **Migration**: framework first, per-field migration in later plans.

---

## Phase 0 — Shared foundation

These changes are prerequisites for the imperative-ref handle and for every sidebar/plugin plan that follows. Phase 0 is **non-breaking** and lands first.

Phase 0 is intentionally **plumbing only**: registry + canonical mutator + granular event + context + sidebar nav + `modelFactory`. The mechanical migration of every existing `handleX` / `setX` / direct `setState` call site to the new pipe is deferred to **Phase 0.1** so Phase 0 stays a small, reviewable PR.

1. **Inventory the controllable surface.** Produce a typed registry (`packages/iris-grid/src/controllable/ControllableFields.ts`) enumerating every state field with metadata: name, current `IrisGridState` field, current `IrisGridProps` initializer (if any), category (`filter | sort | structure | rollup | format | view`), whether it triggers a model swap, dehydrate codec reference. Use the union of `IrisGridState` ([IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx)) and `IrisGridStateOverride` ([CommonTypes.tsx#L93](../packages/iris-grid/src/CommonTypes.tsx#L93)). This becomes the spec doc the [imperative ref handle](./DH-21476-02-imperative-ref-handle.md) must satisfy.
2. **Introduce a canonical mutator.** Today there is a mix of `handleXChange`, `setX`, and direct `setState` orchestrators. Add a single generic `applyState<K extends ControllableFieldName>(field, value, source)` method on `IrisGrid` where `source ∈ 'internal' | 'external'`. Internal handlers will call `applyState(field, value, 'internal')`; the external `IrisGridControlHandle.apply` calls `applyState(field, value, 'external')`. This avoids recursion hazards (override → setState → onStateChange → override loop). Phase 0 only **adds** `applyState` and routes the sidebar-nav fields through it; the full migration of existing handlers is Phase 0.1.
3. **Make `onStateChange` granular and structured.** Currently emits the full `IrisGridState` after any change. Add (additively, keep old callback) `onStateDidChange(change: IrisGridStateChange)` where `change` is `{ field, value, prev, source }` plus a `snapshot` getter. Critical so external code can distinguish its own writes from internal user changes without diffing the entire `IrisGridState`.
4. **Stable serializable representations.** For every controllable field, define a serializable shape suitable for crossing the plugin boundary (Python/JS bridge). Lean on existing `dehydrate*` helpers in [IrisGridUtils.ts](../packages/iris-grid/src/IrisGridUtils.ts). Some fields (`formatter`, `model`) are not serializable as-is — they need either a "by-reference" handle or a dedicated codec. Document each in the registry.
5. **Decide: where does the model live?** Recommendation: keep [IrisGridProxyModel.ts](../packages/iris-grid/src/IrisGridProxyModel.ts) and [IrisGridModelUpdater.tsx](../packages/iris-grid/src/IrisGridModelUpdater.tsx) unchanged. Plugins do **not** swap the model directly; they drive `rollupConfig` / `selectDistinctColumns` / `customColumns` etc. and the proxy reacts.
6. **Plugin-facing context.** Introduce `IrisGridControlContext` (React context) inside `iris-grid` exposing an `IrisGridControlHandle` with `{ getState, get, apply, subscribe, subscribeField }`. The [imperative ref handle plan](./DH-21476-02-imperative-ref-handle.md) exposes its public API through this context so consumers (children rendered via the existing `children` prop, plus `TablePluginProps`) get the same shape. The context value is `null` outside an `IrisGrid` subtree.
7. **Make sidebar navigation controllable (no extraction yet).** The full extraction of the Table Options sidebar host into a parent-supplied component **cannot happen in Phase 0** — the built-in pages ([RollupRows](../packages/iris-grid/src/sidebar/RollupRows.tsx), [AggregationsBuilder](../packages/iris-grid/src/sidebar/aggregations), etc.) call `this.handleX` / `this.setState` directly on the `IrisGrid` class today. Until the imperative ref handle ships a public write surface for those pages to bind to, ripping them out of `IrisGrid` would just trade class-internal coupling for a sprawl of callback props piped across the new boundary — reinventing the very API the framework is supposed to define.

   What Phase 0 **can** do safely:
   - Route the sidebar-nav fields (`isMenuShown`, `openOptions`) through `applyState(field, value, 'internal')` as the first real callers of the new pipe. Built-in pages stay inline; they just stop calling private setters for those fields.
   - Add `isMenuShown` and `openOptions` (the page stack) to the controllable-fields registry, so the [imperative ref handle](./DH-21476-02-imperative-ref-handle.md) automatically exposes sidebar navigation.
   - Document the sidebar-only scratch state that is **excluded** from the registry: `conditionalFormatEditIndex`, `conditionalFormatPreview`, `selectedAggregation`, gotoRow draft fields (`gotoRow`, `gotoValue`, `gotoValueSelectedColumnName`, `gotoValueSelectedFilter`, `gotoValueManuallyChanged`), download progress fields. Also exclude **derived fields** (e.g. `searchFilter`, which is composed from `searchValue` + `selectedSearchColumns` + `invertSearchColumns`) — these are recomputed from registered sources and have no independent identity. Built-in pages must not leak any of these through `onStateDidChange`.

   The full extraction (parent-owned `IrisGridSidebar` host + `sidebarPages` slot for plugin replacement) is deferred to the [Table Options sidebar plugin plan](./DH-21476-04-post-decision-table-options-plugin.md), where it's the natural first phase on top of the imperative ref handle. A smaller subset — transform-and-add via middleware — ships sooner via the [sidebar plugin extensibility plan](./DH-21476-05-sidebar-plugin-extensibility.md).

---

## Phase 0 — Definition of Done

Phase 0 (plumbing) is complete when:

- The registry exists at `packages/iris-grid/src/controllable/ControllableFields.ts`
  and every `IrisGridState` field that is not on the documented exclusion
  list (selection ranges, pending edits, sidebar-only scratch state,
  derived fields) is in it.
- `applyState<K>(field, value, source)` exists on `IrisGrid` and is the
  canonical entry point for both internal and external writes. (Existing
  handlers continue to call `setState` directly; their migration is
  Phase 0.1.)
- `onStateDidChange(change)` is wired and fires whenever `applyState`
  runs, with the documented `{ field, value, prev, source }` shape
  plus `snapshot` getter; covered by a parametric conformance test at
  `packages/iris-grid/src/controllable/Controllable.test.tsx` that
  iterates the registry rather than enumerating fields by hand.
- `IrisGridControlContext` is exported and a Provider wraps `<IrisGrid>`'s
  entire render subtree (built-in descendants and the `children` slot
  both see the same handle).
- Sidebar-nav mutations (`isMenuShown`, `openOptions`) route through
  `applyState`; both fields are in the registry. Built-in sidebar pages
  still inline; no extraction.
- Existing snapshot and unit tests still pass; no behavior changes
  intended.

## Phase 0 — Verification commands

```bash
# Type-check the new registry + tests
npm run types
# Conformance suite for the registry
npm run test:unit -- --testPathPattern="packages/iris-grid/src/controllable"
# Full iris-grid unit suite (regression guard)
npm run test:unit -- --testPathPattern="packages/iris-grid"
# Full app tests
npm run test
```

---

## Phase 0.1 — Handler migration

Mechanically migrate every existing call site that mutates a registered
field to flow through `applyState(field, value, 'internal')` instead of
calling `this.setState({ field: value })` directly. This is the work
that actually delivers the `onStateDidChange` guarantee from Phase 0's
DoD for every field; until it lands, `onStateDidChange` only fires for
the sidebar-nav fields.

Done field-by-field rather than as one mega-PR. Each PR:

1. Picks one registered field (or a tightly coupled group, e.g.
   `quickFilters` + `advancedFilters`).
2. Replaces every `this.setState({ <field>: ... })` and `handle<Field>` /
   `set<Field>` internal call with `this.applyState('<field>', value, 'internal')`.
3. Adds a regression test that asserts the corresponding
   `onStateDidChange` event fires with the right `prev` / `value` /
   `source` on the user gesture that drives that field.
4. Leaves the public method (`handleX` / `setX`) in place as a thin
   wrapper for backwards compatibility.

### Phase 0.1 — Definition of Done

All three items satisfied on `vlad-DH-21476-o4.7`:

- Every registered field has zero direct `this.setState({ <field>: ... })`
  call sites in `IrisGrid.tsx`; all writes go through `applyState`
  (single-field) or `applyStateMany` (multi-field transactions).
- The parametric conformance test from Phase 0 is extended to drive
  each field via its primary user gesture (synthetic event or method
  call) and assert the event fires exactly once with `source: 'internal'`,
  plus a parametric `it.each` over `CONTROLLABLE_FIELD_LIST` that drives
  every registered field externally through `handle.apply(field, value)`
  and asserts one event tagged `source: 'external'`.
- No behavior changes intended; full unit + snapshot suites pass
  (iris-grid 424/424, full app 3440/3440).

### Phase 0.1 — Verification commands

```bash
# Conformance suite (now exercising user gestures, not just external apply)
npm run test:unit -- --testPathPattern="packages/iris-grid/src/controllable"
# Full iris-grid unit suite
npm run test:unit -- --testPathPattern="packages/iris-grid"
# Full app tests
npm run test
```

---

## Implementation notes (Phase 0 + 0.1, as shipped)

Patterns that emerged during the migration and are now part of the
contract for downstream phases:

- **`applyStateMany(partial, source, callback, skipEmit)`** is the
  multi-field counterpart to `applyState`. It performs a single
  `setState` transaction (one re-render) and emits one
  `onStateDidChange` event per registered field whose value changed.
  Use it for handlers that need to mutate several registered fields
  atomically (e.g. `handleRollupChange` clearing sorts/moves/etc.).
  Unregistered fields in `partial` pass through to `setState` verbatim
  with no event emission, which lets call sites mix registered fields
  with transient/scratch state without leaking events.
- **`skipEmit` parameter** (5th on `applyState`, 4th on
  `applyStateMany`) suppresses the per-field `onStateDidChange` fan-out
  for a single write. Passed `true` by initial-snapshot paths driven
  by props/model (currently only `initFormatter` →
  `updateFormatterSettings` → `updateFormatter`) so consumers don't
  receive synthetic events for state they never explicitly drove.
  `componentDidUpdate`'s legitimate settings-prop emit path keeps the
  default `false`.
- **Mount-time `loadTableState`** intentionally bypasses the pipe with
  raw `setState` (commented inline). Same rationale as `skipEmit`:
  the model snapshot on mount is not a user write.
- **`notifyStateChange` is the escape hatch** for handlers that must
  drive a multi-field `setState` whose batching cannot be expressed
  through `applyStateMany` (e.g. `handleAggregationEdit` pairing
  registered `openOptions` with the unregistered scratch field
  `selectedAggregation`). Callers `setState` directly and then invoke
  `notifyStateChange(field, value, prev)` from the `setState`
  callback. Pre-check `value === prev` if you want noop suppression.
- **Sample-value table** in `Controllable.test.tsx`
  (`SAMPLE_VALUES`) is the canonical reference for what a non-default
  value looks like for each registered field. Update it when adding
  new fields to the registry. The parametric test skips `formatter`
  (opaque, plugins drive `customColumnFormatMap` /
  `columnAlignmentMap`), `reverse` (cascades to
  `model.dh.Table.reverse` not on the mock), `movedColumns`
  (re-emits via `componentDidUpdate`), and `openOptions` (renders
  the sidebar). Each is covered by a dedicated spy-based or
  side-effect test elsewhere in the suite.

---

## Next

Once Phase 0 is on `main`, the controllability model itself is built
out in [DH-21476-02 — Imperative Ref Handle](./DH-21476-02-imperative-ref-handle.md):
`forwardRef` + `IrisGridHandle`. Smallest change to the class component;
backward-compatible; not idiomatic React, but the explicit constraint
here is preserving the existing class component's render and lifecycle
behavior while making every controllable field externally drivable.

A narrower plugin surface — transform/add sidebar items via widget
middleware, without exposing the full handle — ships independently via
[DH-21476-05 — Sidebar plugin extensibility](./DH-21476-05-sidebar-plugin-extensibility.md)
and only depends on Phase 0.

---

## Relevant files

- [packages/iris-grid/src/IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx) — main component; props, state, `onStateChange` emit, all `handleX` mutators. (Line anchors omitted; this file moves a lot.)
- [packages/iris-grid/src/CommonTypes.tsx](../packages/iris-grid/src/CommonTypes.tsx#L93) — `IrisGridStateOverride` to be generalized.
- [packages/iris-grid/src/IrisGridModelUpdater.tsx](../packages/iris-grid/src/IrisGridModelUpdater.tsx) — funnel from props to model; should remain the single sync layer for all three branches.
- [packages/iris-grid/src/IrisGridProxyModel.ts](../packages/iris-grid/src/IrisGridProxyModel.ts) — model swap logic; treated as black box, driven by config props.
- [packages/iris-grid/src/IrisGridUtils.ts](../packages/iris-grid/src/IrisGridUtils.ts) — dehydrate/hydrate codecs to reuse in the registry.
- [packages/iris-grid/src/IrisGridMetricCalculator.ts](../packages/iris-grid/src/IrisGridMetricCalculator.ts) — consumes `IrisGridStateOverride`; must keep working when type widens.
- [packages/iris-grid/src/IrisGridRenderer.ts](../packages/iris-grid/src/IrisGridRenderer.ts) — same.
- [packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx) — `setStateOverrides`, ref usage, panel-state persistence.
- [packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx#L354) — current external caller of `setStateOverrides`; must keep working.
- [packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx) — non-panel entry; needs the same control surface.
- [packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts) — `TablePluginProps`; gains `irisGrid: IrisGridHandle` per the [imperative ref handle plan](./DH-21476-02-imperative-ref-handle.md).
- `deephaven-plugins/plugins/ui/` and `deephaven-plugins/plugins/simple-pivot/` — external consumers; build & test against the new API in the handle plan's plugin-validation phase.

New files (Phase 0):

- `packages/iris-grid/src/controllable/ControllableFields.ts` — registry.
- `packages/iris-grid/src/controllable/IrisGridControlContext.tsx` — context.
- `packages/iris-grid/src/controllable/Controllable.test.tsx` — conformance suite.

Handle-specific files are listed in [DH-21476-02-imperative-ref-handle.md](./DH-21476-02-imperative-ref-handle.md).

---

## Decisions

- **Compat**: soft. New API in Phase 0 is additive. Existing imperative methods (`setFilters`, `handleRollupChange`, etc.), `IrisGridPanel.setStateOverrides`, and the current `IrisGridStateOverride` shape stay functional through the next minor releases. Deprecation policy for the handle lives in [DH-21476-02-imperative-ref-handle.md](./DH-21476-02-imperative-ref-handle.md).
- **Model swaps**: not directly plugin-controllable. Plugins drive state (`rollupConfig`, `selectDistinctColumns`, etc.) and `IrisGridProxyModel` reacts. Custom model classes (à la `simple-pivot`) plug in via the `modelFactory` prop on `IrisGridPanel`/`GridWidgetPlugin`, not via live swap.
- **Persistence**: lean on existing `dehydrate/hydrate` codecs in `IrisGridUtils`. The registry references them; we don't reinvent serialization.
- **Loop protection**: every `apply` carries a `source: 'internal' | 'external'` tag. The change event echoes it. The handle uses it to suppress redundant apply loops.
- **`children` slot stays.** `<IrisGrid>{children}</IrisGrid>` continues to render a toolbar slot; we do **not** introduce a separate `toolbar` prop. `IrisGridControlContext` is the canonical state-access path for anything rendered into `children` (and for built-in descendants). Provider scope is the full `<IrisGrid>` render subtree.

## Open framework questions

1. **Python-side reach.** The handle needs a JSON-RPC layer to drive the grid from Python. Confirm with the deephaven-plugins team whether driving the grid from Python is a v1 requirement *before* the handle plan starts implementation (or treat the RPC seam as typings-only as currently scoped in [DH-21476-02](./DH-21476-02-imperative-ref-handle.md#phase-6--rpc-seam-typings-only-no-runtime)).
2. **Granular `onStateChange` migration risk.** Replacing the monolithic `onStateChange(state, gridState)` with a granular event is a behavior change for any consumer that diffs the snapshot. Recommendation: ship granular as `onStateDidChange` (new name), keep the old callback for one major. Don't combine them.
