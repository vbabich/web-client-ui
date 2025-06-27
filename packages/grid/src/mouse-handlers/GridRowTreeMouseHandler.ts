/* eslint class-methods-use-this: "off" */
import { getOrThrow } from '@deephaven/utils';
import { type EventHandlerResult } from '../EventHandlerResult';
import type Grid from '../Grid';
import GridMouseHandler from '../GridMouseHandler';
import GridUtils, { type GridPoint } from '../GridUtils';

const log = console;

/**
 * Detect when the tree expand/collapse button is clicked
 */
class GridRowTreeMouseHandler extends GridMouseHandler {
  static isInExpandableRowBox(gridPoint: GridPoint, grid: Grid): boolean {
    const { column, row, x, y } = gridPoint;
    const { metrics } = grid;
    if (!metrics) throw new Error('metrics not set');

    const {
      gridX,
      gridY,
      firstColumn,
      allColumnXs,
      allColumnWidths,
      allRowHeights,
      allRowYs,
      visibleRowTreeBoxes,
    } = metrics;

    if (
      column === firstColumn &&
      row != null &&
      visibleRowTreeBoxes.get(row) != null &&
      x > gridX &&
      y > gridY
    ) {
      const columnX = getOrThrow(allColumnXs, column);
      const width = getOrThrow(allColumnWidths, column);
      const rowY = getOrThrow(allRowYs, row);
      const height = getOrThrow(allRowHeights, row);
      if (
        x >= gridX + columnX &&
        x <= gridX + columnX + width &&
        y >= gridY + rowY &&
        y <= gridY + rowY + height
      ) {
        return true;
      }
    }
    return false;
  }

  static isInExpandableColumnBox(gridPoint: GridPoint, grid: Grid): boolean {
    const { column, row, x, y } = gridPoint;
    const { metrics } = grid;
    if (!metrics) throw new Error('metrics not set');

    const {
      gridX,
      gridY,
      firstRow,
      allColumnXs,
      allColumnWidths,
      allRowHeights,
      allRowYs,
      visibleColumnTreeBoxes,
    } = metrics;

    if (
      row === firstRow &&
      column != null &&
      visibleColumnTreeBoxes.get(column) != null &&
      x > gridX &&
      y > gridY
    ) {
      const columnX = getOrThrow(allColumnXs, column);
      const width = getOrThrow(allColumnWidths, column);
      const rowY = getOrThrow(allRowYs, row);
      const height = getOrThrow(allRowHeights, row);
      if (
        x >= gridX + columnX &&
        x <= gridX + columnX + width &&
        y >= gridY + rowY &&
        y <= gridY + rowY + height
      ) {
        return true;
      }
    }
    return false;
  }

  onDown(gridPoint: GridPoint, grid: Grid): EventHandlerResult {
    return GridRowTreeMouseHandler.isInExpandableRowBox(gridPoint, grid);
  }

  onClick(
    gridPoint: GridPoint,
    grid: Grid,
    event: React.MouseEvent
  ): EventHandlerResult {
    log.debug('GridRowTreeMouseHandler.onClick', 'gridPoint', gridPoint);
    if (GridRowTreeMouseHandler.isInExpandableRowBox(gridPoint, grid)) {
      const { row } = gridPoint;
      if (row !== null) {
        grid.toggleRowExpanded(row, GridUtils.isModifierKeyDown(event));
        return true;
      }
    }
    if (GridRowTreeMouseHandler.isInExpandableColumnBox(gridPoint, grid)) {
      const { column } = gridPoint;
      if (column !== null) {
        grid.toggleColumnExpanded(column, GridUtils.isModifierKeyDown(event));
        return true;
      }
    }
    return false;
  }
}

export default GridRowTreeMouseHandler;
