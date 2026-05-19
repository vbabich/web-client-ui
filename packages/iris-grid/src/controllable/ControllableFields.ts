/**
 * Phase 0 of the controllable-IrisGrid framework. See
 * `plans/controllable-iris-grid-state.md` (DH-21476) for the full design.
 *
 * This registry enumerates every piece of `IrisGridState` that plugins
 * can drive from outside the grid. Both the "imperative ref" and
 * "expanded override" branches consume this registry as the spec they
 * must satisfy.
 *
 * Excluded by design (do NOT add without updating the plan):
 *   - selection ranges (`selectedRanges`)
 *   - pending edits (`pendingDataMap`, `pendingDataErrors`,
 *     `pendingSavePromise`, `pendingSaveError`, `pendingRowCount`)
 *   - sidebar-only scratch state (`conditionalFormatEditIndex`,
 *     `conditionalFormatPreview`, `selectedAggregation`,
 *     `gotoRow`, `gotoValue`, `gotoValueSelectedColumnName`,
 *     `gotoValueSelectedFilter`, `gotoValueManuallyChanged`,
 *     `gotoRowError`, `gotoValueError`)
 *   - download progress (`isTableDownloading`, `tableDownloadStatus`,
 *     `tableDownloadProgress`, `tableDownloadEstimatedTime`)
 *   - transient UI scratch (hover/tooltip/toast state)
 *   - internal computed values (`metrics`, `metricCalculator`,
 *     `searchFilter`, `isReady`, `loading*`, `copyOperation`)
 */

import type { IrisGridState } from '../IrisGrid';

/**
 * Broad category for a controllable field. Used by the
 * `IrisGridControlContext` consumers to group related fields and by the
 * conformance test to bucket coverage.
 */
export type ControllableCategory =
  | 'filter'
  | 'sort'
  | 'structure'
  | 'rollup'
  | 'format'
  | 'view'
  | 'sidebar';

/**
 * Describes how a field's value crosses the plugin boundary
 * (Python/JS bridge, dashboard layout JSON, etc.).
 *
 * - `plain`  — JSON-stringifiable as-is (booleans, strings, plain
 *              arrays of primitives).
 * - `codec`  — round-trips through a named helper on `IrisGridUtils`
 *              (`dehydrateX` / `hydrateX`).
 * - `handle` — non-serializable; passed by reference. Plugins receive
 *              an opaque handle and must drive a related controllable
 *              field instead (e.g. `customColumns` instead of swapping
 *              `model`).
 */
export type ControllableSerialization =
  | { readonly kind: 'plain' }
  | {
      readonly kind: 'codec';
      readonly dehydrate: string;
      readonly hydrate: string;
    }
  | { readonly kind: 'handle'; readonly note: string };

/**
 * Source of a state mutation.
 *
 * - `user`     — driven by an internal handler (user clicked, typed,
 *                dragged, etc.). Default for legacy code paths.
 * - `external` — driven by a plugin via `IrisGridControlContext.apply`.
 *                Allows external code to distinguish its own writes
 *                from user changes without diffing the snapshot.
 */
export type ControllableSource = 'internal' | 'external';

/**
 * Public spec for one controllable field. The `name` matches the key
 * on `IrisGridState`; the type parameter pins the value type so
 * `apply(field, value)` is type-safe.
 */
export interface ControllableFieldSpec<
  K extends keyof IrisGridState = keyof IrisGridState,
> {
  readonly name: K;
  readonly category: ControllableCategory;
  /** Optional name of the corresponding `IrisGridProps` initializer. */
  readonly initializerProp?: string;
  /** True when changing this field causes a model swap upstream. */
  readonly triggersModelSwap?: boolean;
  readonly serialization: ControllableSerialization;
  /** Free-form notes for plugin authors. */
  readonly notes?: string;
}

const HANDLE_FORMATTER: ControllableSerialization = {
  kind: 'handle',
  note: 'Formatter is opaque; drive `customColumnFormatMap` and `columnAlignmentMap` instead.',
};

const HANDLE_MODEL: ControllableSerialization = {
  kind: 'handle',
  note: 'IrisGridModel is opaque; drive `rollupConfig` / `selectDistinctColumns` / `customColumns` so the proxy reacts. For custom models use `IrisGridPanel.modelFactory`.',
};

