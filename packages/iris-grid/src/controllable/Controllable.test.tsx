/**
 * Phase 0 conformance suite for the controllable-IrisGrid framework.
 * See `plans/controllable-iris-grid-state.md` (DH-21476) for context.
 *
 * Asserts (a) the registry is well-formed, (b) the canonical
 * `applyState` pipe fans changes out to `onStateDidChange` and to the
 * `IrisGridControlContext` listener bus, (c) external writes via the
 * context handle are correctly source-tagged, and (d) every codec
 * spec resolves to a real helper on `IrisGridUtils`, plus a
 * `dehydrateIrisGridState` / `hydrateIrisGridState` round-trip on a
 * representative state to guard the by-reference formatter / model
 * decision.
 */
import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import dh from '@deephaven/jsapi-shim';
import { DateUtils, type Settings } from '@deephaven/jsapi-utils';
import IrisGrid from '../IrisGrid';
import IrisGridTestUtils from '../IrisGridTestUtils';
import IrisGridUtils, { type DehydratedIrisGridState } from '../IrisGridUtils';
import {
  CONTROLLABLE_FIELDS,
  CONTROLLABLE_FIELD_LIST,
  CONTROLLABLE_HANDLE_FIELDS,
  type ControllableFieldName,
  type IrisGridControlHandle,
  type IrisGridStateChange,
} from './index';

const VIEW_SIZE = 500;

const DEFAULT_SETTINGS: Settings = {
  timeZone: 'America/New_York',
  defaultDateTimeFormat: DateUtils.FULL_DATE_FORMAT,
  showTimeZone: false,
  showTSeparator: true,
  formatter: [],
  truncateNumbersWithPound: false,
};

const irisGridTestUtils = new IrisGridTestUtils(dh);

jest
  .spyOn(Element.prototype, 'getBoundingClientRect')
  .mockReturnValue(new DOMRect(0, 0, VIEW_SIZE, VIEW_SIZE));
jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_SIZE);
jest.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(VIEW_SIZE);

function makeGrid(
  extraProps: Partial<React.ComponentProps<typeof IrisGrid>> = {}
) {
  const model = irisGridTestUtils.makeModel();
  let ref: React.RefObject<IrisGrid>;

  function GridWithRef() {
    ref = useRef<IrisGrid>(null);
    return (
      <IrisGrid
        model={model}
        settings={DEFAULT_SETTINGS}
        ref={ref}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...extraProps}
      />
    );
  }
  render(<GridWithRef />);
  const grid = ref!.current!;
  // The control handle delivered through IrisGridControlContext is the
  // same object returned by `getControlHandle()`. Call it directly so
  // the test does not depend on having a ContextConsumer descendant.
  const getHandle = (): IrisGridControlHandle =>
    (
      grid as unknown as { getControlHandle: () => IrisGridControlHandle }
    ).getControlHandle();
  return { grid, model, getHandle };
}

