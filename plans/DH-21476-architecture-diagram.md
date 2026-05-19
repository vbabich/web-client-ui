# DH-21476 — IrisGrid Architecture (branch `vlad-DH-21476-o4.7`)

Visual summary of what landed on this branch:

- **Phase 0** — controllable-field registry, canonical `applyState` pipe,
  granular `onStateDidChange`, `IrisGridControlContext` (the
  `IrisGrid` instance is itself the `IrisGridControlHandle`).
- **Phase 0.1** — handler migration: every internal `setState` for a
  registered field now goes through `applyState` / `applyStateMany`.
- **Phase 6 (in progress)** — `sidebarItems` transform prop +
  `OptionItem.configPage` + `PluginSidebarErrorBoundary` for plugin-
  supplied Table Options pages.

See [DH-21476-01-phase-0-foundation.md](DH-21476-01-phase-0-foundation.md)
and [DH-21476-06-shortest-path-customizable-table-options.md](DH-21476-06-shortest-path-customizable-table-options.md)
for the prose specs.

---

## Write/notify pipeline + control surface

```mermaid
flowchart TB
  classDef ext fill:#1f6feb22,stroke:#1f6feb,color:#1f6feb
  classDef new fill:#2ea04322,stroke:#2ea043,color:#2ea043
  classDef reg fill:#bf871722,stroke:#bf8717,color:#bf8717
  classDef legacy fill:#8b949e22,stroke:#8b949e,color:#8b949e,stroke-dasharray:4 3
  classDef plugin fill:#a371f722,stroke:#a371f7,color:#a371f7

  subgraph EXT["External world"]
    User([User gesture])
    Plugin[/"Plugin code<br/>(useIrisGridControl)"/]:::plugin
    Panel["IrisGridPanel<br/>(dashboard host)"]:::ext
  end

  subgraph IG["IrisGrid (class component)"]
    direction TB
    Handlers["Internal handlers<br/>handleFilterChange,<br/>handleSortChange,<br/>handleMenu*, ..."]
    Handle["IrisGridControlHandle<br/>(implements; `this`)"]:::new
    ApplyState["applyState&lt;K&gt;(field, value, source)"]:::new
    ApplyMany["applyStateMany(partial, source)"]:::new
    SetState["React this.setState"]
    Notify["notifyStateChange(field, value, prev, source)"]:::new
    Listeners["stateChangeListeners Set"]:::new
    State[("IrisGridState")]
    Registry[["CONTROLLABLE_FIELDS registry<br/>~30 field specs<br/>(quickFilters, sorts, customColumns,<br/>rollupConfig, formatter, openOptions, ...)"]]:::reg

    Handlers -- "source: 'internal'" --> ApplyState
    Handlers -- "batched" --> ApplyMany
    Handle -- "apply(field, value)<br/>source: 'external'" --> ApplyState
    Handle -- "apply(patch)" --> ApplyMany
    ApplyState -- "validate key" --> Registry
    ApplyMany -- "validate keys" --> Registry
    ApplyState --> SetState
    ApplyMany --> SetState
    SetState --> State
    SetState -- "callback" --> Notify
    Notify --> Listeners
  end

  subgraph CTX["React context"]
    Provider{{"IrisGridControlContext.Provider<br/>value = this"}}:::new
    Hook[/"useIrisGridControl()"/]:::new
  end

  User --> Handlers
  Plugin -- "useRef&lt;IrisGridControlHandle&gt;" --> Handle
  Plugin -- "hook" --> Hook
  Hook --> Provider
  Provider -. "publishes" .- Handle

  Notify -- "onStateDidChange(change)<br/>{field, value, prev, source, snapshot()}" --> Panel
  Listeners -- "subscribe / subscribeField" --> Plugin

  Notify -. "legacy onStateChange(state)<br/>(kept for back-compat)" .-> Panel:::legacy
```

**Key invariants enforced on this branch:**

- Every mutation of a *registered* `IrisGridState` field flows through
  `applyState` / `applyStateMany` — direct `this.setState` for
  registered keys is a code-review smell.
- `notifyStateChange` is the **only** emitter; it fires both
  `props.onStateDidChange` and the in-process subscriber set, so
  context consumers and the dashboard panel see identical events.
- `source` is `'internal'` for user gestures and `'external'` for
  writes coming through `IrisGridControlHandle.apply`, letting
  consumers distinguish their own writes without snapshot diffing.
- The class itself implements the handle interface — no
  `forwardRef` / `useImperativeHandle` wrapper. Ref ergonomics rely
  on covariant `RefObject<T>`, so both `useRef<IrisGrid>` and
  `useRef<IrisGridControlHandle>` work.