const PLAIN: ControllableSerialization = { kind: 'plain' };

/**
 * Helper to define a spec while preserving the literal `name` type.
 */
function field<K extends keyof IrisGridState>(
  spec: ControllableFieldSpec<K>
): ControllableFieldSpec<K> {
  return spec;
}

/**
 * Canonical registry. Keys mirror `IrisGridState` field names. Order
 * within each category is arbitrary and may be reorganized.
 */
export const CONTROLLABLE_FIELDS = {
  // ── filter ─────────────────────────────────────────────────────────
  quickFilters: field({
    name: 'quickFilters',
    category: 'filter',
    initializerProp: 'quickFilters',
    serialization: {
      kind: 'codec',
      dehydrate: 'IrisGridUtils.dehydrateQuickFilters',
      hydrate: 'IrisGridUtils#hydrateQuickFilters',
    },
  }),
  advancedFilters: field({
    name: 'advancedFilters',
    category: 'filter',
    initializerProp: 'advancedFilters',
    serialization: {
      kind: 'codec',
      dehydrate: 'IrisGridUtils#dehydrateAdvancedFilters',
      hydrate: 'IrisGridUtils#hydrateAdvancedFilters',
    },
  }),
  isFilterBarShown: field({
    name: 'isFilterBarShown',
    category: 'filter',
    initializerProp: 'isFilterBarShown',
    serialization: PLAIN,
  }),
  partitionConfig: field({
    name: 'partitionConfig',
    category: 'filter',
    initializerProp: 'partitionConfig',
    triggersModelSwap: true,
    serialization: {
      kind: 'codec',
      dehydrate: 'IrisGridUtils#dehydratePartitionConfig',
      hydrate: 'IrisGridUtils#hydratePartitionConfig',
    },
  }),

  // ── sort ───────────────────────────────────────────────────────────
  sorts: field({
    name: 'sorts',
    category: 'sort',
    initializerProp: 'sorts',
    serialization: {
      kind: 'codec',
      dehydrate: 'IrisGridUtils.dehydrateSort',
      hydrate: 'IrisGridUtils#hydrateSort',
    },
  }),
  reverse: field({
    name: 'reverse',
    category: 'sort',
    initializerProp: 'reverse',
    serialization: PLAIN,
  }),

  // ── structure ──────────────────────────────────────────────────────
  customColumns: field({
    name: 'customColumns',
    category: 'structure',
    initializerProp: 'customColumns',
    serialization: PLAIN,
  }),
  selectDistinctColumns: field({
    name: 'selectDistinctColumns',
    category: 'structure',
    initializerProp: 'selectDistinctColumns',
    triggersModelSwap: true,
    serialization: PLAIN,
  }),
  movedColumns: field({
    name: 'movedColumns',
    category: 'structure',
    initializerProp: 'movedColumns',
    serialization: PLAIN,
  }),
  movedRows: field({
    name: 'movedRows',
    category: 'structure',
    initializerProp: 'movedRows',
    serialization: PLAIN,
  }),
  frozenColumns: field({
    name: 'frozenColumns',
    category: 'structure',
    serialization: PLAIN,
  }),
  columnHeaderGroups: field({
    name: 'columnHeaderGroups',
    category: 'structure',
    initializerProp: 'columnHeaderGroups',
    // Dehydration is performed inline by `IrisGridUtils#dehydrateIrisGridState`
    // (no standalone helper); hydration goes through the static
    // `IrisGridUtils.parseColumnHeaderGroups`. Treat as PLAIN here.
    serialization: PLAIN,
  }),

  // ── rollup ─────────────────────────────────────────────────────────
  rollupConfig: field({
    name: 'rollupConfig',
    category: 'rollup',
    initializerProp: 'rollupConfig',
    triggersModelSwap: true,
    serialization: PLAIN,
  }),
  rollupSelectedColumns: field({
    name: 'rollupSelectedColumns',
    category: 'rollup',
    serialization: PLAIN,
    notes:
      'Persisted across rollup config changes so the sidebar remembers the user selection.',
  }),
  aggregationSettings: field({
    name: 'aggregationSettings',
    category: 'rollup',
    initializerProp: 'aggregationSettings',
    serialization: PLAIN,
  }),

  // ── format ─────────────────────────────────────────────────────────
  formatter: field({
    name: 'formatter',
    category: 'format',
    serialization: HANDLE_FORMATTER,
  }),
  customColumnFormatMap: field({
    name: 'customColumnFormatMap',
    category: 'format',
    initializerProp: 'customColumnFormatMap',
    serialization: PLAIN,
  }),
  columnAlignmentMap: field({
    name: 'columnAlignmentMap',
    category: 'format',
    initializerProp: 'columnAlignmentMap',
    serialization: PLAIN,
  }),
  conditionalFormats: field({
    name: 'conditionalFormats',
    category: 'format',
    initializerProp: 'conditionalFormats',
    serialization: PLAIN,
  }),

  // ── view ───────────────────────────────────────────────────────────
  showSearchBar: field({
    name: 'showSearchBar',
    category: 'view',
    initializerProp: 'showSearchBar',
    serialization: PLAIN,
  }),
  searchValue: field({
    name: 'searchValue',
    category: 'view',
    initializerProp: 'searchValue',
    serialization: PLAIN,
  }),
  selectedSearchColumns: field({
    name: 'selectedSearchColumns',
    category: 'view',
    serialization: PLAIN,
  }),
  invertSearchColumns: field({
    name: 'invertSearchColumns',
    category: 'view',
    initializerProp: 'invertSearchColumns',
    serialization: PLAIN,
  }),

  // ── sidebar ────────────────────────────────────────────────────────
  isMenuShown: field({
    name: 'isMenuShown',
    category: 'sidebar',
    serialization: PLAIN,
    notes: 'Toggles the Table Options sidebar drawer.',
  }),
  openOptions: field({
    name: 'openOptions',
    category: 'sidebar',
    serialization: PLAIN,
    notes:
      'Stack of currently-open sidebar pages. Empty array closes the sidebar.',
  }),
  isGotoShown: field({
    name: 'isGotoShown',
    category: 'sidebar',
    serialization: PLAIN,
    notes:
      'Toggles the goto-row bar. The actual draft input lives outside the registry.',
  }),
} as const;

