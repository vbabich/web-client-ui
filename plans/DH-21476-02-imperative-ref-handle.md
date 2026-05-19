# Plan: Controllable IrisGrid — Imperative Ref Handle

> **Status**: ready to start once [Phase 0](./DH-21476-01-phase-0-foundation.md) is on `main`.
> **Owner**: TBD.
> **Working branch**: `feat/iris-grid-handle` off `main`.
> **Depends on**: [Phase 0](./DH-21476-01-phase-0-foundation.md#phase-0--shared-foundation) — registry, `applyState`, `onStateDidChange`, `IrisGridControlContext`, sidebar-nav fields. Phase 0.1 (handler migration) is not a hard prereq but the handle gets more useful as more fields migrate.
> **Unblocks**: [Create Pivot plugin](./DH-21476-03-create-pivot-plugin.md), [Table Options sidebar plugin](./DH-21476-04-post-decision-table-options-plugin.md).
> **Quick commands**:
>
> ```bash
> npm run types
> npm run test:unit -- --testPathPattern="packages/iris-grid/src/controllable"
> npm run e2e:headed -- tests/iris-grid-controllable-handle.spec.ts
> ```
>
> Filename uses a descriptive slug; rename to
> `DH-XXXXX-iris-grid-handle.md` once a ticket is opened.

## Summary

Expose a stable, typed imperative API on `IrisGrid` via `forwardRef` +
`useImperativeHandle`. Plugins hold a ref of type `IrisGridHandle` and call
methods to drive the grid (filters, sorts, rollup, visibility, formatting,
sidebar/search/goto state). State observation uses the granular
`onStateDidChange` event introduced in Phase 0.

`IrisGrid` keeps owning its state — there is no controlled/uncontrolled
duality. The handle is a **write channel**, the granular event is the
**read channel**, and a thin `useIrisGridState(handle, selector)` hook
bridges them for React consumers.

## Design properties

- Smallest behavioral change to `IrisGrid` internals — no inversion of
  state ownership.
- Backward compatible: existing imperative methods keep working and are
  re-exported through the handle as canonical entry points.
- RPC-friendly: every handle method takes serializable args (typings only;
  no runtime serializer in this plan).
- **Out of scope here**: controlled-component semantics; full Python RPC
  layer; full sidebar host extraction (see [Table Options sidebar plugin](./DH-21476-04-post-decision-table-options-plugin.md)).

## Prerequisites

All items of [Phase 0](./DH-21476-01-phase-0-foundation.md#phase-0--shared-foundation).
This plan will not start until Phase 0 lands and is green in CI. The
sidebar host extraction is **not** a prerequisite — it is a consumer
(see the [Table Options sidebar plugin plan](./DH-21476-04-post-decision-table-options-plugin.md))
and `openSidebar(option)` / `closeSidebar()` / `setOpenOptions(stack)`
on the handle are derived automatically from the registered fields.

---

## Phase 1 — `forwardRef` boundary on `IrisGrid`

`IrisGrid` is a class component today. We don't rewrite it. Instead:

1. Rename the class export from `IrisGrid` to `IrisGridInner` (internal).
2. Add a thin `forwardRef` functional wrapper, **also called `IrisGrid`**,
   in [IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx). The wrapper:
   - Holds a `useRef<IrisGridInner>(null)`.
   - Renders `<IrisGridInner ref={innerRef} {...props} />`.
   - Calls `useImperativeHandle(forwardedRef, () => buildHandle(innerRef), [])`.
3. `buildHandle(innerRef)` lives in
   `packages/iris-grid/src/controllable/IrisGridHandle.ts` and constructs
   the typed handle object. Each method delegates to the corresponding
   `applyState(field, value, 'external')` on the inner instance.

Existing direct ref consumers (e.g.
[IrisGridPanel.irisGrid](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx))
keep working **only** if they continue to access the few public class
methods they already use. Audit and migrate those callers in Phase 4 so
they go through the handle instead — but keep both available during the
deprecation window.

Risk: TS reflection on `React.ElementRef<typeof IrisGrid>` flips from
`IrisGridInner` to `IrisGridHandle`. This is a typing breakage for
external consumers. Mitigate by exporting both types from
`@deephaven/iris-grid`:

- `IrisGridHandle` — the new public surface.
- `IrisGridInternalRef` — alias for the class instance, marked
  `@deprecated`.

---

## Phase 2 — Define `IrisGridHandle`

New file: `packages/iris-grid/src/controllable/IrisGridHandle.ts`.

Shape (categories mirror the registry from Phase 0):

```ts
export interface IrisGridHandle {
  // --- filter ---
  setQuickFilters(filters: ReadonlyQuickFilterMap): void;
  setAdvancedFilters(filters: ReadonlyAdvancedFilterMap): void;
  clearAllFilters(): void;
  setSearchValue(value: string): void;
  setSelectedSearchColumns(cols: readonly ColumnName[]): void;
  setInvertSearchColumns(invert: boolean): void;

  // --- sort ---
  setSorts(sorts: readonly SortDescriptor[]): void;
  setReverse(reverse: boolean): void;

  // --- structure ---
  setMovedColumns(moves: readonly MoveOperation[]): void;
  setUserColumnWidths(widths: ReadonlyMap<ColumnName, number>): void;
  setFrozenColumns(cols: readonly ColumnName[]): void;
  setColumnHeaderGroups(groups: readonly ColumnHeaderGroup[]): void;

  // --- rollup / aggregation / model-driving config ---
  setRollupConfig(config: UIRollupConfig | undefined): void;
  setAggregationSettings(settings: AggregationSettings): void;
  setSelectDistinctColumns(cols: readonly ColumnName[]): void;
  setCustomColumns(cols: readonly string[]): void;

  // --- format ---
  setConditionalFormats(formats: readonly SidebarFormattingRule[]): void;
  setFormatter(formatter: Formatter): void;

  // --- view (sidebar / transient) ---
  openSidebar(option: OptionType): void;
  closeSidebar(): void;
  setShowSearchBar(show: boolean): void;
  setIsFilterBarShown(show: boolean): void;
  setIsGotoShown(show: boolean): void;
  setGotoRow(row: number | null): void;

  // --- batch + observation ---
  /** Apply many fields atomically; emits one change event per field with `source: 'external'`. */
  apply(patch: Partial<ControllableIrisGridState>): void;

  /** Read the current value of a field (snapshot, no subscription). */
  get<K extends ControllableField>(field: K): ControllableIrisGridState[K];

  /** Subscribe to granular change events. Returns unsubscribe fn. */
  subscribe(listener: (change: IrisGridStateChange) => void): () => void;
}
```

Implementation rules:

- Every setter delegates to `inner.applyState(field, value, 'external')`.
  No setter reaches into `setState` directly.
- `apply(patch)` iterates the patch in a deterministic order (registry
  order) so model-swap-triggering fields land before view fields.
- `get` reads from a small snapshot view exposed by the inner class
  (`getControllableSnapshot()`), not from React state directly.
- `subscribe` is sugar over the Phase 0 `onStateDidChange` event bus; the
  handle owns the listener list so the consumer doesn't need to know about
  the prop.

---

## Phase 3 — Plumb the handle through panels

### `IrisGridPanel`

[packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
already keeps `this.irisGrid: IrisGrid` from a class ref. Changes:

1. Switch the ref type to
   `React.RefObject<IrisGridHandle>` and update internal callers
   (`getDehydratedIrisGridPanelState`, `setFilters`, `setStateOverrides`)
   to use handle methods.
2. Add a new prop `irisGridRef?: React.Ref<IrisGridHandle>` and forward it
   to the inner `<IrisGrid ref={mergeRefs(this.irisGrid, irisGridRef)}>`
   (use `@deephaven/react-hooks` `mergeRefs` helper if present, otherwise
   inline).
3. Expose `getIrisGridHandle(): IrisGridHandle | null` for callers that
   construct the panel imperatively (Goldenlayout component config, dashboard
   plugins).
4. Mark the existing `setStateOverrides` shim `@deprecated`; reroute its
   internals through `handle.apply(...)` after hydrating the dehydrated
   state via `IrisGridUtils`.

### `GridWidgetPlugin`

[packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx)
mounts `IrisGrid` outside the panel framework. Same treatment: accept
`irisGridRef` prop and forward it.

### `TablePluginProps`

[packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts)
gains an additive field:

```ts
export interface TablePluginProps<S = unknown> {
  // ...existing fields...
  /** Imperative handle for driving IrisGrid state. */
  irisGrid: IrisGridHandle;
}
```

`IrisGridPanel` populates this when it instantiates the table plugin
(currently around the `pluginRef` block; locate via a targeted search).
Existing `filter` and `fetchColumns` props remain — they become thin
wrappers over `irisGrid.setQuickFilters` / `setCustomColumns` internally,
documented as legacy-ergonomic.

---

## Phase 4 — Migrate in-tree consumers

Two callers exercise the legacy ref API today:

1. [IrisGridPanel](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
   itself — the largest consumer. Migrate every `this.irisGrid.handleX` /
   `this.irisGrid.setX` call to the corresponding handle method. Where a
   class method has no handle equivalent (e.g. `focus()`, `blur()`,
   imperative scroll), add it to `IrisGridHandle` as a passthrough.
2. [FilterSetManagerPanel](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx#L354)
   — calls `IrisGridPanel.setStateOverrides`. Keep this working through the
   shim; no direct handle adoption needed.

External (out-of-tree) consumers we know about:

- `deephaven-plugins/plugins/ui` — consult before changing prop names.
- `deephaven-plugins/plugins/grid-toolbar` — already a child of
  `<IrisGrid>` so reads via `IrisGridControlContext` once we wire it.

Audit step: `grep -r "irisGrid\.\(handle\|set\)" --include='*.tsx'` in
`web-client-ui` and `deephaven-plugins` before declaring migration done.

---

## Phase 5 — Read-side helper: `useIrisGridState`

New file:
`packages/iris-grid/src/controllable/useIrisGridState.ts`.

```ts
export function useIrisGridState<K extends ControllableField>(
  handle: IrisGridHandle | null,
  field: K
): ControllableIrisGridState[K] | undefined;

export function useIrisGridState<T>(
  handle: IrisGridHandle | null,
  selector: (snap: Readonly<ControllableIrisGridState>) => T,
  isEqual?: (a: T, b: T) => boolean
): T | undefined;
```

Implementation: `useSyncExternalStore` over `handle.subscribe`, snapshot
from `handle.get`. Required for plugins that *display* current grid state
(e.g. a sort indicator panel). Without this hook the handle is write-only
and consumers would re-implement the subscribe loop.

Pair with a non-hook `getIrisGridStateSnapshot(handle): ControllableIrisGridState`
helper for non-React consumers.

---

## Phase 6 — RPC seam (typings only, no runtime)

Add a generic RPC envelope type so a future Python bridge can serialize
handle calls without redesigning the surface:

```ts
export type IrisGridHandleCall = {
  [M in keyof IrisGridHandle]: {
    method: M;
    args: Parameters<IrisGridHandle[M]>;
  };
}[keyof IrisGridHandle];
```

This is purely a type export. No runtime serializer ships in this plan.
Document in the file header that any handle method added later **must**
take JSON-serializable arguments, and lint via a custom test that
JSON-stringifies a sample call for every method (covered in the
conformance suite below).

---

## Phase 7 — Deprecation & docs

- Mark direct `IrisGrid` class ref usage `@deprecated` in JSDoc on
  `IrisGridInternalRef` alias.
- Mark `IrisGridPanel.setStateOverrides` `@deprecated`. Migration path:
  `panel.getIrisGridHandle()?.apply(hydrate(overrides))`.
- Update [packages/iris-grid/README.md](../packages/iris-grid/README.md)
  with a "Driving IrisGrid from a plugin" section showing the handle +
  `useIrisGridState` pattern.
- Add a CHANGELOG entry under `feat:` once the handle lands.

Removal of deprecated APIs is deferred to a future major release per the
framework plan's compat policy.

---

## Test plan

### Unit / integration

- `packages/iris-grid/src/controllable/IrisGridHandle.test.tsx`:
  - Build the handle from a mounted `<IrisGrid>` and exercise every method.
  - Assert each method emits exactly one `onStateDidChange` event with
    `source: 'external'`.
  - Assert `apply(patch)` emits events in registry order and never emits
    duplicates for the same field.
  - Assert `get` reflects the new value synchronously after `setX`.
- Loop-protection test: handler subscribes, on every event re-applies the
  same value via the handle. Must terminate within one tick (the inner
  `applyState` should short-circuit when value is structurally equal).
- Snapshot round-trip test: dehydrate via `IrisGridUtils`, reapply via
  `handle.apply(rehydrate(...))`, compare snapshots.

### Conformance suite

`packages/iris-grid/src/controllable/Controllable.test.tsx` (the
parametric suite seeded in Phase 0) gains handle-side assertions: for
each registered field, the handle exposes the documented setter,
observation works, and dehydrate/hydrate round-trips.

### E2E

One Playwright spec under `tests/` that mounts a stub plugin which uses
the handle to drive sort + rollup + filter, and asserts the rendered grid
matches a baseline snapshot.

### Plugin compatibility

Build `deephaven-plugins/plugins/ui` and
`deephaven-plugins/plugins/simple-pivot` against the new
`@deephaven/iris-grid` and `@deephaven/plugin` packages and run
`npm run test:unit -- --testPathPattern="plugins/(ui|simple-pivot)"`.

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| `forwardRef` change breaks consumers reading `React.ElementRef<typeof IrisGrid>` | Export `IrisGridInternalRef` alias and document migration in the same release. |
| Handle drifts out of sync with new internal `applyState` mutators | Conformance test iterates the registry and asserts every field has a corresponding handle method. CI fails on missing entries. |
| Plugins call handle methods before mount | Handle is `null` until the inner ref attaches; document and gate all examples on `if (handle)` / `useIrisGridState` returning `undefined`. |
| RPC serializability silently broken by a non-JSON arg | Conformance test JSON-stringifies a representative call for every method. |
| Class-component churn during the rename to `IrisGridInner` | Rename in a single commit, no behavior changes; rely on TypeScript + existing test suite for safety. |

---

## Relevant files

- New: `packages/iris-grid/src/controllable/IrisGridHandle.ts`
- New: `packages/iris-grid/src/controllable/useIrisGridState.ts`
- New: `packages/iris-grid/src/controllable/IrisGridHandle.test.tsx`
- Modified: [packages/iris-grid/src/IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx)
  — `forwardRef` wrapper, `getControllableSnapshot()`.
- Modified: [packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
  — `irisGridRef` prop, `getIrisGridHandle()`, `setStateOverrides`
  reroute.
- Modified: [packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx)
  — `irisGridRef` prop forwarding.
- Modified: [packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts)
  — `irisGrid: IrisGridHandle` on `TablePluginProps`.
- Touched (Phase 4 migration): every in-tree caller of `this.irisGrid.set*`
  / `this.irisGrid.handle*`.

---

## Open questions

1. Do we want batched event emission for `apply(patch)` (one event with
   multiple field deltas) instead of per-field? Per-field is simpler and
   matches Phase 0; revisit if perf testing shows it matters.
2. Should `IrisGridControlContext` (Phase 0) supply the handle to children
   automatically? Recommendation: yes, the inner class publishes itself
   into the context and the context value's API is exactly
   `IrisGridHandle`. That way `<IrisGrid>{children}</IrisGrid>` plugins
   don't need an explicit ref.
3. Naming: `apply` vs `setState` for the batch method. Picked `apply` to
   avoid React confusion. Confirm before merge.
