# Plan: JS-only "Create Pivot" Plugin in Table Options

> **Status**: ready to start in parallel with the spike branches — this
> plugin is the **shared spike consumer** referenced by the
> [process plan, Step 2](./controllable-iris-grid-state-process.md#step-2--spike-branches-for-a-and-b-parallel-time-boxed).
> **Owner**: TBD (plugin lives in `deephaven-plugins/plugins/create-pivot/`).
> **Working branch**: `feat/create-pivot-plugin` in `deephaven-plugins`;
> framework slice (sidebar slot + optional `useSessionVariablesByType`)
> ships from a separate PR in `web-client-ui`.
> **Depends on**: a small slice of [Phase 0](./controllable-iris-grid-state.md#phase-0--shared-foundation-both-branches-build-on-this) (sidebar slot extension + `IrisGridControlContext` exposing `model`); coordination with the PivotService team for the type string and `createPivot` signature.
> **Blocks / unblocks**: the spike memos for [Branch A](./controllable-iris-grid-state-branch-a-imperative-ref.md) and [Branch B](./controllable-iris-grid-state-branch-b-expanded-override.md) consume this plugin as their evaluation harness; build it as **branch-agnostic** so the same plugin code runs against both spikes with one import swap.
> **Definition of Done**: "Create Pivot" entry appears in Table Options on flat tables, enabled when a `PivotService` is reachable; submit calls `pivotService.createPivot(...)` and opens the resulting widget; full Jest + one Playwright suite green; documented in the plugin's README.
> **Quick commands**:
>
> ```bash
> # web-client-ui side (sidebar slot + helper hook)
> npm run test:unit -- --testPathPattern="packages/(iris-grid/src/sidebar|jsapi-utils)"
> # deephaven-plugins side
> python tools/plugin_builder.py --reinstall create-pivot   # only on Python/version changes; JS-only changes hot-reload
> npm run test:unit -- --testPathPattern="plugins/create-pivot"
> npm run e2e:docker -- ./tests/create-pivot.spec.ts --reporter=list
> ```
>
> Filename uses a descriptive slug; rename to `DH-XXXXX-create-pivot-plugin.md` once a ticket is opened.

## What the plugin does

1. Adds a new entry **"Create Pivot"** to the Table Options menu rendered by [IrisGrid.tsx#L1168](../packages/iris-grid/src/IrisGrid.tsx#L1168).
2. The entry is **always added** when the table is **flat** (not `TreeTable`, not `PartitionedTable`, no rollup applied). It is **enabled** only when a sibling variable of type `PivotService` is reachable from the same connection. When the table is hierarchical the entry is omitted entirely; when the table is flat but no `PivotService` is available the entry is rendered **disabled with a tooltip** explaining why (e.g. *"No PivotService variable is available in this session. Define one to enable pivots."*).
3. **Variable discovery** — the same plugin bundle targets both editions:
   - **OSS / Community (baseline path).** Use the existing `dh.IdeConnection.subscribeToFieldUpdates(callback)` API. The callback receives `dh.ide.VariableChanges` ({ created, updated, removed } arrays of `dh.ide.VariableDefinition`). Filter by `definition.type === 'PivotService'`. This is the same primitive the OSS console uses to maintain its panel-list (see [AppMainContainer.tsx#L381](../packages/code-studio/src/main/AppMainContainer.tsx#L381)). The connection is reachable from any TablePlugin child via the existing `useConnection()` hook from `@deephaven/app-utils`. Granularity: **session-wide** — OSS has no query concept, so the plugin sees every `PivotService` defined in the same session.
   - **DHE / enterprise (optional refinement).** When `dh.ide.VariableDefinition.querySerial` is present (DHE only), additionally filter the discovered variables down to those that share the source table's `querySerial`. This narrows discovery to the owning query, matching DHE's stronger isolation model. Use feature detection (`if (definition.querySerial != null)`), not edition detection — no edition branch in the plugin code.
   - The `PivotService` type string is owned by the PivotService team — export a constant from a shared module so renaming is a one-line change.
4. When opened, the plugin renders a sidebar page with a small builder form (rows / columns / values picker over the source table's columns, plus a name field).
5. On submit, fetches the `PivotService` variable via the standard `connection.getObject(definition)` path, then calls `pivotService.createPivot({ source: <tableHandle>, rows, cols, values, name })` (exact signature TBD with the PivotService team) and either:
   - opens the resulting widget as a new dashboard panel via the existing `openObject` mechanism, or
   - returns a handle the plugin can pass to `useObjectFetcher`.
6. JS-only — no Python side; the plugin is published as a `@deephaven/plugin` package and registered via the standard `TablePlugin` mechanism.

## Goals

- Validate the framework against a **minimal** consumer (one menu item, one sidebar page, no controllable-state writes back into the grid).
- Produce a real, shippable plugin; do not throw it away after evaluation.
- **Ship a single bundle that works in both DHE and OSS**, using OSS's `subscribeToFieldUpdates` as the baseline and feature-detecting the DHE-only `querySerial` to narrow scope. Pivots themselves are currently DHE-only; OSS support is forward-looking but the plugin should not be edition-locked.
- Surface any small API gaps for cleaner sibling-variable discovery (e.g. an edition-agnostic `useSessionVariablesByType(type)` hook), but **do not block on them** — the plugin can be built directly against `subscribeToFieldUpdates` today.

## Non-goals

- Defining `PivotService` itself or the pivot widget UI. This plan assumes the type and a minimal `createPivot` method exist; the plugin only consumes them.
- Driving the source grid's state. The plugin **reads** the source table's columns and **does not write** any controllable field on it. This makes the consumer a useful counterpoint to the full-sidebar plugin.
- Hierarchical-table support. Explicitly out of scope per the requirement.

---

## Required framework support

This plugin is much smaller than the sidebar-replacement consumer in the companion plan. It needs only a subset of Phase 0 from [controllable-iris-grid-state.md](./controllable-iris-grid-state.md):

1. **Sidebar-slot extension point** (the `sidebarPages` + `menuItems` props described in [controllable-iris-grid-table-options-plugin.md § Required additions](./controllable-iris-grid-table-options-plugin.md)). Without `menuItems` the plugin can't append an entry; without `sidebarPages` it can't render its own page when that entry is selected. **Mandatory.**
2. **Read-only access to the source `IrisGridModel`** via `IrisGridControlContext` (Phase 0 #6). The plugin needs the column list, table schema, and a handle to the underlying `dh.Table`. The framework already exposes the model on `TablePluginProps.model` — this just needs to keep working.
3. **Sibling-variable discovery — already supported in OSS.** Both editions expose `dh.IdeConnection.subscribeToFieldUpdates(callback)`, which delivers `dh.ide.VariableChanges` (`{ created, updated, removed }` arrays). The plugin filters by `definition.type === 'PivotService'`. Access path:
   - The TablePlugin's React subtree can call `useConnection()` from `@deephaven/app-utils` (the same hook the console uses) to obtain the `IdeConnection` shared with the source table. No new field on `TablePluginProps` is strictly required for v1.
   - Optional convenience (recommended, not blocking): add a small edition-agnostic helper to [packages/jsapi-utils](../packages/jsapi-utils) such as
     ```ts
     // packages/jsapi-utils/src/useSessionVariablesByType.ts
     export function useSessionVariablesByType(
       type: string,
       opts?: { querySerial?: string },
     ): readonly dh.ide.VariableDefinition[];
     ```
     Implementation calls `subscribeToFieldUpdates`, accumulates current variables matching `type`, and (when `opts.querySerial` is provided **and** the variable definitions carry one — DHE only) narrows to that query. OSS callers omit `querySerial`; DHE callers pass it through and degrade gracefully if `querySerial` is missing on the discovered definitions.
   - DHE-specific narrowing: pass `model.table.getAttributes?.querySerial` (or whatever the canonical accessor turns out to be — verify in iris) into the helper. **Do not import any DHE-only package from this plugin** — stay on the public OSS API plus feature detection.
4. **Nothing else.** This plugin does not write to any controllable field, so the A-vs-B distinction barely matters for state plumbing. Build it branch-agnostic; the spike memos use it as their plugin-DX harness.

---

## Branch implications (short)

Both Branches A and B handle this consumer with comparable plugin code
(~400 lines either way) because the plugin is read-only against the
grid. Branch C — if it wins — lets the same plugin shrink slightly
(one hook for everything) but does not change the API surface this
plugin uses. **Build the plugin once against Phase 0 + the existing
`subscribeToFieldUpdates` primitive; rebind the read path with a
one-line import swap whichever branch is picked.**

The full A-vs-B comparison the spike memos produce will use this
plugin's actual development time and re-render counts as data points,
so keep the implementation faithful to what a real plugin author would
write (no special-case shortcuts).

---

## Implementation plan

Six small PRs, all but the first in `deephaven-plugins`. Total scope is small enough that one engineer can land all of it.

### Milestone 0 — Framework prerequisites (web-client-ui, 1 PR)

- Land just the slice of [controllable-iris-grid-state.md](./controllable-iris-grid-state.md) Phase 0 needed here:
  - Sidebar-slot extension (`sidebarPages`, `menuItems`) — see [controllable-iris-grid-table-options-plugin.md § Required additions](./controllable-iris-grid-table-options-plugin.md). The `OptionItem` type ([sidebar/](../packages/iris-grid/src/sidebar/index.ts)) needs to gain an optional `disabled?: boolean` and `tooltip?: ReactNode` so the plugin can render the disabled-with-tooltip state described above. Confirm whether the existing `Menu`/`Page` primitives already render a disabled state — if not, extend them.
  - **Optional but recommended**: add a `useSessionVariablesByType(type, opts?)` hook to [packages/jsapi-utils](../packages/jsapi-utils) wrapping `connection.subscribeToFieldUpdates`. Edition-agnostic; DHE narrowing via the optional `querySerial` arg. Skip if it adds friction — the plugin can call `subscribeToFieldUpdates` directly.
- No `applyX` normalization needed yet — this plugin doesn't write.
- Tests: Jest test that a custom `menuItems` adds an entry and a custom `sidebarPages` page renders when selected; Jest test that a disabled `OptionItem` renders with its tooltip and does not open a page on click; if the helper hook lands, a small Jest test for it against a mocked `IdeConnection`.

### Milestone 1 — Plugin scaffold (deephaven-plugins, 1 PR)

- New package `deephaven-plugins/plugins/create-pivot/` (JS-only — no Python module). Use the existing JS plugin scaffold; consult the [build-plugin skill](../../deephaven-plugins/.github/skills/build-plugin/SKILL.md) for the standard layout.
- Registers a `TablePlugin` that supplies `menuItems` and `sidebarPages`. Initially the `menuItems` callback always appends a stub "Create Pivot" entry; selecting it opens an empty page that just says "TODO".
- E2E (`npm run e2e:docker`): open Table Options on any flat table, assert "Create Pivot" appears, click it, assert the empty page renders.

### Milestone 2 — Eligibility gating (1 PR)

Two independent gates determine the menu entry's state:

1. **Flat table (omit / show).** Inspect `model` from `TablePluginProps`. The entry is omitted entirely when the table is hierarchical: `model instanceof IrisGridTreeTableModel`, `model.isExpandableGridModel`, `model.rollupConfig != null`, or `model.selectDistinctColumns?.length > 0`. Verify the canonical predicates against [IrisGridModel.ts](../packages/iris-grid/src/IrisGridModel.ts) before relying on them.
2. **`PivotService` available (enabled / disabled-with-tooltip).** Subscribe to `connection.subscribeToFieldUpdates` and accumulate definitions where `type === 'PivotService'`. Optionally narrow by `querySerial` when the source table's variable definition carries one (DHE only — feature-detect, do not branch on edition):
   ```ts
   const candidates = allPivotServices.filter(d =>
     sourceQuerySerial == null || d.querySerial === sourceQuerySerial
   );
   ```
   - 1+ matches → entry is enabled. If multiple, the builder page shows a small picker at the top; if exactly one, it's used implicitly.
   - 0 matches → entry is rendered **disabled** (`OptionItem.disabled = true`) with a tooltip: *"No PivotService variable is available in this session."* Clicking is a no-op.
   - `useConnection()` returns `null` (no active connection — should be impossible inside a `TablePlugin`, but guard anyway) → omit the entry.

Add a feature flag `enableCreatePivot` so QA can force-show the entry. Add a separate `enableCreatePivotIgnorePivotService` flag (default off) for development against environments that don't have a `PivotService` yet — forces the enabled state and stubs the submit path.

Tests: Jest unit tests with a mocked `IdeConnection` driving `subscribeToFieldUpdates` callbacks, plus mocked `model`, covering all combinations (hierarchical, flat+available, flat+missing, no-connection). On the DHE narrowing path, also test: variable with non-matching `querySerial` is ignored; variable without `querySerial` (OSS) is accepted. Snapshot the menu and the disabled-tooltip rendering.

### Milestone 3 — Builder form (1 PR)

- Sidebar page renders a form: name input, three drag-and-drop / multi-select column lists (Rows, Columns, Values). Source list is `model.columns` filtered to non-virtual columns.
- Use `@deephaven/components` primitives only (the curated Spectrum subset — never import `@adobe/react-spectrum` directly per [iris-grid AGENTS.md](../packages/iris-grid/AGENTS.md)).
- Form state is plain React state inside the page. No grid state writes.
- Validation: at least one column in Rows or Columns; values columns must be numeric; name non-empty.
- Tests: Jest tests with mocked columns; render + interaction assertions.

### Milestone 4 — Wire to PivotService (1 PR)

- On submit, resolve the `PivotService` variable handle via the standard `connection.getObject(variableDefinition)` path (the variable definition was already obtained in Milestone 2 from the field-updates stream). Await the resulting handle, call its `createPivot({ source, rows, cols, values, name })` (exact contract is the PivotService team's; coordinate). Treat the response as opaque; expect it to be a `dh.ide.VariableDefinition` for the new pivot widget.
- Open the result. Two options to coordinate with the PivotService owners:
  - **Recommended**: emit the new `VariableDefinition` through the dashboard's existing `openObject(definition)` event (used by Console). The plugin doesn't own panel rendering.
  - Fallback: if the pivot widget is a custom React component, register a `WidgetPlugin` so the dashboard panel system picks it up automatically when `openObject` fires.
- Error handling: surface `createPivot` errors via `@deephaven/log` and a toast (use `IrisGridControlContext.toast` if exposed by the framework, otherwise the existing notification helper).
- Tests: Jest integration test with a mocked `PivotService` proving the right arguments are passed and the returned definition is opened. One Playwright e2e against a fixture session that ships a stub `PivotService`.

### Milestone 5 — Live discovery (1 PR)

- Confirm the `subscribeToFieldUpdates` subscription set up in Milestone 2 already flips the entry between **enabled** and **disabled-with-tooltip** as the `PivotService` variable appears or disappears (no panel reopen required). The flat/hierarchical gate already re-evaluates on model swaps via the existing `IrisGridModel` event chain.
- Confirm the disabled-tooltip wording with UX (current draft: *"No PivotService variable is available in this session. Define one to enable pivots."*).
- Audit subscription lifecycle: ensure the `subscribeToFieldUpdates` unsubscribe runs on plugin unmount and on connection change. Add a Jest leak test using a fake-timers clock.
- Tests: Jest test simulating a `PivotService` add (then remove) via the subscribed callback and asserting `OptionItem.disabled` flips both ways.

### Milestone 6 — Documentation & release (1 PR)

- README in the new plugin package. Cover: prerequisites (`PivotService` variable in the query), supported table shapes, how to install.
- Bump version, add changelog entry, register the plugin in the standard plugin manifest used by `deephaven-plugins`.
- Smoke test on the existing docker dev setup ([deephaven-plugins/AGENTS.md](../../deephaven-plugins/AGENTS.md)) — a JS-only plugin should hot-reload without `plugin_builder.py --reinstall` per [user notes on the dev workflow](#).

---

## Risks & open questions

1. **`PivotService` API not yet defined.** The plugin's submit path is a single function call; isolate it behind a `pivotServiceClient.ts` module so when the real API lands the change is one file. Coordinate early — the PivotService team should produce a TS type definition (`@deephaven/jsapi-types` augmentation or its own typings package) before Milestone 4. They should also publish the canonical type-string constant (e.g. `PIVOT_SERVICE_TYPE = 'PivotService'`) to import rather than hard-coding.
2. **OSS "no query" granularity.** OSS lacks the DHE query-isolation concept; if a session has multiple `PivotService` instances they'll all be considered "available." v1 picks the first if exactly one, otherwise shows a picker at the top of the builder page. This is acceptable because in practice OSS sessions rarely define more than one of a given service type, and the picker degrades gracefully.
3. **`querySerial` accessor on a DHE table.** The DHE narrowing in Milestone 2 needs the source table's `querySerial`. Verify how to obtain it during Milestone 0 (likely via `model.table` or panel-state metadata; verify against the iris repo). If it's not cleanly accessible, ship v1 without DHE narrowing — session-wide discovery still works — and add narrowing as a follow-up.
4. **Feature detection, not edition detection.** The plugin must never `if (isEnterprise) ...`. All branching happens on data shape (e.g. `definition.querySerial != null`). This keeps the bundle identical across editions and avoids brittle UA/build-time checks.
5. **Subscription lifecycle.** `subscribeToFieldUpdates` returns an unsubscribe function; missing it leaks. Make the cleanup pattern explicit and test with React `unmount()` plus `act()` (Jest fake timers).
6. **Multiple `PivotService` instances.** Possible in either edition (different backends, different permissions). v1: if exactly one, use implicitly; if multiple, show a small selector at the top of the builder page; if zero, disabled-with-tooltip per Milestone 2.
7. **Hierarchical detection edge cases.** A flat table with a `customColumns` formula is still flat (pivotable). A flat table during rollup *configuration* (rollup config set but not yet applied) is racy — gate on the *current model*, not the in-flight rollup config. Test this explicitly.
8. **Panel reopens.** When the source table is reopened from a saved layout, the plugin must re-attach to it and re-establish its `subscribeToFieldUpdates` subscription. The framework's `TablePlugin` lifecycle already handles mount/unmount; add an explicit Jest test that mounts → unmounts → remounts the plugin against a stubbed connection and asserts the menu entry is correctly re-evaluated.
9. **Branch flip cost.** Because this plugin is Branch-agnostic, the only cost of flipping later is one import path change (`useIrisGridState` from the chosen package). Acceptable.

---

## Decision

Build this plugin **before** the framework picks A vs B. It exercises:

- The sidebar-slot extension, including the new `disabled` + `tooltip` `OptionItem` fields (shared by both branches).
- Edition-agnostic sibling-variable discovery via the existing OSS `subscribeToFieldUpdates` primitive, with feature-detected DHE narrowing by `querySerial` — independent of both branches.
- The cross-plugin coordination story (`TablePlugin` + `WidgetPlugin` + a backend service variable surfaced through the session).

…and it does so without taking a position on the controllability model. If it proves easy to build, that's evidence Phase 0 + the OSS discovery primitive is the right minimal foundation. If it proves hard, the friction will tell us which Phase 0 piece needs more work.