/**
 * Union of all registered field names.
 */
export type ControllableFieldName = keyof typeof CONTROLLABLE_FIELDS;

/**
 * Value type for a registered field, looked up off `IrisGridState`.
 */
export type ControllableFieldValue<K extends ControllableFieldName> =
  IrisGridState[K];

/**
 * The "model" and "theme" fields from `IrisGridStateOverride` are NOT
 * in the registry — see the by-reference handle docs above. Plugins
 * that need a custom model use `IrisGridPanel.modelFactory` instead of
 * mutating state.
 */
export const CONTROLLABLE_HANDLE_FIELDS = ['model', 'theme'] as const;
export type ControllableHandleField =
  (typeof CONTROLLABLE_HANDLE_FIELDS)[number];

/**
 * Iterable list of specs. Useful for the conformance test.
 */
export const CONTROLLABLE_FIELD_LIST: readonly ControllableFieldSpec[] =
  Object.values(CONTROLLABLE_FIELDS) as readonly ControllableFieldSpec[];

/**
 * Granular state-change event emitted by `IrisGrid.onStateDidChange`.
 * Distinct from the legacy `onStateChange` callback (which fires the
 * full `IrisGridState` snapshot after every change). Consumers should
 * prefer this event.
 */
export interface IrisGridStateChange<
  K extends ControllableFieldName = ControllableFieldName,
> {
  readonly field: K;
  readonly value: ControllableFieldValue<K>;
  readonly prev: ControllableFieldValue<K>;
  readonly source: ControllableSource;
  /**
   * Lazy snapshot of the full `IrisGridState` after the change. Avoid
   * calling unless you really need the whole shape — the underlying
   * snapshot is built on demand.
   */
  snapshot(): Readonly<IrisGridState>;
}

/**
 * Listener signature for `onStateDidChange`.
 */
export type IrisGridStateChangeListener = (change: IrisGridStateChange) => void;
