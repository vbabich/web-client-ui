# Plan: Sidebar plugin extensibility via widget middleware

> **Status**: design — active deliverable for branch `vlad-DH-21476-o4.7`.
> Builds directly on [Phase 0](./DH-21476-01-phase-0-foundation.md) (registry + `IrisGridControlContext`).
> **Owner**: TBD.
> **Depends on**: Phase 0 (merged on this branch) and the existing
> [`WidgetMiddlewarePlugin`](../packages/plugin/src/PluginTypes.ts) infrastructure
> ([CHANGELOG note for #2660](../CHANGELOG.md)). Does **not** require Phase 0.1 or the [imperative ref handle](./DH-21476-02-imperative-ref-handle.md).
> **Spans repos**: `web-client-ui` (Phases 1–2) + `deephaven-plugins` (Phase 3).
> **Supersedes for this branch**: the "add/hide menu items" subset of
> [DH-21476-04 — Table Options sidebar plugin](./DH-21476-04-post-decision-table-options-plugin.md).
> Full sidebar-host extraction stays scoped to plan 04 and is not delivered here.

## Goal

Let an external widget **middleware plugin** supply new sidebar items to `IrisGrid` and modify existing ones (hide / rename / re-icon / replace handler). Ship a minimal example middleware plugin in `deephaven-plugins` that hides one built-in item and adds one new item with its own config page, persisted via [`usePersistentState`](../packages/dashboard/src/usePersistentState.ts).

Out of scope on this branch:
- Replacing the entire sidebar host (deferred to plan 04).
- Inventing a new `PluginType`. We reuse `PluginType.MIDDLEWARE_PLUGIN`.
- Plugin-driven changes to non-sidebar UI (context menus, toolbar, etc.).
- Phase 0.1 handler migration. Plugin pages drive grid state through `IrisGridControlContext.apply(field, value)`, which already exists.

## Design decisions

1. **No new `PluginType`.** Use the existing `WidgetMiddlewarePlugin` to discover sidebar contributions. The middleware wraps the widget's `component` / `panelComponent`, mounts a React context provider around it, and publishes its sidebar contribution into that context. `IrisGrid` (read via `IrisGridPanel` / `GridWidgetPlugin`) consumes the context and turns the contribution into props.

2. **Ship the prop before the plugin.** Phases 1–2 land the IrisGrid props, the `IrisGridSidebarContext`, the consumer hook, and the panel-side glue **with no plugin consumer**. Plain unit tests prove the prop works (default no-op, transform applied, page renderer wired, error boundary catches throws). Only Phase 3 in `deephaven-plugins` actually writes a middleware plugin against the now-stable API.

3. **Prop shape on `IrisGrid`** — a single optional prop that takes a transform over the default item list. Items carry their own renderer:
   ```ts
   type OptionItem = {
     type: SidebarItemKey;          // OptionType | string
     title: string;
     subtitle?: string;
     icon?: IconDefinition;
     isOn?: boolean;
     onChange?: () => void;
     /** Plugin-contributed items supply this. Built-ins leave it undefined
      *  (IrisGrid renders them via its internal switch). */
     configPage?: React.ComponentType<IrisGridSidebarPageProps>;
   };

   interface IrisGridProps {
     /** Transform the built-in option list. Pure function; called inside memoization. */
     sidebarItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
   }
   ```
   - `sidebarItems` covers **modify** (replace `title`/`icon`/`onChange`), **hide** (filter out), **reorder**, and **add** (push new entries that carry their own `configPage`).
   - Built-in items arrive with `configPage` undefined; IrisGrid's existing switch keeps rendering them. Plugin items arrive with `configPage` set; the switch's `default` arm renders it.
   - Plugin-contributed item `type` values must be namespaced strings (e.g. `plugin:<plugin-name>:<id>`); a dev-mode warning fires if two contributors collide.

4. **Why a transform function, not a list?** "Modify existing" needs access to the current built-ins (to filter/relabel). A transform receives them; a static list would force middleware to re-derive the default list, duplicating availability logic (`isChartBuilderAvailable`, etc.) that lives in `IrisGrid`. Transform composition (multiple middlewares) is left-to-right in middleware registration order, mirroring how `WidgetMiddlewarePlugin` chain order already works.

5. **`OptionType` stays a closed enum.** The `type` field on `OptionItem` widens to `OptionType | string` (new alias `SidebarItemKey`). All existing `switch (option.type)` sites keep their `case` arms for built-in members and gain a `default` arm that renders `current.configPage` if present.

6. **Context shape** — single context published in `@deephaven/iris-grid`:
   ```ts
   interface IrisGridSidebarExtension {
     transformItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
   }

   const IrisGridSidebarContext =
     React.createContext<IrisGridSidebarExtension | null>(null);

   /** Returns the context value or an empty object. */
   function useResolvedSidebarExtension(): IrisGridSidebarExtension;
   ```
   `IrisGridPanel` and `GridWidgetPlugin` call `useResolvedSidebarExtension()` and forward `extension.transformItems` into `IrisGrid` as the `sidebarItems` prop. A middleware contributes by wrapping its children in `<IrisGridSidebarContext.Provider value={...}>` — composition with parent providers is the responsibility of the middleware (read `useContext(IrisGridSidebarContext)`, compose, publish a new value).

7. **Plugin page contract** — `IrisGridSidebarPageProps`:
   ```ts
   interface IrisGridSidebarPageProps {
     /** Read-only model handle. */
     model: IrisGridModel;
     /** Pop this page off the sidebar stack. */
     onBack: () => void;
   }
   ```
   Plugin pages reach grid state via `useIrisGridControl()` (Phase 0 context) and persist their own state via `usePersistentState({ type, version })`. The contract is intentionally tiny — everything else is a hook.

8. **Hide / modify semantics**: a `sidebarItems` transform that filters out an item is the canonical hide. The model's availability gating still runs first (built-in items disabled by the model are absent from `defaults`), so transforms can't accidentally resurrect features the model has turned off.

9. **Error containment**: plugin pages are wrapped in a small error boundary inside `IrisGrid`'s page switch. A throwing transform is logged once and treated as identity for that render.

## Phase 1 — Expose the IrisGrid props (web-client-ui)

This phase ships the **prop surface only**. No plugin consumer yet. The point is to make the prop available so middleware authors (Phase 3) can target it.

1. **Widen `OptionType` usage to `OptionType | string`**. Enum stays. Add `type SidebarItemKey = OptionType | string` and helper `isPluginItemKey(key): boolean` in [packages/iris-grid/src/sidebar/OptionType.ts](../packages/iris-grid/src/sidebar/OptionType.ts). Update [OptionItem](../packages/iris-grid/src/CommonTypes.tsx) so `type` is `SidebarItemKey`.

2. **Add the `sidebarItems` prop on `IrisGrid`** (in [IrisGrid.tsx](../packages/iris-grid/src/IrisGrid.tsx) `IrisGridProps`):
   ```ts
   sidebarItems?: (defaults: readonly OptionItem[]) => readonly OptionItem[];
   ```
   Add an optional `configPage?: React.ComponentType<IrisGridSidebarPageProps>` field to `OptionItem` ([CommonTypes.tsx](../packages/iris-grid/src/CommonTypes.tsx)). Defaults: `sidebarItems` is `undefined`, `configPage` absent on every built-in item. Type-export `IrisGridSidebarPageProps` from the package barrel.

3. **Apply `sidebarItems` inside `getCachedOptionItems()`**. The memoized result wraps the existing built-in list with `sidebarItems?.(builtIns) ?? builtIns`. The memoization key gains the transform identity (referential equality; middleware authors must memoize their transform — documented in the JSDoc).

4. **Render plugin pages from `configPage` in `renderOptionPage`** (the existing switch at IrisGrid.tsx ~L5260). Add a `default:` that:
   - If `current.configPage` is set, renders `<current.configPage model={model} onBack={this.handleMenuBack} />` inside a `<SidebarPluginErrorBoundary>` (new tiny component co-located in `packages/iris-grid/src/sidebar/`).
   - If absent, logs a `log.error` (an unrecognized non-built-in item slipped through) and returns `null`.

5. **Tests** — purely prop-level, no middleware involved. New file `packages/iris-grid/src/sidebar/IrisGridSidebar.test.tsx`:
   - `sidebarItems` undefined → built-in list rendered as before (snapshot guard).
   - `sidebarItems` returning a filtered list → built-in items absent.
   - `sidebarItems` returning an extra item with `configPage` → click opens the page and renders the supplied component.
   - Plugin page receives `{ model, onBack }`; `onBack` pops `openOptions`.
   - Throwing page is caught by the error boundary; menu still functional.
   - Non-built-in item with no `configPage` → graceful no-op + logged error.

### Phase 1 — Definition of Done

- `IrisGridProps` exposes `sidebarItems` (optional, inert when omitted).
- `OptionItem` gains an optional `configPage` field; all existing built-in items leave it unset.
- `OptionItem.type` is `SidebarItemKey` (`OptionType | string`); all existing switches still compile.
- Built-in menu snapshot tests unchanged (prop default is a no-op).
- New `IrisGridSidebar.test.tsx` covers add / modify / hide / page-render / error containment.
- `IrisGridSidebarPageProps` exported from `@deephaven/iris-grid` index.
- No changes yet to `IrisGridPanel`, `GridWidgetPlugin`, or `@deephaven/plugin`.

### Phase 1 — Verification commands

```bash
npm run types
npm run test:unit -- --testPathPattern="packages/iris-grid/src/sidebar"
npm run test:unit -- --testPathPattern="packages/iris-grid"
```

---

## Phase 2 — Middleware bridge (web-client-ui)

Wire the new IrisGrid props to a React context that middleware plugins can populate. Still no consumer in deephaven-plugins; this phase only adds the bridge.

1. **Add `IrisGridSidebarContext`** in `packages/iris-grid/src/sidebar/IrisGridSidebarContext.tsx`:
   - Context type `IrisGridSidebarExtension | null` (see Decisions §6).
   - `useResolvedSidebarExtension()` hook that returns the context value or an empty object.

2. **Consume the context in `IrisGridPanel`** ([IrisGridPanel.tsx](../packages/dashboard-core-plugins/src/panels/IrisGridPanel.tsx)) and **`GridWidgetPlugin`** ([GridWidgetPlugin.tsx](../packages/dashboard-core-plugins/src/GridWidgetPlugin.tsx)):
   - Call `useResolvedSidebarExtension()`.
   - Pass `extension.transformItems` as `sidebarItems` to `<IrisGrid>`.
   - No change when no Provider is mounted (extension is empty, prop is `undefined`).

3. **Document the middleware contract** alongside the existing JSDoc on `WidgetMiddlewarePlugin` in [PluginTypes.ts](../packages/plugin/src/PluginTypes.ts): "To contribute sidebar items to IrisGrid widgets, wrap the supplied `<Component {...props} />` in `<IrisGridSidebarContext.Provider value={{ transformItems }}>`. Compose with any inherited context value via `useContext(IrisGridSidebarContext)`."

4. **Re-export `IrisGridSidebarContext`** and `IrisGridSidebarExtension` from `@deephaven/iris-grid`'s index so middleware authors can import them.

5. **Tests** — `packages/dashboard-core-plugins/src/panels/IrisGridPanel.test.tsx` gains a case that mounts the panel inside an `IrisGridSidebarContext.Provider` and verifies the contributed item appears in the menu.

### Phase 2 — Definition of Done

- `IrisGridSidebarContext` exported from `@deephaven/iris-grid`.
- `IrisGridPanel` and `GridWidgetPlugin` resolve the context and forward to `IrisGrid`'s `sidebarItems` prop.
- Snapshot tests for both panels unchanged when no Provider is mounted.
- A unit test demonstrates a context-supplied transform reaches the rendered menu without any middleware machinery.
- Middleware contract documented next to `WidgetMiddlewarePlugin`.

### Phase 2 — Verification commands

```bash
npm run types
npm run test:unit -- --testPathPattern="packages/dashboard-core-plugins"
npm run test:unit -- --testPathPattern="packages/iris-grid/src/sidebar"
```

---

## Phase 3 — Minimal example middleware plugin (deephaven-plugins)

Add a new plugin at `deephaven-plugins/plugins/grid-sidebar-example/`. This is a `WidgetMiddlewarePlugin` keyed to the table widget type. It does two things, both visible at a glance:

1. **Hides** the built-in `OptionType.AGGREGATIONS` item (most visually obvious removal; reversible by uninstalling).
2. **Adds** a "Notes" item: a single `<textarea>` whose contents persist per-panel via `usePersistentState`. No grid mutations, no I/O — just demonstrates the persistence contract end-to-end.

### File layout

```
plugins/grid-sidebar-example/
├── README.md
├── pyproject.toml
├── src/
│   ├── js/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                          # default-exports the middleware plugin
│   │       ├── GridSidebarExampleMiddleware.tsx  # the middleware component
│   │       ├── GridSidebarExamplePlugin.ts       # WidgetMiddlewarePlugin descriptor
│   │       └── NotesPage.tsx                     # the new sidebar item's renderer
│   └── deephaven/
│       └── grid_sidebar_example/                 # Python package, registers JS bundle
│           ├── __init__.py
│           └── js_plugin.py
└── tests/                                        # python smoke + JS unit tests
```

### Key files

- **`GridSidebarExamplePlugin.ts`**:
  ```ts
  import { PluginType, type WidgetMiddlewarePlugin } from '@deephaven/plugin';
  import GridSidebarExampleMiddleware from './GridSidebarExampleMiddleware';

  const GridSidebarExamplePlugin: WidgetMiddlewarePlugin = {
    name: '@deephaven/js-plugin-grid-sidebar-example',
    type: PluginType.MIDDLEWARE_PLUGIN,
    supportedTypes: 'Table', // widen if needed
    component: GridSidebarExampleMiddleware,
  };

  export default GridSidebarExamplePlugin;
  ```

- **`GridSidebarExampleMiddleware.tsx`**:
  ```tsx
  import { useMemo, useContext } from 'react';
  import type { WidgetMiddlewareComponentProps } from '@deephaven/plugin';
  import {
    IrisGridSidebarContext,
    OptionType,
    type IrisGridSidebarExtension,
    type OptionItem,
  } from '@deephaven/iris-grid';
  import { vsNote } from '@deephaven/icons';
  import NotesPage from './NotesPage';

  const NOTES_KEY = 'plugin:@deephaven/js-plugin-grid-sidebar-example:notes';

  export default function GridSidebarExampleMiddleware({
    Component,
    ...rest
  }: WidgetMiddlewareComponentProps): JSX.Element {
    const parent = useContext(IrisGridSidebarContext);

    const extension = useMemo<IrisGridSidebarExtension>(() => {
      const parentTransform = parent?.transformItems;
      const transformItems = (defaults: readonly OptionItem[]) => {
        const upstream = parentTransform ? parentTransform(defaults) : defaults;
        const filtered = upstream.filter(i => i.type !== OptionType.AGGREGATIONS);
        return [
          ...filtered,
          { type: NOTES_KEY, title: 'Notes', icon: vsNote, configPage: NotesPage },
        ];
      };
      return { transformItems };
    }, [parent]);

    return (
      <IrisGridSidebarContext.Provider value={extension}>
        <Component {...rest} />
      </IrisGridSidebarContext.Provider>
    );
  }
  ```

- **`NotesPage.tsx`**:
  ```tsx
  import { usePersistentState } from '@deephaven/plugin';
  import type { IrisGridSidebarPageProps } from '@deephaven/iris-grid';

  export default function NotesPage({ onBack }: IrisGridSidebarPageProps) {
    const [notes, setNotes] = usePersistentState<string>('', {
      type: 'GridSidebarExample.Notes',
      version: 1,
    });
    return (
      <div className="grid-sidebar-example-notes">
        <button type="button" onClick={onBack}>Back</button>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes for this table…"
        />
      </div>
    );
  }
  ```

- **`index.ts`**: `export { default } from './GridSidebarExamplePlugin';`
- **Python side**: mirror `table-example/src/deephaven/table_example/js_plugin.py`; register the JS bundle path, no runtime API needed.

### Phase 3 — Definition of Done

- `pip install -e plugins/grid-sidebar-example` succeeds against a local deephaven-core; plugin appears in the server's plugin manifest.
- With the plugin installed and the web served by `web-client-ui` dev server, opening any table widget:
  - The Aggregations item is **gone** from the sidebar.
  - A **Notes** item is present with the configured icon and title.
  - Clicking Notes opens a textarea; typing then closing/reopening the panel restores the text.
  - A second panel with a different table shows independent Notes (per-`dhId` persistence).
- Composition test: with **two** middleware plugins installed (the example plus a contrived second one), both transforms apply in registration order without clobbering each other.
- E2E test at `deephaven-plugins/tests/grid-sidebar-example.spec.ts` covers add + hide + persist round-trip.
- README documents the middleware contract end-to-end so a third party can copy this folder as a template.

### Phase 3 — Verification commands

```bash
# Build the plugin (deephaven-plugins root, with .venv activated)
python tools/plugin_builder.py --reinstall grid-sidebar-example

# JS unit tests for the plugin
npm run test:unit -- --testPathPattern="plugins/grid-sidebar-example"

# E2E
npm run e2e:docker -- ./tests/grid-sidebar-example.spec.ts --reporter=list
```

---

## Relationship to other plans

- [Phase 0 foundation](./DH-21476-01-phase-0-foundation.md): provides `IrisGridControlContext`, which plugin pages use when they want to mutate registered grid fields. The Notes example doesn't need it; the next plugin that does will. **Already merged on this branch.**
- [Phase 0.1 handler migration](./DH-21476-01-phase-0-foundation.md#phase-01--handler-migration): independent. Sidebar plugin pages bypass legacy handlers by going through `IrisGridControlContext.apply`. Not a prereq here.
- [Imperative ref handle (DH-21476-02)](./DH-21476-02-imperative-ref-handle.md): orthogonal. The middleware never holds an `IrisGridHandle`; it only contributes items. Plugin pages that need to drive registered fields use `IrisGridControlContext` directly. The handle plan is the consumer-side surface that ships in parallel.
- [Plan 04 — Table Options sidebar plugin](./DH-21476-04-post-decision-table-options-plugin.md): full sidebar-host extraction. Subsumes this plan's surface as a special case. Remains the long-term target; this plan is the minimum viable subset that ships now and exercises the contract.

## Open questions

1. **Plugin item placement.** Should plugin-contributed items append at the end, sit under a separate "Plugins" header, or anchor relative to a built-in (`after?: OptionType`)? Recommendation: leave placement entirely to the transform — append-at-end is just what most plugins will write, but the API doesn't enforce it.
2. **Single Provider vs collector.** Today the plan has each middleware compose its transform on top of the parent context (read `useContext`, build new value, render new Provider). Simpler alternative: a collector context whose value is `Array<IrisGridSidebarExtension>` and the consumer hook composes them. Pros: middleware authors don't need to remember to read-and-compose. Cons: extra concept, harder to reason about ordering. Recommendation: ship the explicit-compose model; revisit if multiple-middleware UX is awkward.
3. **`usePersistentState` under `GridWidgetPlugin`.** Verify in Phase 2 that `usePersistentState` works inside a `GridWidgetPlugin` mount (deephaven-plugins/`ui` uses this path). If it doesn't, decide whether to add `PersistentStateProvider` there or document the limitation.
4. **Transform memoization expectation.** `sidebarItems`'s identity is part of the memoization key for `getCachedOptionItems`. If a middleware author forgets to `useMemo`, the menu re-derives every render. Acceptable cost, or do we want the consumer hook to memoize on contributions? Recommendation: document the requirement; add a dev-mode warning if the same transform identity isn't seen across two consecutive renders.
