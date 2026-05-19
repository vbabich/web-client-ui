# Shortest Path: Customizable Table Options Sidebar

> **Status**: in progress on `vlad-DH-21476-o4.7`.
> **Goal**: let an external consumer of `<IrisGrid>` add, hide, relabel,
> reorder, or replace entries in the Table Options sidebar without
> touching `iris-grid` internals — using only the framework that is
> already shipping on this branch (Phase 0 + Phase 0.1).
> **Scope**: this is the minimum-viable subset of
> [DH-21476-05](./DH-21476-05-sidebar-plugin-extensibility.md). Full
> per-page replacement (`sidebarPages`) and host extraction stay in
> [DH-21476-04](./DH-21476-04-post-decision-table-options-plugin.md).
> **Prereqs (all done)**: Phase 0 registry + `applyState` + granular
> `onStateDidChange` + `IrisGridControlContext`; Phase 0.1 handler
> migration. **No** dependency on
> [DH-21476-02](./DH-21476-02-imperative-ref-handle.md) or
> [DH-21476-04](./DH-21476-04-post-decision-table-options-plugin.md).

## What ships

A single new prop on `IrisGrid`:

```ts
type SidebarItemKey = OptionType | string;

type OptionItem = {
  type: SidebarItemKey;
  title: string;
  subtitle?: string;
  icon?: IconDefinition;
  isOn?: boolean;
  onChange?: () => void;
  /** Renderer for plugin-supplied items. Built-ins leave this
   *  undefined — IrisGrid's existing switch renders them. */
  configPage?: ComponentType<IrisGridSidebarPageProps>;
};

interface IrisGridProps {
  /** Pure transform over the default item list. Composes with the
   *  panel-level `IrisGridSidebarContext`. */
  sidebarItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
}

interface IrisGridSidebarPageProps {
  model: IrisGridModel;
  onBack: () => void;
}
```

Plus the panel-side glue and an example plugin so the API has a real
consumer. Built-in sidebar pages are untouched.

## Step 1 — `IrisGrid` prop surface (web-client-ui)

1. **Widen the item-key type.** In
   [packages/iris-grid/src/sidebar/OptionType.ts](../packages/iris-grid/src/sidebar/OptionType.ts):
   - Keep the enum closed.
   - Add `export type SidebarItemKey = OptionType | string;`
   - Add `export function isPluginItemKey(key: SidebarItemKey): key is string` —
     returns `true` iff `key` is not a member of `OptionType`. Use it
     in dev-mode warnings (Step 4) and in the page-switch `default`
     arm.