describe('Controllable IrisGrid registry', () => {
  it('registers every spec under its own name', () => {
    for (const spec of CONTROLLABLE_FIELD_LIST) {
      expect(CONTROLLABLE_FIELDS[spec.name]).toBe(spec);
    }
  });

  it('uses one of the documented categories', () => {
    const allowed = new Set([
      'filter',
      'sort',
      'structure',
      'rollup',
      'format',
      'view',
      'sidebar',
    ]);
    for (const spec of CONTROLLABLE_FIELD_LIST) {
      expect(allowed.has(spec.category)).toBe(true);
    }
  });

  it('excludes selection / pending-edit / scratch / download fields', () => {
    const excluded: ControllableFieldName[] = [
      // selection
      'selectedRanges',
      // pending edits
      'pendingDataMap',
      'pendingDataErrors',
      'pendingSavePromise',
      'pendingSaveError',
      'pendingRowCount',
      // sidebar scratch
      'conditionalFormatEditIndex',
      'conditionalFormatPreview',
      'selectedAggregation',
      'gotoRow',
      'gotoValue',
      'gotoValueSelectedColumnName',
      'gotoValueSelectedFilter',
      'gotoValueManuallyChanged',
      'gotoRowError',
      'gotoValueError',
      // download progress
      'isTableDownloading',
      'tableDownloadStatus',
      'tableDownloadProgress',
      'tableDownloadEstimatedTime',
    ] as ControllableFieldName[];
    for (const name of excluded) {
      expect(CONTROLLABLE_FIELDS[name]).toBeUndefined();
    }
  });

  it('marks the by-reference handle fields without registering them', () => {
    expect(CONTROLLABLE_HANDLE_FIELDS).toEqual(['model', 'theme']);
    for (const name of CONTROLLABLE_HANDLE_FIELDS) {
      expect(
        (CONTROLLABLE_FIELDS as Record<string, unknown>)[name]
      ).toBeUndefined();
    }
  });

  it('resolves every codec helper name on IrisGridUtils', () => {
    const utils = new IrisGridUtils(dh);
    for (const spec of CONTROLLABLE_FIELD_LIST) {
      if (spec.serialization.kind !== 'codec') continue;
      const { dehydrate, hydrate } = spec.serialization;
      for (const ref of [dehydrate, hydrate]) {
        const [holder, member] = ref.includes('#')
          ? ref.split('#')
          : ref.split('.');
        expect(holder).toBe('IrisGridUtils');
        const target = ref.includes('#')
          ? (utils as unknown as Record<string, unknown>)[member]
          : (IrisGridUtils as unknown as Record<string, unknown>)[member];
        expect(typeof target).toBe('function');
      }
    }
  });

  it('marks formatter and model as by-reference handles only', () => {
    expect(CONTROLLABLE_FIELDS.formatter.serialization.kind).toBe('handle');
    expect(
      (CONTROLLABLE_FIELDS as Record<string, unknown>).model
    ).toBeUndefined();
  });
});

