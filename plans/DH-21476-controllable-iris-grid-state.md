# Plan: Make IrisGrid State Externally Controllable

> **Status**: design — awaiting Phase 0 ticket.
> **Owner**: TBD.
> **Working branch**: ship Phase 0 directly to `main` as a series of
> non-breaking PRs.
> **Blocks**: [Branch A](./DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md),
> [Branch B](./DH-21476-controllable-iris-grid-state-branch-b-expanded-override.md),
> [Branch C](./DH-21476-controllable-iris-grid-state-branch-c-idiomatic-react-rewrite.md),
> [Table Options sidebar plugin](./DH-21476-controllable-iris-grid-table-options-plugin.md).
> **How to execute**: see [process & sequencing plan](./DH-21476-controllable-iris-grid-state-process.md).
> **Filename**: descriptive slug; rename to `DH-XXXXX-DH-21476-controllable-iris-grid-state.md`
> when a ticket is opened (see [iris/plans/README.md](../../iris/plans/README.md)).

Establish an architectural framework that lets plugins (both in-tree and external `@deephaven/plugin` consumers) drive every meaningful piece of `IrisGrid` state — filters, sorts, column structure, widths, rollup/aggregation/partition, formatting, and UI-transient state. Goal of this plan is the **framework**, not field-by-field migration; that comes later.

## User decisions captured

