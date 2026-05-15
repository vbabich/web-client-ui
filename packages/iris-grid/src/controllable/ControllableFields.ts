import type {
  AdvancedFilterMap,
  ColumnName,
  OptionItem,
  QuickFilterMap,
  ReadonlyAdvancedFilterMap,
  ReadonlyQuickFilterMap,
} from '../CommonTypes';
import type { SidebarFormattingRule } from '../sidebar/conditional-formatting/ConditionalFormattingUtils';
import type { UIRollupConfig } from '../sidebar';
import type { AggregationSettings } from '../sidebar/aggregations/AggregationUtils';
import type { ColumnHeaderGroup } from '../ColumnHeaderGroup';
import type { MoveOperation, SortDescriptor } from '@deephaven/jsapi-utils';
import type { FormattingRule } from '../sidebar/conditional-formatting/ConditionalFormattingUtils';
import type { PartitionConfig } from '../PartitionedGridModel';

/**
 * Source of a state mutation — lets consumers distinguish their own writes
 * from internal user-driven changes without diffing all fields.
 */
export type ControllableSource = 'user' | 'external';

/**
 * Categories for grouping controllable fields in documentation and tooling.
 */
export type ControllableFieldCategory =
  | 'filter'
  | 'sort'
  | 'structure'
  | 'rollup'
  | 'format'
  | 'view';

/**
 * Metadata for a single controllable field in the registry.
 *
 * @template K The key of the field in `IrisGridState`.
 */
export interface ControllableFieldMeta<K extends string = string> {
  /** The key in `IrisGridState`. */
  name: K;

  /** Grouping category for documentation / tooling. */
  category: ControllableFieldCategory;

  /**
   * Whether mutating this field may trigger a model swap
   * (e.g. applying a rollup replaces the model).
   */
  triggersModelSwap: boolean;

  /**
   * The name of the `IrisGridProps` initializer prop, if any.
   * `undefined` means the field is state-only (no prop counterpart).
   */
  propName?: string;

  /**
   * Name of the dehydrate helper in `IrisGridUtils` that serializes this
   * field for persistence, or `'identity'` if the value is already
   * JSON-serializable, or `'not-serializable'` if the field cannot be
   * round-tripped across the plugin boundary (e.g. `searchFilter` which
   * is a live `dh.FilterCondition` derived from other fields).
   */
  dehydrateCodec: string;

  /**
   * `true` if this field is derived from other fields and should be
   * treated as read-only in the controllable API (e.g. `searchFilter`
   * is computed from `searchValue`, `selectedSearchColumns`, etc.).
   */
  derived?: boolean;
}

/**
 * Union of all state field names tracked by the controllable registry.
 *
 * Each entry has a corresponding `ControllableFieldMeta` in
 * `CONTROLLABLE_FIELDS`.
 */
export type ControllableFieldName =
  // filter
  | 'isFilterBarShown'
  | 'quickFilters'
  | 'advancedFilters'
  | 'showSearchBar'
  | 'searchValue'
  | 'selectedSearchColumns'
  | 'invertSearchColumns'
  | 'searchFilter'
  // sort
  | 'sorts'
  | 'reverse'
  // structure
  | 'customColumns'
  | 'movedColumns'
  | 'movedRows'
  | 'frozenColumns'
  | 'columnHeaderGroups'
  | 'selectDistinctColumns'
  // rollup
  | 'rollupConfig'
  | 'aggregationSettings'
  // format
  | 'customColumnFormatMap'
  | 'columnAlignmentMap'
  | 'conditionalFormats'
  // view
  | 'isMenuShown'
  | 'openOptions'
  | 'partitionConfig';

/**
 * The master registry of controllable fields.
 *
 * Each entry documents one `IrisGridState` field that external consumers
 * (plugins, overrides, the future imperative ref / controlled-component
 * API) are allowed to read and/or write.
 *
 * Fields **not** listed here are explicitly excluded:
 * - **Selection ranges** (`selectedRanges`) — owned by the grid interaction
 *   layer; not meaningful for external control.
 * - **Pending edits** (`pendingDataMap`, `pendingDataErrors`,
 *   `pendingSavePromise`, `pendingSaveError`, `pendingRowCount`) — write
 *   path is transactional and not suitable for the apply/override model.
 * - **Sidebar-only scratch state** (`conditionalFormatEditIndex`,
 *   `conditionalFormatPreview`, `selectedAggregation`, `rollupSelectedColumns`) — owned
 *   by individual sidebar page components; a replacement plugin owns its
 *   own scratch state.
 * - **GotoRow draft state** (`gotoRow`, `gotoRowError`, `gotoValue`,
 *   `gotoValueError`, `gotoValueSelectedColumnName`,
 *   `gotoValueSelectedFilter`, `gotoValueManuallyChanged`, `isGotoShown`)
 *   — transient form state for the built-in Go to page.
 * - **Download progress** (`isTableDownloading`, `tableDownloadStatus`,
 *   `tableDownloadProgress`, `tableDownloadEstimatedTime`) — transient
 *   progress owned by the download flow.
 * - **UI transient** (`shownAdvancedFilter`, `hoverAdvancedFilter`,
 *   `shownColumnTooltip`, `hoverSelectColumn`, `focusedFilterBarColumn`,
 *   `isSelectingPartition`, `metricCalculator`, `metrics`,
 *   `copyOperation`, `loadingText`, `loadingScrimProgress`,
 *   `loadingSpinnerShown`, `loadingCancelShown`, `loadingBlocksGrid`,
 *   `isReady`, `toastMessage`, `showOverflowModal`, `overflowText`,
 *   `overflowButtonTooltipProps`, `expandCellTooltipProps`,
 *   `expandTooltipDisplayValue`, `hoverTooltipProps`,
 *   `hoverDisplayValue`, `showNoPastePermissionModal`,
 *   `noPastePermissionError`, `formatter`) — internal rendering /
 *   interaction state.
 */
