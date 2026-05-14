# Plan: Make IrisGrid State Externally Controllable

> **Note**: filename uses a descriptive slug; rename to `DH-XXXXX-controllable-iris-grid-state.md` once a ticket is opened (see [iris/plans/README.md](../../iris/plans/README.md) for the convention).

Establish an architectural framework that lets plugins (both in-tree and external `@deephaven/plugin` consumers) drive every meaningful piece of `IrisGrid` state — filters, sorts, column structure, widths, rollup/aggregation/partition, formatting, and UI-transient state. Goal of this plan is the **framework**, not field-by-field migration; that comes later.

## User decisions captured

- **Use case**: a family of plugins that drive sorts, filters, and the underlying model from the outside.
- **Controllability model**: explore two approaches in parallel branches — (A) Imperative ref API and (B) Expanded override mechanism. This plan covers both.
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

---

## Phase A — Branch "imperative-ref" (controllability model #3)

Detailed implementation plan: [controllable-iris-grid-state-branch-a-imperative-ref.md](./controllable-iris-grid-state-branch-a-imperative-ref.md).

**Summary.** Expose a stable imperative API via `forwardRef` +
`useImperativeHandle`. Plugins hold an `IrisGridHandle` ref and call
methods to drive the grid; `onStateDidChange` is the read channel; a
`useIrisGridState(handle, …)` hook bridges to React.

- **Pros**: smallest behavioral change; `IrisGrid` keeps owning its state;
  backward-compatible; easy to RPC-serialize.
- **Cons**: not idiomatic React (no `<IrisGrid sorts={...}>`); requires a
  separate read-side hook; two channels (write / observe) to test.

---

## Phase B — Branch "expanded-override" (controllability model #4)

Detailed implementation plan: [controllable-iris-grid-state-branch-b-expanded-override.md](./controllable-iris-grid-state-branch-b-expanded-override.md).

**Summary.** Generalize the existing `IrisGridStateOverride` mechanism to
cover every field in the registry. Plugins pass `stateOverrides` +
`onStateOverrideChange` (controlled-component pattern, same contract as
`<input value onChange>`, lifted to ~30 fields).

- **Pros**: idiomatic React; plugin state naturally serializable; subsumes
  existing override infrastructure (`IrisGridStateOverride`,
  `IrisGridPanel.setStateOverrides`, `FilterSetManagerPanel`).
- **Cons**: larger refactor (controlled/uncontrolled branching across many
  fields); render-cost requires careful memoization; derived fields
  (`searchFilter`) need to be excluded.

---

## Phase C — Verification framework (applies to both branches)

Before declaring either branch done:

1. **Conformance test suite** — for every field in the controllable registry, a single parametric Jest test that (a) drives the field via the new API, (b) asserts the change event reports it with `source: 'external'`, (c) asserts the rendered grid reflects the new value, (d) asserts dehydrate-then-hydrate round-trips. Lives in `packages/iris-grid/src/controllable/Controllable.test.tsx`.
2. **Loop / oscillation tests** — drive a field externally, let the change event fire, and assert no infinite update or duplicate model fetch. Required for both branches.
3. **Persistence round-trip** — feed dehydrated state from the registry into `IrisGridPanel`, mount, restore overrides, verify visual match against existing snapshots.
4. **E2E smoke** — one Playwright test that drives filters + sort + rollup from a stub external panel, exercising the full plugin → IrisGrid → model → render path. Reuse `tests/docker-scripts/data/app.d` setup.
5. **Plugin compatibility check** — build `deephaven-plugins/plugins/ui` and `simple-pivot` against the new package. Run their unit tests via `npm run test:unit -- --testPathPattern="plugins/(ui|simple-pivot)"`.

---

## Phase D — Decision & merge

Run both branches through Phase C. Compare on:

- Code delta size (lines, files touched).
- Bug count surfaced in dogfood (plug a UI plugin into each branch, drive 4–5 fields, log issues).
- DX feedback from the deephaven-plugins team (one short doc per branch, sample plugin in each).
- Performance: render counts for typical sessions.

Pick one, archive the other. Write up the migration plan for the per-field rollout (separate planning doc).

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

- Branch A: [controllable-iris-grid-state-branch-a-imperative-ref.md](./controllable-iris-grid-state-branch-a-imperative-ref.md)
- Branch B: [controllable-iris-grid-state-branch-b-expanded-override.md](./controllable-iris-grid-state-branch-b-expanded-override.md)

---

## Decisions

- **Scope**: filters, sorts, column structure, widths/heights/visibility, rollup/aggregation/partition, formatting, UI-transient. Selection and pending edits are excluded — they're inherently user-driven and round-tripping them externally is more risk than value.
- **Compat**: soft. New API is additive in Phase 0. Existing imperative methods (`setFilters`, `handleRollupChange`, etc.), `IrisGridPanel.setStateOverrides`, and the current `IrisGridStateOverride` shape stay functional through the next minor releases. Mark `IrisGridStateOverride` deprecated when Branch B's `ControllableIrisGridState` lands; mark direct ref usage deprecated when Branch A's `IrisGridHandle` lands. Removal happens in a future major.
- **Model swaps**: not directly plugin-controllable. Plugins drive state (`rollupConfig`, `selectDistinctColumns`, etc.) and `IrisGridProxyModel` reacts. Custom model classes (à la `simple-pivot`) plug in via a `modelFactory` prop on `IrisGridPanel`/`GridWidgetPlugin`, not via live swap.
- **Persistence**: lean on existing `dehydrate/hydrate` codecs in `IrisGridUtils`. The registry references them; we don't reinvent serialization.
- **Loop protection**: every `apply` carries a `source: 'user' | 'external'` tag. The change event echoes it. Branch B uses it to suppress redundant override → setState pings.

---

## Further considerations

1. **External (Python-side) plugin reach.** Branch A's imperative handle requires JSON-RPC-style serialization to be usable from Python plugins. Branch B's value-based overrides serialize naturally. If Python plugins are a near-term target, Branch B has a structural advantage. Recommendation: confirm with deephaven-plugins/UI team whether driving the grid from Python is a v1 requirement before picking. Option A: defer Python reach to follow-up. Option B: bake it into Branch B from the start. Option C: design a thin RPC layer for Branch A.
2. **Children prop ergonomics.** Today `<IrisGrid>{children}</IrisGrid>` renders a toolbar. With either branch, children automatically get access to the new `IrisGridControlContext`. Should we deprecate the `children` slot in favor of an explicit `toolbar` prop or keep it? Recommendation: keep `children` for back-compat, document the new context as the canonical way for child plugins to read/write state.
3. **Granular `onStateChange` migration risk.** Replacing the monolithic `onStateChange(state, gridState)` with a granular event is a behavior change for any consumer that diffs the snapshot. Recommendation: ship granular as `onStateDidChange` (new name), keep the old callback for one major. Don't combine them — the diff semantics differ.