- **Use case**: a family of plugins that drive sorts, filters, the underlying model, and the Table Options sidebar contents from the outside — including adding and removing individual sidebar options.
- **Controllability model**: explore three approaches as time-boxed evaluation spikes — (A) imperative ref API, (B) expanded override mechanism, (C) idiomatic React rewrite. Each lives in its own implementation plan; sequencing is in the [process plan](./DH-21476-controllable-iris-grid-state-process.md).
- **Scope**: filters, sorts, column structure, widths/heights/visibility, rollup/aggregation/partition, formatting, UI-transient (sidebar, search bar, gotoRow, filter bar, menus). Out of scope: selection ranges, pending edits.
- **Compatibility**: soft — deprecate existing API, plan a follow-up major-version cleanup.
- **Plugin surface**: both in-tree (`dashboard-core-plugins`) and external (`deephaven-plugins/plugins/ui`, grid-toolbar, etc.).
- **Model handling**: implicit via state, with an explicit hook for swaps (see Phase 0 #5).
- **Migration**: framework first, per-field migration in later plans.

---

## Phase 0 — Shared foundation (both branches build on this)

These changes are prerequisites whichever controllability model wins. Phase 0 is **non-breaking** and lands first regardless of which branch wins.

1. **Inventory the controllable surface.** Produce a typed registry (`packages/iris-grid/src/controllable/ControllableFields.ts`) enumerating every state field with metadata: name, current `IrisGridState` field, current `IrisGridProps` initializer (if any), category (`filter | sort | structure | rollup | format | view`), whether it triggers a model swap, dehydrate codec reference. Use the union of `IrisGridState` ([IrisGrid.tsx#L397](../packages/iris-grid/src/IrisGrid.tsx#L397)) and `IrisGridStateOverride` ([CommonTypes.tsx#L93](../packages/iris-grid/src/CommonTypes.tsx#L93)). This becomes the spec doc both branches must satisfy.
2. **Normalize "set-X" handlers** on `IrisGrid`. Today there is a mix of `handleXChange`, `setX`, and direct `setState` orchestrators. Audit `IrisGrid.tsx` and pick one canonical mutator per field, named `applyX(value, source)` where `source ∈ 'user' | 'external'`. Internal handlers call `applyX(..., 'user')`; external API (ref or override) calls `applyX(..., 'external')`. This avoids the recursion hazards both branches will hit (override → setState → onStateChange → override loop).
3. **Make `onStateChange` granular and structured.** Currently emits the full `IrisGridState` after any change. Add (additively, keep old callback) `onStateDidChange(change: IrisGridStateChange)` where `change` is `{ field, value, prev, source }` plus a `snapshot` getter. Critical so external code can distinguish its own writes from internal user changes without diffing 80 fields.
4. **Stable serializable representations.** For every controllable field, define a serializable shape suitable for crossing the plugin boundary (Python/JS bridge). Lean on existing `dehydrate*` helpers in [IrisGridUtils.ts](../packages/iris-grid/src/IrisGridUtils.ts). Some fields (`formatter`, `model`) are not serializable as-is — they need either a "by-reference" handle or a dedicated codec. Document each in the registry.
5. **Decide: where does the model live?** Recommendation: keep [IrisGridProxyModel.ts](../packages/iris-grid/src/IrisGridProxyModel.ts) and [IrisGridModelUpdater.tsx](../packages/iris-grid/src/IrisGridModelUpdater.tsx) unchanged. Plugins do **not** swap the model directly; they drive `rollupConfig` / `selectDistinctColumns` / `customColumns` etc. and the proxy reacts. For the rare case a plugin needs a custom model (e.g. `simple-pivot`'s `IrisGridSimplePivotModel`), expose a `modelFactory?: (baseModel) => IrisGridModel` prop on `IrisGridPanel` rather than letting plugins live-swap. Document this boundary explicitly.
6. **Plugin-facing context.** Introduce `IrisGridControlContext` (React context) inside `iris-grid` exposing `{ state, apply, subscribe }`. Both branches expose their public API through this context so consumers (children rendered via the existing `children` prop, plus `TablePluginProps`) get the same shape.
7. **Make sidebar navigation controllable (no extraction yet).** The full extraction of the Table Options sidebar host into a parent-supplied component **cannot happen in Phase 0** — the built-in pages ([RollupRows](../packages/iris-grid/src/sidebar/RollupRows.tsx), [AggregationsBuilder](../packages/iris-grid/src/sidebar/aggregations), etc.) call `this.handleX` / `this.setState` directly on the `IrisGrid` class today. Until Branch A or B ships a public write surface for those pages to bind to, ripping them out of `IrisGrid` would just trade class-internal coupling for a sprawl of callback props piped across the new boundary — reinventing the very API the framework is supposed to define.

   What Phase 0 **can** do safely:
   - Funnel sidebar-driven mutations through the normalized `applyX(value, source)` mutators from Phase 0 #2. Built-in pages stay inline; they just stop calling private setters.
   - Add `isMenuShown` and `openOptions` (the page stack — [IrisGrid.tsx#L466](../packages/iris-grid/src/IrisGrid.tsx#L466)) to the controllable-fields registry, so the chosen branch automatically exposes sidebar navigation.
   - Document the sidebar-only scratch state that is **excluded** from the registry: `conditionalFormatEditIndex`, `conditionalFormatPreview`, `selectedAggregation`, gotoRow draft fields (`gotoRow`, `gotoValue`, `gotoValueSelectedColumnName`, `gotoValueSelectedFilter`, `gotoValueManuallyChanged`), download progress fields. These belong to specific built-in page components; a replacement plugin owns its own scratch state. Built-in pages must not leak them through `onStateDidChange`.

   The full extraction (parent-owned `IrisGridSidebar` host + `sidebarPages` slot for plugin replacement) is deferred to the [Table Options sidebar plugin plan](./DH-21476-controllable-iris-grid-table-options-plugin.md), where it's the natural first phase on top of the chosen controllability branch.

---

## Phase 0 — Definition of Done

Phase 0 is complete when:

- The registry exists at `packages/iris-grid/src/controllable/ControllableFields.ts`
  and every `IrisGridState` field that is not on the documented exclusion
  list (selection ranges, pending edits, sidebar-only scratch state) is
  in it.
- Every `handleX` / `setX` / direct `setState` for a registered field
  routes through `applyX(value, 'user')`.
- `onStateDidChange` fires for every registered field with the documented
  shape; covered by the parametric conformance test at
  `packages/iris-grid/src/controllable/Controllable.test.tsx`.
- `IrisGridControlContext` is exported and consumed by `<IrisGrid>`'s
  child render slot.
- `modelFactory?: (baseModel) => IrisGridModel` accepted on
  `IrisGridPanel` and `GridWidgetPlugin`.
- Sidebar mutations route through `applyX`; `isMenuShown` and
  `openOptions` registered. Built-in pages still inline; no extraction.
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
```

---

## Branch summary

Three controllability models are explored as time-boxed evaluation
spikes (see [process plan](./DH-21476-controllable-iris-grid-state-process.md)).
Detailed implementation plans live in their own files:

- [Branch A — imperative ref](./DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md):
  `forwardRef` + `IrisGridHandle`. Smallest change; backward-compatible;
  not idiomatic React.
- [Branch B — expanded override](./DH-21476-controllable-iris-grid-state-branch-b-expanded-override.md):
  controlled-component pattern with `stateOverrides` /
  `onStateOverrideChange`. Idiomatic; medium refactor; perf risk.
- [Branch C — idiomatic React rewrite](./DH-21476-controllable-iris-grid-state-branch-c-idiomatic-react-rewrite.md):
  function-component rewrite over a typed store. Largest scope; breaks
  direct ref consumers; highest ceiling.

Decision flow, evaluation criteria, and convergence are owned by the
[process plan](./DH-21476-controllable-iris-grid-state-process.md).

---

## Relevant files

- [packages/iris-grid/src/IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx) — main component; props (`#L291`), state (`#L397`), `onStateChange` emit (`#L4178`), all `handleX` mutators.
- [packages/iris-grid/src/CommonTypes.tsx](../packages/iris-grid/src/CommonTypes.tsx) — `IrisGridStateOverride` (`#L93`) to be generalized.
- [packages/iris-grid/src/IrisGridModelUpdater.tsx](../packages/iris-grid/src/IrisGridModelUpdater.tsx) — funnel from props to model; should remain the single sync layer for both branches.
- [packages/iris-grid/src/IrisGridProxyModel.ts](../packages/iris-grid/src/IrisGridProxyModel.ts) — model swap logic; treated as black box, driven by config props.
- [packages/iris-grid/src/IrisGridUtils.ts](../packages/iris-grid/src/IrisGridUtils.ts) — dehydrate/hydrate codecs to reuse in the registry.
- [packages/iris-grid/src/IrisGridMetricCalculator.ts](../packages/iris-grid/src/IrisGridMetricCalculator.ts) — consumes `IrisGridStateOverride`; must keep working when type widens.
- [packages/iris-grid/src/IrisGridRenderer.ts](../packages/iris-grid/src/IrisGridRenderer.ts) — same.
- [packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx) — `setStateOverrides` (`#L964`), ref usage, panel-state persistence.
- [packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx) — current external caller of `setStateOverrides` (`#L354`); must keep working.
- [packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx) — non-panel entry; needs the same control surface.
- [packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts) — `TablePluginProps`; gains either `irisGrid: IrisGridHandle` (Branch A) or `(state, applyOverride)` (Branch B).
- `deephaven-plugins/plugins/ui/` and `deephaven-plugins/plugins/simple-pivot/` — external consumers; build & test against new API in Phase C.

New files (Phase 0):

- `packages/iris-grid/src/controllable/ControllableFields.ts` — registry.
- `packages/iris-grid/src/controllable/IrisGridControlContext.tsx` — context.
- `packages/iris-grid/src/controllable/Controllable.test.tsx` — conformance suite.

Branch-specific files are listed in the per-branch plans:

- Branch A: [DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md](./DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md)
- Branch B: [DH-21476-controllable-iris-grid-state-branch-b-expanded-override.md](./DH-21476-controllable-iris-grid-state-branch-b-expanded-override.md)

---

## Decisions

- **Compat**: soft. New API in Phase 0 is additive. Existing imperative methods (`setFilters`, `handleRollupChange`, etc.), `IrisGridPanel.setStateOverrides`, and the current `IrisGridStateOverride` shape stay functional through the next minor releases. Per-branch deprecation policy lives in each branch plan.
- **Model swaps**: not directly plugin-controllable. Plugins drive state (`rollupConfig`, `selectDistinctColumns`, etc.) and `IrisGridProxyModel` reacts. Custom model classes (à la `simple-pivot`) plug in via the `modelFactory` prop on `IrisGridPanel`/`GridWidgetPlugin`, not via live swap.
- **Persistence**: lean on existing `dehydrate/hydrate` codecs in `IrisGridUtils`. The registry references them; we don't reinvent serialization.
- **Loop protection**: every `apply` carries a `source: 'user' | 'external'` tag. The change event echoes it. Branches B and C use it to suppress redundant override / dispatch loops.

## Open framework questions

1. **Python-side reach.** Branch A needs a JSON-RPC layer to drive the grid from Python; Branches B and C serialize naturally. Confirm with the deephaven-plugins team whether driving the grid from Python is a v1 requirement *before* the spike decision in the [process plan](./DH-21476-controllable-iris-grid-state-process.md).
2. **`children` slot.** Today `<IrisGrid>{children}</IrisGrid>` renders a toolbar. Either keep `children` and document `IrisGridControlContext` as the canonical state-access path for child plugins, or deprecate in favor of an explicit `toolbar` prop. Recommendation: keep `children`, document the context.
3. **Granular `onStateChange` migration risk.** Replacing the monolithic `onStateChange(state, gridState)` with a granular event is a behavior change for any consumer that diffs the snapshot. Recommendation: ship granular as `onStateDidChange` (new name), keep the old callback for one major. Don't combine them.
