/* eslint class-methods-use-this: "off" */
/* eslint no-unused-vars: "off" */
import MockGridModel from './MockGridModel';
import memoizeClear from './memoizeClear';
import type ExpandableGridModel from './ExpandableGridModel';
import { type ModelIndex } from './GridMetrics';

const log = console;

type ChildrenTreeMap = Map<ModelIndex, MockExpandableColumnGridModel>;

/**
 * A class to mock a tree model that supports both column and row expansion.
 * When a column/row is expanded, it creates a child model for that column/row, which can then make a child for those columns/rows, etc.
 */
class MockExpandableColumnGridModel
  extends MockGridModel
  implements ExpandableGridModel
{
  static DEFAULT_ROW_COUNT = 1000000000;

  static DEFAULT_COLUMN_COUNT = 100;

  static DEFAULT_CHILD_ROW_COUNT_FACTOR = 0.01;

  static DEFAULT_CHILD_COLUMN_COUNT_FACTOR = 0.01;

  static MIN_CHILD_ROW_COUNT = 10;

  static MIN_CHILD_COLUMN_COUNT = 10;

  static MAX_DEPTH = 10;

  private rowChildren: ChildrenTreeMap;

  private columnChildren: ChildrenTreeMap;

  private childRowCount: number;

  private childColumnCount: number;

  private maxDepth: number;

  constructor({
    rowCount = MockExpandableColumnGridModel.DEFAULT_ROW_COUNT,
    columnCount = MockExpandableColumnGridModel.DEFAULT_COLUMN_COUNT,
    rowChildren = new Map(),
    columnChildren = new Map(),
    childRowCount = Math.ceil(
      Math.max(
        MockExpandableColumnGridModel.MIN_CHILD_ROW_COUNT,
        rowCount * MockExpandableColumnGridModel.DEFAULT_CHILD_ROW_COUNT_FACTOR
      )
    ),
    childColumnCount = Math.ceil(
      Math.max(
        MockExpandableColumnGridModel.MIN_CHILD_COLUMN_COUNT,
        columnCount *
          MockExpandableColumnGridModel.DEFAULT_CHILD_COLUMN_COUNT_FACTOR
      )
    ),
    maxDepth = MockExpandableColumnGridModel.MAX_DEPTH,
  }: {
    rowChildren?: ChildrenTreeMap;
    columnChildren?: ChildrenTreeMap;
    columnCount?: number;
    rowCount?: number;
    childRowCount?: number;
    childColumnCount?: number;
    maxDepth?: number;
  } = {}) {
    super({ rowCount, columnCount });

    this.rowChildren = rowChildren;
    this.columnChildren = columnChildren;
    this.childRowCount = childRowCount;
    this.childColumnCount = childColumnCount;
    this.maxDepth = maxDepth;
  }

  textForNestedCell(
    column: ModelIndex,
    row: ModelIndex,
    columnIndex: ModelIndex | null,
    rowIndex: ModelIndex | null,
    nestedColumn: ModelIndex,
    nestedRow: ModelIndex
  ): string {
    const columnText =
      columnIndex != null ? `${columnIndex}.${nestedColumn}` : `${column}`;
    const rowText = rowIndex != null ? `${rowIndex}.${nestedRow}` : `${row}`;
    return `${columnText}, ${rowText}`;
  }

  textForCell(column: ModelIndex, row: ModelIndex): string {
    return this.getCachedTextForCell(
      this.columnChildren,
      this.rowChildren,
      column,
      row
    );
  }

  textForRowHeader(row: ModelIndex): string {
    return this.getCachedTextForRowHeader(this.rowChildren, row);
  }

  isRowMovable(row: ModelIndex): boolean {
    return false;
  }

  get hasExpandableRows(): boolean {
    return true;
  }

  get hasExpandableColumns(): boolean {
    return true;
  }

  get isExpandAllAvailable(): boolean {
    return false;
  }

  get isExpandAllRowsAvailable(): boolean {
    return false;
  }

  get isExpandAllColumnsAvailable(): boolean {
    return false;
  }

  isRowExpandable(row: ModelIndex): boolean {
    return this.getCachedIsRowExpandable(this.rowChildren, row, this.maxDepth);
  }

  isColumnExpandable(column: ModelIndex): boolean {
    return this.getCachedIsColumnExpandable(
      this.columnChildren,
      column,
      this.maxDepth
    );
  }

  isRowExpanded(row: ModelIndex): boolean {
    return this.getCachedIsRowExpanded(this.rowChildren, row);
  }

  isColumnExpanded(column: ModelIndex): boolean {
    return this.getCachedIsColumnExpanded(this.columnChildren, column);
  }

  setRowExpanded(
    row: ModelIndex,
    isExpanded: boolean,
    expandDescendants = false
  ): void {
    const { key, offsetRow } = this.getCachedModelRowOffset(
      this.rowChildren,
      row
    );

    // We always set a new map so that our memoize functions work properly
    const children = new Map(this.rowChildren);
    if (key != null) {
      const model = this.rowChildren.get(key);
      if (model !== undefined) {
        const { rowCount: originalChildRowCount } = model;
        model.setRowExpanded(offsetRow, isExpanded, expandDescendants);
        this.numRows += model.rowCount - originalChildRowCount;
      }
    } else if (!isExpanded) {
      const childModel = children.get(offsetRow);
      if (childModel !== undefined) {
        this.numRows -= childModel.rowCount;
        children.delete(offsetRow);
      }
    } else {
      const child = new MockExpandableColumnGridModel({
        rowCount: this.childRowCount,
        columnCount: this.numColumns,
      });
      children.set(offsetRow, child);
      this.numRows += child.rowCount;
    }

    this.rowChildren = children;
  }

  setColumnExpanded(
    column: ModelIndex,
    isExpanded: boolean,
    expandDescendants = false
  ): void {
    const { key, offsetColumn } = this.getCachedModelColumnOffset(
      this.columnChildren,
      column
    );

    // We always set a new map so that our memoize functions work properly
    const children = new Map(this.columnChildren);
    if (key != null) {
      const model = this.columnChildren.get(key);
      if (model !== undefined) {
        const { columnCount: originalChildColumnCount } = model;
        model.setColumnExpanded(offsetColumn, isExpanded, expandDescendants);
        this.numColumns += model.columnCount - originalChildColumnCount;
      }
    } else if (!isExpanded) {
      const childModel = children.get(offsetColumn);
      if (childModel !== undefined) {
        this.numColumns -= childModel.columnCount;
        children.delete(offsetColumn);
      }
    } else {
      const child = new MockExpandableColumnGridModel({
        rowCount: this.numRows,
        columnCount: this.childColumnCount,
      });
      children.set(offsetColumn, child);
      this.numColumns += child.columnCount;
    }

    this.columnChildren = children;
  }

  expandAll(): void {
    throw new Error('Expand all not implemented.');
  }

  collapseAll(): void {
    throw new Error('Collapse all not implemented.');
  }

  expandAllRows(): void {
    throw new Error('Expand all rows not implemented.');
  }

  collapseAllRows(): void {
    throw new Error('Collapse all rows not implemented.');
  }

  expandAllColumns(): void {
    throw new Error('Expand all columns not implemented.');
  }

  collapseAllColumns(): void {
    throw new Error('Collapse all columns not implemented.');
  }

  depthForRow(row: ModelIndex): number {
    return this.getCachedDepthForRow(this.rowChildren, row);
  }

  depthForColumn(column: ModelIndex): number {
    return this.getCachedDepthForColumn(this.columnChildren, column);
  }

  /**
   * Returns the map key and the offsetRow given the provided children and row index.
   * If the returned key is null, then this offset row is within this model.
   * Only returning the key instead of the model so that memoize doesn't cache a bunch of the children models after they've been deleted (collapsed).
   */
  getCachedModelRowOffset = memoizeClear(
    (
      children: ChildrenTreeMap,
      row: ModelIndex
    ): { key: ModelIndex | null; offsetRow: ModelIndex } => {
      let key = null;
      let offsetRow = row;
      // Need to iterate through the map in order... sort it first
      const sortedEntries = [...children].sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < sortedEntries.length; i += 1) {
        const [childRow, childModel] = sortedEntries[i];
        if (offsetRow <= childRow) {
          break;
        }
        const childRowCount = childModel.rowCount;
        if (offsetRow <= childRow + childRowCount) {
          key = childRow;
          offsetRow = offsetRow - childRow - 1;
          break;
        }
        offsetRow -= childRowCount;
      }

      return { key, offsetRow };
    },
    { max: 10000 }
  );

  getCachedModelColumnOffset = memoizeClear(
    (
      children: ChildrenTreeMap,
      column: ModelIndex
    ): { key: ModelIndex | null; offsetColumn: ModelIndex } => {
      let key = null;
      let offsetColumn = column;
      // Need to iterate through the map in order... sort it first
      const sortedEntries = [...children].sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < sortedEntries.length; i += 1) {
        const [childColumn, childModel] = sortedEntries[i];
        if (offsetColumn <= childColumn) {
          break;
        }
        const childColumnCount = childModel.columnCount;
        if (offsetColumn <= childColumn + childColumnCount) {
          key = childColumn;
          offsetColumn = offsetColumn - childColumn - 1;
          break;
        }
        offsetColumn -= childColumnCount;
      }

      return { key, offsetColumn };
    },
    { max: 10000 }
  );

  getCachedTextForRowHeader = memoizeClear(
    (children: ChildrenTreeMap, row: ModelIndex): string => {
      const { key, offsetRow } = this.getCachedModelRowOffset(children, row);

      if (key != null) {
        const model = children.get(key);
        if (model !== undefined) {
          return `${key}.${model.textForRowHeader(offsetRow)}`;
        }
      }

      return `${offsetRow}`;
    },
    { max: 10000 }
  );

  getCachedTextForCell = memoizeClear(
    (
      columnChildren: ChildrenTreeMap,
      rowChildren: ChildrenTreeMap,
      column: ModelIndex,
      row: ModelIndex
    ): string => {
      const { key: rowIndex, offsetRow } = this.getCachedModelRowOffset(
        rowChildren,
        row
      );
      const { key: columnIndex, offsetColumn } =
        this.getCachedModelColumnOffset(columnChildren, column);
      log.debug(
        'MockExpandableColumnGridModel.getCachedTextForCell',
        'columnIndex',
        columnIndex,
        'rowIndex',
        rowIndex,
        'offsetColumn',
        offsetColumn,
        'offsetRow',
        offsetRow
      );
      // if (rowIndex != null) {
      //   const rowModel = rowChildren.get(rowIndex);
      //   if (rowModel !== undefined) {
      //     if (columnIndex != null) {
      //       const columnModel = columnChildren.get(columnIndex);
      //       if (columnModel !== undefined) {
      //         return `${columnIndex}.${columnModel.textForCell(
      //           offsetColumn,
      //           offsetRow
      //         )}.${rowIndex}.${rowModel.textForCell(offsetColumn, offsetRow)}`;
      //       }
      //     } else {
      //       return `${rowIndex}.${rowModel.textForCell(
      //         offsetColumn,
      //         offsetRow
      //       )}`;
      //     }
      //   }
      // }

      if (rowIndex != null || columnIndex != null) {
        return this.textForNestedCell(
          column,
          row,
          columnIndex,
          rowIndex,
          offsetColumn,
          offsetRow
        );
      }

      // const rowText =
      //   rowIndex != null
      //     ? rowChildren.get(offsetRow)?.textForCell(offsetColumn, offsetRow) ??
      //       row
      //     : `${rowIndex}`;
      // const columnText = 'tmp';
      // columnChildren.has(offsetColumn)
      //   ? columnChildren
      //       .get(offsetColumn)
      //       ?.textForCell(offsetColumn, offsetRow) ?? ''
      //   : `${offsetColumn}`;

      // return `${columnText}, ${rowText}`;

      return `${offsetColumn},${offsetRow}`;
    },
    { max: 10000 }
  );

  getCachedIsRowExpandable = memoizeClear(
    (children: ChildrenTreeMap, row: ModelIndex, maxDepth: number): boolean => {
      const depth = this.getCachedDepthForRow(children, row);

      return depth < maxDepth;
    },
    { max: 10000 }
  );

  getCachedIsColumnExpandable = memoizeClear(
    (
      children: ChildrenTreeMap,
      column: ModelIndex,
      maxDepth: number
    ): boolean => {
      const depth = this.getCachedDepthForColumn(children, column);
      return depth < maxDepth;
    },
    { max: 10000 }
  );

  getCachedIsRowExpanded = memoizeClear(
    (children: ChildrenTreeMap, row: ModelIndex): boolean => {
      const { key, offsetRow } = this.getCachedModelRowOffset(children, row);

      if (key != null) {
        const model = children.get(key);
        if (model !== undefined) {
          return model.isRowExpanded(offsetRow);
        }
      }

      return children.has(offsetRow);
    },
    { max: 10000 }
  );

  getCachedIsColumnExpanded = memoizeClear(
    (children: ChildrenTreeMap, column: ModelIndex): boolean => {
      const { key, offsetColumn } = this.getCachedModelColumnOffset(
        children,
        column
      );

      if (key != null) {
        const model = children.get(key);
        if (model !== undefined) {
          return model.isColumnExpanded(offsetColumn);
        }
      }

      return children.has(offsetColumn);
    },
    { max: 10000 }
  );

  getCachedDepthForRow = memoizeClear(
    (children: ChildrenTreeMap, row: ModelIndex): number => {
      const { key, offsetRow } = this.getCachedModelRowOffset(children, row);

      if (key != null) {
        const model = children.get(key);
        if (model !== undefined) {
          return model.depthForRow(offsetRow) + 1;
        }
      }

      return 0;
    },
    { max: 10000 }
  );

  getCachedDepthForColumn = memoizeClear(
    (children: ChildrenTreeMap, column: ModelIndex): number => {
      const { key, offsetColumn } = this.getCachedModelColumnOffset(
        children,
        column
      );

      if (key != null) {
        const model = children.get(key);
        if (model !== undefined) {
          return model.depthForColumn(offsetColumn) + 1;
        }
      }

      return 0;
    },
    { max: 10000 }
  );
}

export default MockExpandableColumnGridModel;