export const CONTROLLABLE_FIELDS: ReadonlyMap<
  ControllableFieldName,
  ControllableFieldMeta<ControllableFieldName>
> = new Map<
  ControllableFieldName,
  ControllableFieldMeta<ControllableFieldName>
>(
  [
    // ─── filter ───────────────────────────────────────────────────
    {
      name: 'isFilterBarShown',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'isFilterBarShown',
      dehydrateCodec: 'identity',
    },
    {
      name: 'quickFilters',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'quickFilters',
      dehydrateCodec: 'dehydrateQuickFilters',
    },
    {
      name: 'advancedFilters',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'advancedFilters',
      dehydrateCodec: 'dehydrateAdvancedFilters',
    },
    {
      name: 'showSearchBar',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'showSearchBar',
      dehydrateCodec: 'identity',
    },
    {
      name: 'searchValue',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'searchValue',
      dehydrateCodec: 'identity',
    },
    {
      name: 'selectedSearchColumns',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'selectedSearchColumns',
      dehydrateCodec: 'identity',
    },
    {
      name: 'invertSearchColumns',
      category: 'filter',
      triggersModelSwap: false,
      propName: 'invertSearchColumns',
      dehydrateCodec: 'identity',
    },
    {
      name: 'searchFilter',
      category: 'filter',
      triggersModelSwap: false,
      dehydrateCodec: 'not-serializable',
      derived: true,
    },
    // ─── sort ─────────────────────────────────────────────────────
    {
      name: 'sorts',
      category: 'sort',
      triggersModelSwap: false,
      propName: 'sorts',
      dehydrateCodec: 'dehydrateSort',
    },
    {
      name: 'reverse',
      category: 'sort',
      triggersModelSwap: false,
      propName: 'reverse',
      dehydrateCodec: 'identity',
    },
    // ─── structure ────────────────────────────────────────────────
    {
      name: 'customColumns',
      category: 'structure',
      triggersModelSwap: true,
      propName: 'customColumns',
      dehydrateCodec: 'identity',
    },
    {
      name: 'movedColumns',
      category: 'structure',
      triggersModelSwap: false,
      propName: 'movedColumns',
      dehydrateCodec: 'identity',
    },
    {
      name: 'movedRows',
      category: 'structure',
      triggersModelSwap: false,
      propName: 'movedRows',
      dehydrateCodec: 'identity',
    },
    {
      name: 'frozenColumns',
      category: 'structure',
      triggersModelSwap: false,
      propName: 'frozenColumns',
      dehydrateCodec: 'identity',
    },
    {
      name: 'columnHeaderGroups',
      category: 'structure',
      triggersModelSwap: false,
      propName: 'columnHeaderGroups',
      dehydrateCodec: 'identity',
    },
    {
      name: 'selectDistinctColumns',
      category: 'structure',
      triggersModelSwap: true,
      propName: 'selectDistinctColumns',
      dehydrateCodec: 'identity',
    },
    // ─── rollup ───────────────────────────────────────────────────
    {
      name: 'rollupConfig',
      category: 'rollup',
      triggersModelSwap: true,
      propName: 'rollupConfig',
      dehydrateCodec: 'identity',
    },
    {
      name: 'aggregationSettings',
      category: 'rollup',
      triggersModelSwap: false,
      propName: 'aggregationSettings',
      dehydrateCodec: 'identity',
    },
    // ─── format ───────────────────────────────────────────────────
    {
      name: 'customColumnFormatMap',
      category: 'format',
      triggersModelSwap: false,
      propName: 'customColumnFormatMap',
      dehydrateCodec: 'identity',
    },
    {
      name: 'columnAlignmentMap',
      category: 'format',
      triggersModelSwap: false,
      propName: 'columnAlignmentMap',
      dehydrateCodec: 'identity',
    },
    {
      name: 'conditionalFormats',
      category: 'format',
      triggersModelSwap: false,
      propName: 'conditionalFormats',
      dehydrateCodec: 'identity',
    },
    // ─── view ─────────────────────────────────────────────────────
    {
      name: 'isMenuShown',
      category: 'view',
      triggersModelSwap: false,
      dehydrateCodec: 'identity',
    },
    {
      name: 'openOptions',
      category: 'view',
      triggersModelSwap: false,
      dehydrateCodec: 'identity',
    },
    {
      name: 'partitionConfig',
      category: 'view',
      triggersModelSwap: false,
      propName: 'partitionConfig',
      dehydrateCodec: 'dehydratePartitionConfig',
    },
  ].map(field => [field.name, field])
);

/**
 * The change payload emitted by `onStateDidChange` for a single field.
 */
export interface IrisGridStateChange<
  K extends ControllableFieldName = ControllableFieldName,
> {
  /** Which registered field changed. */
  field: K;
  /** The new value. */
  value: unknown;
  /** The previous value. */
  prev: unknown;
  /** Who triggered the change. */
  source: ControllableSource;
  /** Lazy getter for the full `IrisGridState` snapshot at the time of change. */
  getSnapshot: () => Readonly<Record<string, unknown>>;
}