2. **Extend `OptionItem`.** In
   [packages/iris-grid/src/CommonTypes.tsx](../packages/iris-grid/src/CommonTypes.tsx#L45):
   - Change `type: OptionType` to `type: SidebarItemKey`.
   - Add `configPage?: ComponentType<IrisGridSidebarPageProps>`.
   - Export the new `IrisGridSidebarPageProps` shape next to it.

3. **Wire the transform into `IrisGrid`.** In
   [packages/iris-grid/src/IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx):
   - Add `sidebarItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];`
     to `IrisGridProps`.
   - At the `getCachedOptionItems(...)` call site
     ([L5266](../packages/iris-grid/src/IrisGrid.tsx#L5266)), apply
     `sidebarItems` after the memoized defaults are computed. Wrap the
     call in `try/catch`; on throw, log once and use the defaults
     verbatim. The transform output is `Object.freeze`d.
   - In the page-switch ([L5285](../packages/iris-grid/src/IrisGrid.tsx#L5285)),
     replace `default: throw Error(...)` with: look up the option from
     the (transformed) list by `type`; if it has `configPage`, render
     `<PluginSidebarErrorBoundary><Page model={model} onBack={this.handleMenuBack} /></PluginSidebarErrorBoundary>`;
     otherwise keep the throw (programmer error).

4. **Dev-mode duplicate-key guard.** Inside the transform call site,
   `process.env.NODE_ENV !== 'production'` block: warn (once per
   key-set) if two items in the transformed list share the same `type`.

5. **Tiny error boundary.** New file
   `packages/iris-grid/src/sidebar/PluginSidebarErrorBoundary.tsx`.
   Renders `null` on error, logs once. Used only for plugin pages.

6. **Tests.**
   `packages/iris-grid/src/sidebar/IrisGridSidebarItems.test.tsx`:
   - Default identity → built-in items unchanged.
   - `sidebarItems` filters one built-in → page-switch path still
     renders other entries.
   - `sidebarItems` adds an item with a `configPage` → on
     `applyState('openOptions', [{type: 'plugin:foo'}], 'external')`
     the page renders.
   - Throwing transform → defaults render; error logged once.
   - Dev-mode duplicate-key warning fires once.

## Step 2 — Panel glue + context (web-client-ui)

1. **Publish `IrisGridSidebarContext`** from
   `packages/iris-grid/src/sidebar/IrisGridSidebarContext.tsx`:
   ```ts
   interface IrisGridSidebarExtension {
     transformItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
   }
   const IrisGridSidebarContext =
     createContext<IrisGridSidebarExtension | null>(null);
   function useResolvedSidebarExtension(): IrisGridSidebarExtension;
   ```
   Re-export from `packages/iris-grid/src/index.ts`.

2. **Forward through panel hosts.**
   - [packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx):
     read the context, pass `extension.transformItems` as the
     `sidebarItems` prop to `<IrisGrid>`.
   - [packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx):
     same.

3. **Tests.** Render each host wrapped in a provider that filters out
   one built-in; assert the menu list no longer includes it.

## Step 3 — Example middleware plugin (deephaven-plugins)

1. New package `deephaven-plugins/plugins/table-options-example/`
   following the [build-plugin skill](../../deephaven-plugins/.github/skills/build-plugin/SKILL.md)
   scaffold (`src/js/` + `src/python/`).

2. JS side registers a `WidgetMiddlewarePlugin` that wraps the
   widget's `component` / `panelComponent` in
   `<IrisGridSidebarContext.Provider>` composing the parent value
   (read via `useContext`) with its own contribution:
   - Hide one built-in (e.g. `OptionType.SELECT_DISTINCT`) by
     filtering it out.
   - Add one plugin item with `type: 'plugin:table-options-example:hello'`
     and a tiny `configPage` that calls `useIrisGridControl()` (Phase 0)
     to display the current `quickFilters` count.

3. Python side: standard `register` boilerplate (no server-side
   functionality).

4. E2E test: docker spec opens Table Options on a sample table,
   asserts "Select Distinct" is hidden and the new "Hello (plugin)"
   item is present and renders its page.

## Definition of Done

- `<IrisGrid sidebarItems={defaults => …}>` is a public, typed prop on
  `@deephaven/iris-grid`.
- `IrisGridSidebarContext` + `useResolvedSidebarExtension` exported
  and consumed by `IrisGridPanel` and `GridWidgetPlugin`.
- Example middleware plugin shows hide-one + add-one working end to
  end (Jest + Playwright).
- Full unit suite green (3447+ across web-client-ui).
- No behavior change for any in-tree consumer that does **not** pass
  `sidebarItems` (default identity transform).

## Out of scope (for this plan)

- Replacing built-in pages (`RollupRows`, `VisibilityOrderingBuilder`,
  etc.) — that's [DH-21476-04](./DH-21476-04-post-decision-table-options-plugin.md).
- Extracting `<IrisGridSidebar>` host out of `IrisGrid` — same plan.
- Imperative ref handle ([DH-21476-02](./DH-21476-02-imperative-ref-handle.md)).
  Plugin pages already reach state via `IrisGridControlContext`.
- Python RPC layer.

## Verification commands

```bash
# unit tests for the new prop + context
npm run test:unit -- --testPathPattern="packages/iris-grid/src/sidebar"
# regression guard
npm run test:unit -- --testPathPattern="packages/iris-grid"
# full app
npm run test:unit
# example plugin (run from deephaven-plugins)
npm run test:unit -- --testPathPattern="plugins/table-options-example"
npm run e2e:docker -- ./tests/table-options-example.spec.ts --reporter=list
```