describe('IrisGrid.applyState pipe', () => {
  it('updates state and fires onStateDidChange tagged with source=internal', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });

    act(() => {
      grid.applyState('isFilterBarShown', true);
    });

    expect(grid.state.isFilterBarShown).toBe(true);
    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('isFilterBarShown');
    expect(change.value).toBe(true);
    expect(change.prev).toBe(false);
    expect(change.source).toBe('internal');
    expect(change.snapshot().isFilterBarShown).toBe(true);
  });

  it('warns but still applies for unregistered fields', () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    try {
      const { grid } = makeGrid();
      act(() => {
        // Bypass type-check: this is the runtime guard we want to test.
        (
          grid as unknown as { applyState: (...a: unknown[]) => void }
        ).applyState('selectedRanges', [], 'internal');
      });
      // The state update still happens via setState.
      expect(grid.state.selectedRanges).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('routes the public `reverse()` handler through applyState', () => {
    const { grid } = makeGrid();
    // Stub applyState so the model updater (which would call
    // `dh.Table.reverse`, not present on the mock) never sees a state
    // change. We only need to assert the migration target was called.
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation(() => undefined);

    act(() => {
      grid.reverse(true);
    });

    expect(spy).toHaveBeenCalledWith('reverse', true);
  });

  it('routes the public `updateSorts()` handler through applyState', () => {
    const { grid } = makeGrid();
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation(() => undefined);
    const nextSorts: never[] = [];

    act(() => {
      grid.updateSorts(nextSorts);
    });

    expect(spy).toHaveBeenCalledWith('sorts', nextSorts);
  });

  /**
   * Handler-gesture tests for the Phase 0.1 migration. Each test invokes
   * the public handler exactly once and asserts the migrated registered
   * field flows through `onStateDidChange` with `source: 'internal'`.
   *
   * For handlers that cascade into the model updater (e.g. `sortColumn`,
   * `reverse`, `handlePartitionChange`) the mock `dh` lacks the matching
   * Table method, so we fall back to spying on `applyState` and asserting
   * the migration boundary was hit with the right `(field, value)`.
   */

  it('handleFrozenColumnsChanged fires onStateDidChange', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });
    const next: readonly string[] = ['Col1'];

    act(() => {
      grid.handleFrozenColumnsChanged(next);
    });

    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('frozenColumns');
    expect(change.value).toBe(next);
    expect(change.source).toBe('internal');
  });

  it('setAdvancedFilterMap fires onStateDidChange', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });
    const next = new Map();

    act(() => {
      grid.setAdvancedFilterMap(next);
    });

    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('advancedFilters');
    expect(change.value).toBe(next);
    expect(change.source).toBe('internal');
  });

  it('handleConditionalFormatsChange fires onStateDidChange', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });
    const next: never[] = [];

    act(() => {
      grid.handleConditionalFormatsChange(next);
    });

    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('conditionalFormats');
    expect(change.value).toBe(next);
    expect(change.source).toBe('internal');
  });

  it('handleMovedColumnsChanged routes through applyState with callback', () => {
    // IrisGrid lifecycle (componentDidUpdate) re-emits movedColumns when
    // it changes, so the real onStateDidChange fires more than once.
    // Spy on the migration boundary instead.
    const { grid } = makeGrid();
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation((_field, _value, _source, cb) => cb?.());
    const next: never[] = [];
    const callback = jest.fn();

    act(() => {
      grid.handleMovedColumnsChanged(next, callback);
    });

    expect(spy).toHaveBeenCalledWith(
      'movedColumns',
      next,
      'internal',
      callback
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('clearAllAggregations fires onStateDidChange for aggregationSettings', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });

    act(() => {
      grid.clearAllAggregations();
    });

    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('aggregationSettings');
    expect(change.source).toBe('internal');
  });

  it('handleGotoRowOpened notifies isGotoShown via the escape-hatch', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });

    act(() => {
      grid.handleGotoRowOpened();
    });

    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('isGotoShown');
    expect(change.value).toBe(true);
    expect(change.prev).toBe(false);
    expect(change.source).toBe('internal');
  });

  it('handleGotoRowClosed notifies isGotoShown via the escape-hatch', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });
    // Open first so prev=true, value=false is meaningful.
    act(() => {
      grid.handleGotoRowOpened();
    });
    onStateDidChange.mockClear();

    act(() => {
      grid.handleGotoRowClosed();
    });

    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('isGotoShown');
    expect(change.value).toBe(false);
    expect(change.prev).toBe(true);
    expect(change.source).toBe('internal');
  });

  // Spy-fallback tests: handlers whose downstream effects (model updater,
  // grid ref access) would crash on the test mock.

  it('handleAggregationsChange routes through applyState', () => {
    const { grid } = makeGrid();
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation(() => undefined);
    const next = { aggregations: [], showOnTop: false };

    act(() => {
      grid.handleAggregationsChange(next);
    });

    expect(spy).toHaveBeenCalledWith('aggregationSettings', next);
  });

  it('handlePartitionChange routes through applyState', () => {
    const { grid } = makeGrid();
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation(() => undefined);
    const next = { mode: 'partition', partitions: [] } as never;

    act(() => {
      grid.handlePartitionChange(next);
    });

    expect(spy).toHaveBeenCalledWith('partitionConfig', next);
  });

  it('sortColumn routes through applyState', () => {
    const { grid } = makeGrid();
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation(() => undefined);

    act(() => {
      grid.sortColumn(0);
    });

    expect(spy).toHaveBeenCalledWith('sorts', expect.any(Array));
  });

  it('toggleFilterBar routes through applyState', () => {
    const { grid } = makeGrid();
    const spy = jest
      .spyOn(grid, 'applyState')
      .mockImplementation(() => undefined);

    act(() => {
      grid.toggleFilterBar();
    });

    expect(spy).toHaveBeenCalledWith('isFilterBarShown', expect.any(Boolean));
  });
});

