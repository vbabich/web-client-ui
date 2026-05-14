# Plan: Controllable IrisGrid — Branch C (Idiomatic React Rewrite)

> **Status**: feasibility-spike-ready (waiting on Phase 0 to land on `main`).
> **Owner**: TBD.
> **Working branch**: `spike/controllable-iris-grid-branch-c` off `main`.
> **Depends on**: [Phase 0](./DH-21476-controllable-iris-grid-state.md#phase-0--shared-foundation-both-branches-build-on-this) (registry only — the rest is replaced by this branch's store).
> **Spike scope (per [process plan, Step 3](./DH-21476-controllable-iris-grid-state-process.md#step-3--branch-c-feasibility-spike-parallel-separate-shape))**:
> 2-3 day **architecture-only** spike. Stand up `createIrisGridStore` for
> the same 3-4 fields chosen by Branches A/B. Port **one slice** (sorts)
> behind `IRIS_GRID_V2`. **No plugin work, no migration, no compat shim.**
> The full plan below describes the production rewrite that runs only if
> Branch C is picked at the decision meeting.
> **Definition of Done (spike)**: `createIrisGridStore` + `IrisGridStoreProvider` + `useIrisGridSelector` exist; sorts slice renders behind `IRIS_GRID_V2`; one-page feasibility memo answers the four questions in the process plan's Step 3.
> **Definition of Done (production, post-decision)**: every `IrisGridState` field reachable through `selectors.ts`; `IrisGridLegacy` removed; conformance suite green; `deephaven-plugins/{ui,simple-pivot}` build green against the new package.
> **Companion branches**: [Branch A](./DH-21476-controllable-iris-grid-state-branch-a-imperative-ref.md), [Branch B](./DH-21476-controllable-iris-grid-state-branch-b-expanded-override.md).
> **Quick commands**:
>
> ```bash
> npm run types
> npm run test:unit -- --testPathPattern="packages/iris-grid/src/store"
> # Run with the new implementation enabled
> IRIS_GRID_V2=true npm start
> ```
>
> Filename uses a descriptive slug; rename to
> `DH-XXXXX-controllable-iris-grid-branch-c.md` once a ticket is opened.

## What makes this branch different

Branches A and B preserve `IrisGrid` as a 5500-line class component;
this branch replaces it with a function component backed by a typed
store. Compatibility is **preferred but not mandatory** — a thin compat
shim keeps [IrisGridPanel](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx),
[GridWidgetPlugin](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx),
and [FilterSetManagerPanel](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx)
working, but **direct ref consumers of the `IrisGrid` class instance
break** (e.g. `irisGrid.handleRollupChange(...)`). Sidebar replacement
falls out of the rewrite for free — pages use the same store hooks as
plugins, so the [sidebar plugin plan](./DH-21476-controllable-iris-grid-table-options-plugin.md)
collapses to "register your `SidebarPage` in the host app's `pages`
prop".

---

## High-level architecture

```
┌────────────────────────────────────────────────────────┐
│ Parent (IrisGridPanel, plugin, host app)               │
│   ─ owns IrisGridStore (or defers to defaults)         │
│   ─ subscribes to selectors                            │
│   ─ dispatches actions                                 │
└─────────────────────┬──────────────────────────────────┘
                      │ <IrisGridStoreProvider store={…}>
                      ▼
┌────────────────────────────────────────────────────────┐
│ <IrisGrid /> (function component)                      │
│   ─ reads via useIrisGridSelector                      │
│   ─ writes via useIrisGridDispatch                     │
│   ─ renders <IrisGridCanvas /> + <IrisGridSidebar />   │
│   ─ no internal state for any controllable field       │
└─────────────────────┬──────────────────────────────────┘
                      │ context: IrisGridStoreContext
                      ▼
┌────────────────────────────────────────────────────────┐
│ <IrisGridSidebar pages={builtInPages} />               │
│   ─ pages read/write via the same hooks                │
│   ─ scratch state (edit indices, drafts) lives in      │
│     each page's local useState                         │
└────────────────────────────────────────────────────────┘
```

Three exported building blocks:

1. **`IrisGridStore`** — a small, framework-agnostic, **typed**
   reducer-backed store. Source of truth for every controllable field.
   Implementation can be plain `useReducer` + a subscription manager
   (~150 LOC) or a thin wrapper over Zustand
   ([already evaluated by the team]; pick during Phase C.0). Public
   surface:
   ```ts
   interface IrisGridStore {
     getState(): Readonly<IrisGridState>;
     dispatch(action: IrisGridAction): void;
     subscribe(listener: (change: IrisGridStateChange) => void): () => void;
   }
   ```
   The store is **the** API. Branches A and B's "imperative handle" and
   "controlled props" both collapse into this single primitive.
2. **`<IrisGridStoreProvider store={…}>`** — React context provider.
   When omitted, `<IrisGrid>` creates an internal store via
   `useIrisGridStore()` and behaves as an uncontrolled component.
3. **`useIrisGridSelector(selector)` / `useIrisGridDispatch()`** — the
   only hooks plugins need. Read with selectors (memoized via
   `useSyncExternalStore` so re-renders are scoped to subscribed
   slices); write with typed actions.

This is the React-Redux pattern, scoped to a single component tree. We
chose this shape (over a `Context.Provider<value>` alone) because grid
state changes hundreds of times per second during scroll/typing and a
single context value would re-render every consumer.

---

## Phase C.0 — Decision: store implementation

Pick one before Phase C.1 starts. Options, in increasing scope:

| Option | LOC | Pros | Cons |
| --- | --- | --- | --- |
| Hand-rolled reducer + `useSyncExternalStore` | ~150 | Zero new deps; minimal API surface; full control over subscription granularity | Reinvents what redux/zustand already do; another in-house abstraction to maintain |
| Zustand | small wrapper | Stable API, batteries included (devtools, persistence middleware, `subscribeWithSelector`); already in the broader React ecosystem | New dep on every consumer that lifts state; another store in apps already using redux |
| Reuse `@deephaven/redux` slice | small | Consistent with existing reducer registry pattern | Forces redux on `iris-grid` (currently free of it); workspace-level redux store contention; high-frequency UI state in a global store has perf hazards |

**Recommendation**: Zustand. It's the smallest delta to an idiomatic
React mental model, the subscription primitives match what the grid
needs (selector-scoped re-renders), and it doesn't drag the workspace
redux store into per-grid UI churn. Confirm with the team before Phase
C.1.

---

## Phase C.1 — Define the store

New package directory: `packages/iris-grid/src/store/`.

Files:

- `IrisGridState.ts` — single typed shape covering every controllable
  field. Same registry as the parent plan's Phase 0 #1, but the registry
  is now also the `IrisGridState` type literally (not just a metadata
  table). Categories from the parent plan become discriminated unions
  on the actions, not on the state itself.
- `IrisGridActions.ts` — typed action union. One action per logical
  mutation (`setSorts`, `setQuickFilter`, `clearAllFilters`,
  `setRollupConfig`, `openSidebar`, `pushSidebarPage`,
  `popSidebarPage`, `setShowSearchBar`, …). Actions carry a
  `source: 'user' | 'external'` tag so subscribers can filter.
- `IrisGridReducer.ts` — pure reducer. Encodes all the
  side-effect-free transitions. No model fetches, no callbacks.
- `IrisGridStore.ts` — Zustand (or hand-rolled) store factory:
  ```ts
  export function createIrisGridStore(
    initial?: Partial<IrisGridState>
  ): IrisGridStore;
  ```
- `IrisGridStoreContext.tsx` — React context + provider + the two
  consumer hooks (`useIrisGridSelector`, `useIrisGridDispatch`).
- `selectors.ts` — common typed selectors (`selectSorts`,
  `selectQuickFilters`, `selectOpenSidebar`, …). Plugins can write
  their own; these are convenience.

What lives **outside** the store (intentionally):

- The `dh.Table` and the `IrisGridModel` proxy
  ([IrisGridProxyModel.ts](../packages/iris-grid/src/IrisGridProxyModel.ts))
  — these are imperative, async, and not serializable. They stay owned
  by `IrisGrid` and react to store changes via an effect.
- Sidebar-page scratch state (half-edited conditional formats,
  `gotoRow` drafts, `conditionalFormatEditIndex`, etc.) — these live in
  the individual page components' `useState`, not in the shared store.
- Selection ranges and pending edits — same exclusion as parent plan;
  inherently user-driven and not controllable.

---

## Phase C.2 — Rewrite `IrisGrid` as a function component

This is the big one. The current
[IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx) (~5500 LOC class
component) becomes a function component composed of focused subviews.
This is not a verbatim port — the goal is to delete state ownership from
this layer, not preserve internal structure.

Decomposition target:

- `IrisGrid` (top-level function component):
  - Reads `model: IrisGridModel` from props (or constructs it via
    `IrisGridModelUpdater` from store-driven config).
  - Mounts `IrisGridStoreProvider` if none is already present in
    context.
  - Renders the toolbar, the canvas, the floating UI (filter bar,
    search bar, gotoRow, menus), and the sidebar slot.
  - Wires DOM-level concerns (focus, keyboard shortcuts) via local
    refs.
- `IrisGridCanvas` (the existing canvas-grid integration):
  - Pulls visual state from selectors (`movedColumns`,
    `userColumnWidths`, `frozenColumns`, `columnHeaderGroups`, …).
  - Dispatches user gestures (sort header click → `setSorts`).
  - This is where most of the per-frame work happens; subscriptions
    must be selector-scoped to avoid global re-renders.
- `IrisGridToolbar`, `IrisGridFilterBar`, `IrisGridSearchBar`,
  `IrisGridGotoRow`, `IrisGridMenus` — extracted from the current
  inline JSX. Each is a thin wrapper around hooks + presentational
  components from `@deephaven/components`.
- `IrisGridModelEffects` — a hook (or "headless" component) that
  watches the rollup/aggregation/customColumns/selectDistinct slice and
  drives `IrisGridProxyModel` accordingly. Replaces the imperative
  `handleRollupChange` → `IrisGridModelUpdater` chain. The proxy itself
  is unchanged.

Practical sequencing inside Phase C.2:

1. Stand up the new `IrisGrid` function component behind a feature flag
   (`process.env.IRIS_GRID_V2 === 'true'`). The legacy class stays in
   the same file under the export name `IrisGridLegacy`.
2. Migrate one slice at a time (sorts → filters → structure →
   rollup/aggregation → format → sidebar/view). For each slice, port
   the rendering + dispatch wiring, run the conformance test (Phase
   C.5) for that slice, then move on.
3. When all slices land, flip the default export. Keep `IrisGridLegacy`
   exported for one minor release, then delete.

Why a feature flag and not a separate package: shipping two parallel
implementations doubles maintenance and creates a fork in plugin
authoring docs. The flag lets us land the rewrite in small PRs, each
green against the same test suite.

---

## Phase C.3 — Sidebar as a first-class plugin surface

Branch A and Branch B both treat sidebar replacement as a follow-up that
sits on top of the controllability framework (see
[DH-21476-controllable-iris-grid-table-options-plugin.md](./DH-21476-controllable-iris-grid-table-options-plugin.md)).
This branch folds it into the rewrite because the rewrite is what makes
it cheap.

Design:

- `IrisGridSidebar` is an exported component, not an internal one. It
  renders the menu + page stack from a typed `pages` prop:
  ```ts
  export interface SidebarPage<P = unknown> {
    type: string;             // OptionType for built-ins, free-form for plugins
    label: string;
    icon: ReactNode;
    component: React.ComponentType<P>;
    /** Whether this entry appears in the menu list. */
    enabled?: (state: IrisGridState) => boolean;
  }

  export interface IrisGridSidebarProps {
    pages: readonly SidebarPage[];
  }
  ```
- `IrisGrid` accepts `sidebar?: ReactNode | ((defaults: SidebarPage[]) => ReactNode)`.
  - Default: `<IrisGridSidebar pages={builtInPages} />`.
  - Plugin replacing one page: `(defaults) => <IrisGridSidebar pages={replace(defaults, 'rollup', MyRollup)} />`.
  - Plugin replacing the whole sidebar: pass any `ReactNode`.
- Built-in pages live in `packages/iris-grid/src/sidebar/` (where they
  already are) and are exported from
  `@deephaven/iris-grid/sidebar` so plugins can re-use individual ones
  alongside their own.
- Pages read/write via `useIrisGridSelector` / `useIrisGridDispatch` —
  the same primitives external code uses. There is no special "internal
  page" code path.
- Open/close (`isMenuShown`, `openOptions` page stack) is part of
  `IrisGridState`; pages dispatch `pushSidebarPage`,
  `popSidebarPage`, `closeSidebar` like any other action.

This makes the sidebar plugin plan
([DH-21476-controllable-iris-grid-table-options-plugin.md](./DH-21476-controllable-iris-grid-table-options-plugin.md))
collapse to: "register your `SidebarPage` in the host app's `pages`
prop". No separate extraction phase needed.

---

## Phase C.4 — Plumb stores through panels

### `IrisGridPanel`

[packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
becomes a function component (or stays a class with a hooked-in store —
either is fine; it's a thin shell). Changes:

1. Owns an `IrisGridStore` via `useMemo(() => createIrisGridStore(initial), [])`.
   Hydrates initial state from saved panel state via
   [IrisGridUtils](../packages/iris-grid/src/IrisGridUtils.ts) codecs.
2. Subscribes to the store and persists relevant slices via the
   existing `glEventHub` panel-state save mechanism. Persistence is
   slice-scoped so panel state writes don't fire on every keystroke
   (debounced + selector-driven).
3. Renders `<IrisGridStoreProvider store={store}><IrisGrid …/></IrisGridStoreProvider>`.
4. Exposes the store ref to consumers that need cross-panel coordination
   (e.g. linker, `FilterSetManagerPanel`).

### `GridWidgetPlugin`

Same: own a store, render with provider. No special shape needed.

### `TablePluginProps`

[packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts)
gains a single new field that supersedes A's `irisGrid: IrisGridHandle`
and B's `(state, applyOverride)`:

```ts
export interface TablePluginProps<S = unknown> {
  // ...existing fields...
  /** Store for the IrisGrid instance this plugin is attached to. */
  irisGridStore: IrisGridStore;
}
```

Plugins use `useIrisGridSelector` / `useIrisGridDispatch` against this
store the same way internal pages do. No two-API split.

### Compat shim for current consumers

A small `packages/iris-grid/src/compat/` module exposes:

- `wrapStoreAsLegacyHandle(store): LegacyIrisGridRef` — adapter that
  surfaces the previously-used class methods (`setFilters`,
  `setStateOverrides`, `handleRollupChange`, …) by translating them to
  store dispatches. Marked `@deprecated` from day one. Lets
  [FilterSetManagerPanel](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx#L354)
  keep working without immediate migration.
- `legacyOnStateChange(store, callback)` — adapter that mimics the old
  monolithic `onStateChange` shape for any consumer that relied on it.

These shims exist to keep the diff bounded; we don't promise to keep
them past one major after Branch C lands.

---

## Phase C.5 — Verification framework

Same shape as the parent plan's Phase C, but the conformance suite is
much simpler because there's only one API to exercise.

1. **Conformance suite** —
   `packages/iris-grid/src/store/conformance.test.tsx`. For every field
   in `IrisGridState`: dispatch the corresponding action, assert the
   selector reflects it, assert one `change` event fires with the
   correct `source`, assert dehydrate/hydrate round-trip via
   `IrisGridUtils`.
2. **Render-scope test** — mount `<IrisGrid>` with a plugin that
   subscribes to `selectSorts`. Dispatch `setQuickFilter`. Assert the
   plugin component does **not** re-render. Catches selector regressions
   that would tank perf.
3. **Loop test** — plugin echoes every change back as a same-value
   dispatch; reducer's value-equality short-circuit must terminate it.
4. **Sidebar plugin test** — replace one page via the `pages` prop and
   assert the plugin page mounts in place of the default.
5. **E2E smoke** — Playwright spec: stub plugin lifts sort + rollup +
   filter into its own store and drives them; rendered grid matches
   baseline snapshot.
6. **Plugin compat** — build `deephaven-plugins/plugins/ui` and
   `deephaven-plugins/plugins/simple-pivot` against the new package;
   run `npm run test:unit -- --testPathPattern="plugins/(ui|simple-pivot)"`.

---

## Phase C.6 — Migration & deprecation

We accept some breakage; we minimize it where it's cheap.

**Kept working via shim** (deprecated, removed in next major after
Branch C):

- `IrisGridPanel.setStateOverrides({ irisGridState, gridState })` —
  routes to store dispatch via the compat module.
- The old monolithic `onStateChange(state, gridState)` callback —
  emulated via `legacyOnStateChange`.
- `IrisGridStateOverride` type — marked deprecated; built-in consumers
  (`IrisGridMetricCalculator`, `IrisGridRenderer`) keep accepting it
  during the deprecation window by adapting from store state.

**Broken intentionally** (callers migrate to the store):

- Direct ref usage of the `IrisGrid` class instance
  (`irisGridRef.current.handleRollupChange(...)`, etc.). The new
  `IrisGrid` is a function component; refs no longer expose imperative
  methods. Callers receive an `irisGridStore` and dispatch.
- Legacy `IrisGrid` props that initialized state from props on mount
  (`sorts`, `quickFilters`, `…ForCreateOnly` style props) — replaced by
  `createIrisGridStore({ sorts: …, quickFilters: … })` and passing the
  store via `IrisGridStoreProvider`.

**Up-front audit** (do this in the first PR of Phase C):

- `grep -r "irisGrid\.\(handle\|set\)" --include='*.tsx' web-client-ui deephaven-plugins iris`.
  Categorize each hit: shim-covered, must-migrate, dead code. Land
  migrations as part of Phase C.4.

**Major version**: this is a breaking-change release of
`@deephaven/iris-grid` (and of `@deephaven/dashboard-core-plugins` if
panel props change). CHANGELOG entry under `BREAKING CHANGE:`. Per the
[web-client-ui AGENTS.md](../AGENTS.md) PR-title convention, the
release PR uses a `feat:` type with a `BREAKING CHANGE:` footer (no
`!` shorthand).

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Rewrite stalls; class and function implementations both alive for months | Feature flag + slice-by-slice migration; hard rule: no new features land in `IrisGridLegacy` once Phase C.2 starts. |
| Selector subscriptions miss a field and a stale render slips through | Conformance test asserts every `IrisGridState` field is reachable through `selectors.ts`. CI fails on missing entries. |
| Model effect ordering regresses (e.g. rollup + customColumns applied in wrong order) | Port `IrisGridModelEffects` first, with a dedicated test suite mirroring today's `componentDidUpdate` cases. |
| Zustand (or chosen store) leaks across grid instances | Always create a fresh store in `createIrisGridStore`; never use module-level singletons. Unit test mounts two grids and asserts isolation. |
| `IrisGridPanel` persistence flood (every keystroke triggers a save) | Persistence subscriber uses selector + debounce, written once and tested against a typing scenario. |
| Compat shim becomes a permanent crutch | Tag deprecation date on day one; remove in the major release **immediately following** Branch C, not the one after that. |
| Plugin authors confused by parallel A/B/C docs | Once Branch C is picked, archive A and B docs (move to `plans/archive/`) and update the parent plan to point at C only. |

---

## Relevant files

New (under `packages/iris-grid/src/store/`):

- `IrisGridState.ts`
- `IrisGridActions.ts`
- `IrisGridReducer.ts`
- `IrisGridStore.ts`
- `IrisGridStoreContext.tsx`
- `selectors.ts`
- `conformance.test.tsx`

New (under `packages/iris-grid/src/compat/`):

- `legacyHandle.ts`
- `legacyOnStateChange.ts`

Rewritten:

- [packages/iris-grid/src/IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx)
  — class → function component; legacy export becomes `IrisGridLegacy`
  for one minor.
- Sidebar pages under
  [packages/iris-grid/src/sidebar/](../packages/iris-grid/src/sidebar/)
  — switched to `useIrisGridSelector` / `useIrisGridDispatch`. No
  prop-drilled callbacks.

Modified:

- [packages/iris-grid/src/IrisGridProxyModel.ts](../packages/iris-grid/src/IrisGridProxyModel.ts)
  — unchanged externally; driven by `IrisGridModelEffects` hook.
- [packages/iris-grid/src/IrisGridUtils.ts](../packages/iris-grid/src/IrisGridUtils.ts)
  — dehydrate/hydrate now feed `createIrisGridStore` initial state.
- [packages/iris-grid/src/CommonTypes.tsx](../packages/iris-grid/src/CommonTypes.tsx)
  — `IrisGridStateOverride` deprecated; aliased onto
  `Partial<IrisGridState>`.
- [packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)
  — owns a store; provider-wraps the grid.
- [packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx](../packages/dashboard-core-plugins/src/panels/FilterSetManagerPanel.tsx)
  — keeps working through the legacy shim during deprecation window.
- [packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx)
  — owns a store.
- [packages/plugin/src/TablePlugin.ts](../packages/plugin/src/TablePlugin.ts)
  — `irisGridStore: IrisGridStore` on `TablePluginProps`.

---

## Open questions

1. **Store lib choice**: Zustand vs hand-rolled vs reused redux slice
   (Phase C.0). Recommendation Zustand; needs team confirmation.
2. **`IrisGridPanel` rewrite scope**: convert to function component
   wholesale, or just embed the store + provider in the existing class?
   The latter is smaller; the former unlocks future hook-based
   refactors. Recommend latter for this plan, defer the conversion.
3. **`IrisGridModel` and `dh.Table`**: out of the store today.
   Long-term, should we expose them via a side-channel context
   (`useIrisGridModel()`)? Probably yes; spec it during Phase C.2 once
   the model-effect hook is in place.
4. **In-tree compat-shim lifetime**: keep through one major (current
   recommendation) or two? Pick before merging Branch C.
5. **Tooling**: do we ship Zustand devtools middleware in dev builds?
   Recommendation yes — it's a one-liner and pays back the first time
   you debug an action loop.
