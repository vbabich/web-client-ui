# Plan: Controllable IrisGrid — Branch B (Expanded Override / Controlled Component)

> **Status**: spike-ready (waiting on Phase 0 to land on `main`).
> **Owner**: TBD.
> **Working branch**: `spike/controllable-iris-grid-branch-b` off `main`.
> **Depends on**: [Phase 0](./DH-21476-controllable-iris-grid-state.md#phase-0--shared-foundation-both-branches-build-on-this) all 7 items, green in CI.
> **Spike scope**: see [process plan, Step 2](./DH-21476-controllable-iris-grid-state-process.md#step-2--spike-branches-for-a-and-b-parallel-time-boxed) —
> 3-4 representative fields + the [Create Pivot plugin](./DH-21476-controllable-iris-grid-create-pivot-plugin.md) as consumer; **don't migrate every field**, **don't migrate `FilterSetManagerPanel`**, **don't ship `IrisGridControllerPanel`** beyond what the spike consumer needs.
> **Definition of Done (spike)**: 4 fields wired through `stateOverrides` / `onStateOverrideChange`; loop-protection + memoization passing the dedicated tests in this plan; Create Pivot plugin builds against the spike; one-page evaluation memo committed (LOC, render counts, plugin DX, snapshot churn).
> **Companion branches**: [Branch A](./DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md), [Branch C](./DH-21476-controllable-iris-grid-state-branch-c-idiomatic-react-rewrite.md).
> **Quick commands**:
>
> ```bash
> npm run types
> npm run test:unit -- --testPathPattern="packages/iris-grid/src/controllable"
> npm run e2e:headed -- tests/iris-grid-controllable-overrides.spec.ts
> ```
>
> Filename uses a descriptive slug; rename to
> `DH-XXXXX-controllable-iris-grid-branch-b.md` once a ticket is opened.

## Summary

Generalize the existing
[IrisGridStateOverride](../packages/iris-grid/src/CommonTypes.tsx#L93)
mechanism to cover every field in the Phase 0 controllable registry.
Plugins pass a `stateOverrides` prop (a `Partial` of the registry shape)
and an `onStateOverrideChange` callback. Presence of a key means that
field is **controlled** (parent owns the value); absence means
**uncontrolled** (current behavior — `IrisGrid` owns it). Same contract as
`<input value onChange>`, lifted to ~30 fields.

## Branch-specific deltas (vs parent plan)

- Idiomatic React. Plugin state binds declaratively; naturally
  serializable (no RPC layer needed for Python-side plugins).
- Subsumes the current ad-hoc override surfaces (`IrisGridStateOverride`,
  `IrisGridPanel.setStateOverrides`, `FilterSetManagerPanel`).
- Per-field opt-in: plugins control only what they care about.
- **Out of scope here**: removing imperative class methods (kept for
  intra-component use during deprecation); a new dehydrate format (reuse
  [IrisGridUtils](../packages/iris-grid/src/IrisGridUtils.ts) codecs);
  forcing `IrisGridPanel` to lift state (default mode stays uncontrolled).

## Prerequisites

All seven items of [Phase 0 in the framework plan](./DH-21476-controllable-iris-grid-state.md#phase-0--shared-foundation-both-branches-build-on-this).
This branch will not start until Phase 0 lands and is green in CI. The
full sidebar host extraction (Phase 0 #7) is **not** a prerequisite — it
is a consumer of this branch (see the [Table Options sidebar plugin plan](./DH-21476-controllable-iris-grid-table-options-plugin.md)).
With the registry's `isMenuShown` / `openOptions` entries, sidebar
navigation lifts into `stateOverrides` like any other field.

---

## Phase B.1 — Define `ControllableIrisGridState`

New file:
`packages/iris-grid/src/controllable/ControllableIrisGridState.ts`.

```ts
/** Full shape of every externally-controllable IrisGrid field. */
export interface ControllableIrisGridState {
  // filter
  quickFilters: ReadonlyQuickFilterMap;
  advancedFilters: ReadonlyAdvancedFilterMap;
  searchValue: string;
  selectedSearchColumns: readonly ColumnName[];
  invertSearchColumns: boolean;

  // sort
  sorts: readonly SortDescriptor[];
  reverse: boolean;

  // structure
  movedColumns: readonly MoveOperation[];
  userColumnWidths: ReadonlyMap<ColumnName, number>;
  frozenColumns: readonly ColumnName[];
  columnHeaderGroups: readonly ColumnHeaderGroup[];

  // rollup / aggregation / model-driving
  rollupConfig: UIRollupConfig | undefined;
  aggregationSettings: AggregationSettings;
  selectDistinctColumns: readonly ColumnName[];
  customColumns: readonly string[];

  // format
  conditionalFormats: readonly SidebarFormattingRule[];
  formatter: Formatter; // by-reference codec; see Phase 0 #4

  // view (sidebar / transient)
  openedSidebar: OptionType | null;
  showSearchBar: boolean;
  isFilterBarShown: boolean;
  isGotoShown: boolean;
  gotoRow: number | null;
}

export type ControllableField = keyof ControllableIrisGridState;
export type IrisGridStateOverrides = Partial<ControllableIrisGridState>;
```

The legacy
[IrisGridStateOverride](../packages/iris-grid/src/CommonTypes.tsx#L93)
shape (model + theme + a handful of ad-hoc fields) is **not** removed.
It's marked `@deprecated` and re-typed as
`IrisGridStateOverrides & LegacyOverrideExtras`, where the extras are the
two members (`model`, `theme`) that aren't user-controllable state and
shouldn't migrate. `IrisGridMetricCalculator` and `IrisGridRenderer` keep
consuming the legacy shape; the widening to the new fields is purely
additive.

Some fields are **derived** (e.g. `searchFilter` from `searchValue +
selectedSearchColumns + invertSearchColumns`). These are marked read-only
in the registry and **excluded** from `ControllableIrisGridState` —
controlling derived fields would create contradictions. Document this
explicitly in the registry.

---

## Phase B.2 — `IrisGrid` props and the `useControllable` helper

Two new props on
[IrisGrid](../packages/iris-grid/src/IrisGrid.tsx):

```ts
stateOverrides?: IrisGridStateOverrides;
onStateOverrideChange?: <K extends ControllableField>(
  field: K,
  value: ControllableIrisGridState[K],
  source: 'user' | 'external'
) => void;
```

Both are additive and default to `undefined`, preserving 100% of current
uncontrolled behavior.

Inside the class, every Phase 0 `applyX(value, source)` becomes a thin
adapter over a single helper:

```ts
private applyControllable<K extends ControllableField>(
  field: K,
  value: ControllableIrisGridState[K],
  source: 'user' | 'external'
): void {
  const { stateOverrides, onStateOverrideChange } = this.props;
  const isControlled = stateOverrides != null && field in stateOverrides;

  // Always notify (controlled or not). Parent uses this to decide whether
  // to echo the value back via stateOverrides.
  onStateOverrideChange?.(field, value, source);

  if (isControlled) {
    // Controlled: parent owns the value. Do NOT setState locally.
    // The next render will pick up stateOverrides[field] in getEffectiveState().
    return;
  }

  // Uncontrolled: own the value locally.
  this.setState({ [field]: value } as Pick<IrisGridState, K>);
  this.emitStateDidChange({ field, value, prev: this.state[field], source });
}
```

A new `getEffectiveState()` helper merges
`{ ...this.state, ...this.props.stateOverrides }` and is the single source
all renderers / sub-components read from. Audit
[IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx) for direct
`this.state.X` reads of any controllable field; replace with
`this.getEffectiveState().X`.

The `source` flag from Phase 0 is critical here: when the parent echoes a
value back (controlled mode), the next user action that emits `'user'`
must not infinite-loop with the parent's echo. The helper short-circuits
when the value is structurally equal to the current effective value.

---

## Phase B.3 — Memoization story

Passing 30+ override fields each render is the primary perf risk. Today
[IrisGridCacheUtils.ts](../packages/iris-grid/src/IrisGridCacheUtils.ts)
already memoizes derived shapes; we extend it.

Plan:

1. Add `memoizeStateOverrides(overrides)` in `IrisGridCacheUtils` that
   returns a stable reference when individual field references are equal.
   Plugins are encouraged but not required to memoize their own
   `stateOverrides` object.
2. `getEffectiveState()` is itself memoized over
   `(this.state, this.props.stateOverrides)`. Use
   `memoize-one` (already a workspace dep per
   [@types/memoize-one](../@types/memoize-one)).
3. Sub-component props derived from controllable fields (e.g.
   `IrisGridModelUpdater` props) read through the memoized effective
   state, so a parent re-render that doesn't actually change override
   references doesn't trigger model rebuilds.
4. Add a render-count regression test: mount, drive 5 unrelated parent
   re-renders with referentially-stable overrides, assert
   `IrisGridModelUpdater`'s effect runs zero times.

---

## Phase B.4 — Plumb overrides through panels

### `IrisGridPanel`

[packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
already keeps `irisGridStateOverrides` in its own `state` and feeds it to
`<IrisGrid>` (today via the legacy override shape). Changes:

1. Widen `irisGridStateOverrides` to `IrisGridStateOverrides`.
2. Add new props for plugin-driven mode:
   - `controlledStateOverrides?: IrisGridStateOverrides`
   - `onControlledStateOverrideChange?: typeof onStateOverrideChange`
   When set, the panel acts as a thin pass-through (the parent — usually a
   plugin's `IrisGridControllerPanel`, see below — owns the state).
3. `setStateOverrides({ irisGridState, gridState })` (the current
   imperative API used by
   [FilterSetManagerPanel](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx#L354))
   becomes a thin shim: hydrate the dehydrated payload via
   `IrisGridUtils`, then `setState({ irisGridStateOverrides: hydrated })`.
   Mark `@deprecated`; migration path is to use the controlled props
   directly.
4. Persistence flow (`getDehydratedIrisGridPanelState`,
   `loadPanelState`) keeps writing the panel's own `state.irisGridStateOverrides`
   to the workspace blob — independent of whether the panel is
   externally controlled. When controlled, the parent is responsible for
   any persistence beyond what the panel saves.

### New: `IrisGridControllerPanel`

A higher-order panel for plugins that want full external control without
re-implementing the panel shell. It owns
`stateOverrides` in a `useReducer` and renders `<IrisGridPanel
controlledStateOverrides={...} onControlledStateOverrideChange={...}>`.
Exported from `@deephaven/dashboard-core-plugins`.

This is preferred over the alternative of adding a `controller` prop on
`IrisGridPanel` because the controller's state machine (and any plugin
middleware around it) is naturally a separate component concern.

### `GridWidgetPlugin`

[packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx)
gains the same `stateOverrides` / `onStateOverrideChange` passthrough
props.

### `TablePluginProps`

[packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts)
gains additive fields:

```ts
export interface TablePluginProps<S = unknown> {
  // ...existing fields...
  /** Current effective controllable state (read). */
  irisGridState: Readonly<ControllableIrisGridState>;
  /** Apply an override (write). Same semantics as `onStateOverrideChange`. */
  applyOverride: <K extends ControllableField>(
    field: K,
    value: ControllableIrisGridState[K]
  ) => void;
}
```

`IrisGridPanel` populates these by reading from `getEffectiveState()` (via
the `IrisGridControlContext` from Phase 0) and dispatching through its
own controlled-overrides reducer.

---

## Phase B.5 — Migrate existing override consumers

1. **`IrisGridStateOverride` →
   `IrisGridStateOverrides & LegacyOverrideExtras`.** Add the deprecation
   JSDoc, ensure every existing reader keeps compiling. Specifically:
   - [IrisGridMetricCalculator.ts](../packages/iris-grid/src/IrisGridMetricCalculator.ts)
   - [IrisGridRenderer.ts](../packages/iris-grid/src/IrisGridRenderer.ts)
2. **`IrisGridPanel.setStateOverrides`** — keep the entrypoint, reroute
   internals, mark deprecated.
3. **`FilterSetManagerPanel`** — no immediate change; it keeps calling the
   shim. Long-term: migrate to dispatch through `applyOverride` once
   filter sets become a first-class plugin.

---

## Phase B.6 — Loop-protection contract

The controlled pattern's biggest hazard is parent ↔ child override
oscillation. Contract:

1. `applyControllable` early-returns when the new value is structurally
   equal to the current effective value (same reference *or*
   `Object.is` equal for primitives, deep equal for collections via
   `IrisGridUtils.isEqualX` helpers).
2. The parent's `onStateOverrideChange` may echo synchronously or
   asynchronously; either way the child's next call short-circuits if the
   echo matches.
3. The `source` flag is included in every event so the parent can ignore
   its own echoes when wiring to redux/zustand.
4. Conformance test: drive a field with a controlled parent that always
   echoes; assert the system stabilizes within one tick and emits no
   duplicate model fetches.

---

## Phase B.7 — Deprecation & docs

- `IrisGridStateOverride` (the type) and
  `IrisGridPanel.setStateOverrides` (the method) gain `@deprecated`
  JSDoc with migration snippets.
- Update [packages/iris-grid/README.md](../packages/iris-grid/README.md)
  with a "Driving IrisGrid as a controlled component" section.
- CHANGELOG entry under `feat:` once Phase 0 + B land together.

Removal of deprecated APIs is deferred to a future major release per the
framework plan's compat policy.

---

## Test plan

### Unit / integration

- `packages/iris-grid/src/controllable/ControllableIrisGridState.test.tsx`:
  - For each registry field, mount `<IrisGrid stateOverrides={...}
    onStateOverrideChange={cb}>` and assert effective state matches the
    override.
  - Drive an internal user action (e.g. click a column header to sort);
    assert `onStateOverrideChange` fires with `source: 'user'` and the
    override value (i.e. the proposed new value), and that the grid does
    NOT update locally until the parent echoes.
  - Loop test: parent always echoes; user action stabilizes in ≤1 tick.
  - Memoization test: 5 parent re-renders with stable overrides → 0
    extra `IrisGridModelUpdater` effects.
- Migration test: legacy `IrisGridStateOverride` consumers
  (`IrisGridMetricCalculator`, `IrisGridRenderer`) keep working with the
  widened shape.
- Persistence test: override → dehydrate via existing
  `IrisGridUtils.dehydrate*` → rehydrate → reapply → snapshot match.

### Conformance suite (shared with Branch A)

`packages/iris-grid/src/controllable/Controllable.test.tsx` —
parametrically iterate the registry; for each field assert (a)
`stateOverrides` accepts the type, (b) `onStateOverrideChange` fires with
the documented signature, (c) `getEffectiveState()` reflects the value,
(d) round-trip dehydrate/hydrate.

### E2E

One Playwright spec under `tests/` that mounts a stub plugin which lifts
sort + rollup + filter into its own state via `IrisGridControllerPanel`,
drives them, and asserts the rendered grid matches a baseline snapshot.

### Plugin compatibility

Build `deephaven-plugins/plugins/ui` and
`deephaven-plugins/plugins/simple-pivot` against the new
`@deephaven/iris-grid` and `@deephaven/plugin` packages. Run
`npm run test:unit -- --testPathPattern="plugins/(ui|simple-pivot)"`.

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| 30+ controllable fields × controlled/uncontrolled paths balloons branching | Single `applyControllable` helper centralizes the logic; per-field `applyX` is a one-liner delegating to it. |
| Parent ↔ child oscillation | Structural-equality short-circuit + `source` flag (Phase B.6). Conformance test drives the worst case. |
| Re-render cost from passing many overrides | `memoizeStateOverrides` + memoized `getEffectiveState()` + render-count regression test (Phase B.3). |
| Derived fields (e.g. `searchFilter`) make controlled semantics ambiguous | Excluded from `ControllableIrisGridState`; documented read-only in the registry. |
| Plugins forget to echo and writes appear to silently disappear | `onStateOverrideChange` JSDoc + a dev-mode warning when the same field receives 5+ `'user'` events without the override changing. |
| Legacy `IrisGridStateOverride` consumers regress when the type widens | Type widens with `&` (additive); existing consumers ignore unknown keys. Tests pin both. |
| Persistence collision when a panel is both internally and externally controlled | Document precedence: `controlledStateOverrides` (parent) wins over `state.irisGridStateOverrides` (panel-local). Test explicitly. |

---

## Relevant files

- New: `packages/iris-grid/src/controllable/ControllableIrisGridState.ts`
- New: `packages/iris-grid/src/controllable/ControllableIrisGridState.test.tsx`
- New: `packages/dashboard-core-plugins/src/panels/IrisGridControllerPanel.tsx`
- Modified: [packages/iris-grid/src/IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx)
  — `stateOverrides` / `onStateOverrideChange` props,
  `applyControllable`, `getEffectiveState`, audit of direct
  `this.state.X` reads.
- Modified: [packages/iris-grid/src/CommonTypes.tsx](../packages/iris-grid/src/CommonTypes.tsx)
  — re-type `IrisGridStateOverride` as
  `IrisGridStateOverrides & LegacyOverrideExtras`, mark `@deprecated`.
- Modified: [packages/iris-grid/src/IrisGridCacheUtils.ts](../packages/iris-grid/src/IrisGridCacheUtils.ts)
  — `memoizeStateOverrides` helper.
- Modified: [packages/iris-grid/src/IrisGridMetricCalculator.ts](../packages/iris-grid/src/IrisGridMetricCalculator.ts)
  — verify-only; widened type stays compatible.
- Modified: [packages/iris-grid/src/IrisGridRenderer.ts](../packages/iris-grid/src/IrisGridRenderer.ts)
  — verify-only.
- Modified: [packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
  — `controlledStateOverrides` props,
  `setStateOverrides` reroute + deprecation.
- Modified: [packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx)
  — passthrough props.
- Modified: [packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts)
  — `irisGridState` + `applyOverride` on `TablePluginProps`.

---

## Open questions

1. Should `controlledStateOverrides` (parent-driven) and
   `state.irisGridStateOverrides` (panel-internal) be allowed
   simultaneously? Recommendation: yes, with parent winning. Document and
   test.
2. Field-level vs object-level controlled semantics: today the proposal
   is field-level (`field in stateOverrides`). Alternative: parent passes
   a `controlledFields: ReadonlyArray<ControllableField>` allow-list. The
   field-level pattern matches `<input value>` more closely and is what
   most state libraries expect; sticking with it unless a use case
   demands otherwise.
3. Should `applyOverride` in `TablePluginProps` be batched (accept a
   `Partial<ControllableIrisGridState>`)? Probably yes for ergonomics.
   Add as a second overload before merge.