describe('IrisGridControlContext', () => {
  it('exposes a stable handle to descendants', () => {
    const { grid, getHandle } = makeGrid();
    const handle = getHandle();
    expect(handle).not.toBeNull();
    expect(handle.get('isFilterBarShown')).toBe(false);
    expect(handle.getState().isFilterBarShown).toBe(false);
    // Handle identity is stable across renders.
    grid.forceUpdate();
    expect(getHandle()).toBe(handle);
  });

  it('apply tags the change as source=external', () => {
    const onStateDidChange = jest.fn();
    const { grid, getHandle } = makeGrid({ onStateDidChange });

    act(() => {
      getHandle().apply('isMenuShown', true);
    });

    expect(grid.state.isMenuShown).toBe(true);
    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.source).toBe('external');
    expect(change.field).toBe('isMenuShown');
  });

  it('subscribe receives every change; unsubscribe stops delivery', () => {
    const { grid, getHandle } = makeGrid();
    const listener = jest.fn();
    const unsubscribe = getHandle().subscribe(listener);

    act(() => {
      grid.applyState('isFilterBarShown', true);
      grid.applyState('isMenuShown', true);
    });

    expect(listener).toHaveBeenCalledTimes(2);
    const fields = listener.mock.calls.map(
      c => (c[0] as IrisGridStateChange).field
    );
    expect(fields).toEqual(['isFilterBarShown', 'isMenuShown']);

    unsubscribe();
    listener.mockClear();
    act(() => {
      grid.applyState('isFilterBarShown', false);
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribeField narrows to one field', () => {
    const { grid, getHandle } = makeGrid();
    const listener = jest.fn();
    getHandle().subscribeField('isMenuShown', listener);

    act(() => {
      grid.applyState('isFilterBarShown', true);
      grid.applyState('isMenuShown', true);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as IrisGridStateChange).field).toBe(
      'isMenuShown'
    );
  });

  it('sidebar handlers route through the pipe', () => {
    const onStateDidChange = jest.fn();
    const { grid } = makeGrid({ onStateDidChange });

    act(() => {
      grid.handleMenu({
        stopPropagation: () => undefined,
      } as unknown as React.MouseEvent<HTMLButtonElement>);
    });
    act(() => {
      grid.handleMenuClose();
    });

    const fieldOrder = onStateDidChange.mock.calls.map(
      c => (c[0] as IrisGridStateChange).field
    );
    // open → openOptions reset → close
    expect(fieldOrder).toEqual(['isMenuShown', 'openOptions', 'isMenuShown']);
  });
});

describe('Phase 0 dehydrate/hydrate round-trip', () => {
  it('round-trips IrisGrid.state through IrisGridUtils', () => {
    const { grid, model } = makeGrid();
    const utils = new IrisGridUtils(dh);

    const dehydrated = utils.dehydrateIrisGridState(model, grid.state);
    // Snapshot must be JSON-stringifiable per the framework plan.
    expect(() => JSON.stringify(dehydrated)).not.toThrow();
    const rehydrated = utils.hydrateIrisGridState(
      model,
      dehydrated as DehydratedIrisGridState
    );

    // Spot-check a handful of registered fields. Per-field exhaustive
    // coverage lives in IrisGridUtils.test.ts; this test guards that
    // the dehydrate→JSON→hydrate cycle works end-to-end with the
    // by-reference formatter / model decision.
    expect(rehydrated.isFilterBarShown).toBe(grid.state.isFilterBarShown);
    expect(rehydrated.reverse).toBe(grid.state.reverse);
    expect(rehydrated.searchValue).toBe(grid.state.searchValue);
    expect(rehydrated.invertSearchColumns).toBe(grid.state.invertSearchColumns);
    expect(rehydrated.sorts).toEqual(grid.state.sorts);
    expect(rehydrated.customColumns).toEqual(grid.state.customColumns);
  });
});
