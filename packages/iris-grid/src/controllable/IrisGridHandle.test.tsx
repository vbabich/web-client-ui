/**
 * Branch A spike (DH-21476): typed imperative handle on IrisGrid via
 * the regular class ref — NO `forwardRef` / `useImperativeHandle` /
 * wrapper component.
 *
 * Proves that `class IrisGrid implements IrisGridControlHandle` is
 * enough to give plugin authors a typed, narrowed surface. The ref
 * itself must still be typed as the class (`useRef<IrisGrid>`)
 * because React's `RefObject<T>` is covariant in `T` — you cannot
 * pass `RefObject<IrisGridControlHandle>` where `RefObject<IrisGrid>`
 * is expected. The narrowing happens at the use site: assign
 * `ref.current` (or pass it) into an `IrisGridControlHandle`-typed
 * slot. Plugin authors get the narrowed interface without the class
 * leaking past the boundary.
 *
 * Scope (intentionally tiny):
 *   - `apply(field, value)` routes through the external pipe and
 *     emits one `onStateDidChange` tagged `source: 'external'`.
 *   - `apply(patch)` batches multiple fields, emitting one event per
 *     changed field, all tagged `source: 'external'`.
 *   - `get` / `getState` / `subscribe` / `subscribeField` plumb
 *     verbatim from the Phase 0 implementation — now hoisted from
 *     the deleted `getControlHandle` closure to class instance
 *     methods.
 *
 * Out of scope for the spike: per-field typed setters (the production
 * plan can layer those onto the same interface later), the RPC
 * envelope type, and migrating in-tree class-ref consumers.
 */
import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import dh from '@deephaven/jsapi-shim';
import { DateUtils, type Settings } from '@deephaven/jsapi-utils';
import IrisGrid from '../IrisGrid';
import IrisGridTestUtils from '../IrisGridTestUtils';
import { type IrisGridControlHandle, type IrisGridStateChange } from './index';

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

/**
 * Mounts `<IrisGrid>` with a class-typed ref, then NARROWS it to the
 * public `IrisGridControlHandle` interface before handing it back to
 * the test. The narrowing assignment is the plugin-author-facing
 * boundary the spike is validating.
 */
function mountAsHandle(
  extraProps: Partial<React.ComponentProps<typeof IrisGrid>> = {}
) {
  const model = irisGridTestUtils.makeModel();
  // Ref slot MUST be typed as the class (RefObject<T> is covariant).
  // The interface narrowing happens at the use site below.
  let ref!: React.RefObject<IrisGrid>;
  function GridWithHandleRef() {
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
  render(<GridWithHandleRef />);
  // Narrow at the boundary: TS accepts this because IrisGrid
  // implements IrisGridControlHandle. Plugin authors expecting a
  // handle in their API would receive it via this same upcast.
  const handle: IrisGridControlHandle | null = ref.current;
  if (handle == null) {
    throw new Error('IrisGrid did not attach to the ref on mount');
  }
  return { model, handle };
}

describe('IrisGrid as IrisGridControlHandle (class ref, no wrapper)', () => {
  it('exposes the full handle surface directly on the class instance', () => {
    const { handle } = mountAsHandle();
    expect(typeof handle.apply).toBe('function');
    expect(typeof handle.get).toBe('function');
    expect(typeof handle.getState).toBe('function');
    expect(typeof handle.subscribe).toBe('function');
    expect(typeof handle.subscribeField).toBe('function');
  });

  // NOTE: avoid `reverse` / `sorts` here — those cascade through
  // `IrisGridModelUpdater` -> `model.dh.Table.reverse`, and the
  // mocked `dh` in this suite does not implement that method. Same
  // exclusion the Phase 0 conformance test makes for the same fields.
  it('routes apply(field, value) through the external pipe', () => {
    const onStateDidChange = jest.fn();
    const { handle } = mountAsHandle({ onStateDidChange });

    act(() => {
      handle.apply('isMenuShown', true);
    });

    expect(handle.get('isMenuShown')).toBe(true);
    expect(onStateDidChange).toHaveBeenCalledTimes(1);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('isMenuShown');
    expect(change.value).toBe(true);
    expect(change.source).toBe('external');
  });

  it('routes apply(field, value) for isFilterBarShown', () => {
    const onStateDidChange = jest.fn();
    const { handle } = mountAsHandle({ onStateDidChange });

    act(() => {
      handle.apply('isFilterBarShown', true);
    });

    expect(handle.get('isFilterBarShown')).toBe(true);
    const change = onStateDidChange.mock.calls[0][0] as IrisGridStateChange;
    expect(change.field).toBe('isFilterBarShown');
    expect(change.source).toBe('external');
  });
});

describe('IrisGridControlHandle batch apply(patch)', () => {
  it('emits one event per changed field, all tagged source=external', () => {
    const onStateDidChange = jest.fn();
    const { handle } = mountAsHandle({ onStateDidChange });

    act(() => {
      handle.apply({
        isFilterBarShown: true,
        showSearchBar: true,
      });
    });

    expect(handle.get('isFilterBarShown')).toBe(true);
    expect(handle.get('showSearchBar')).toBe(true);
    expect(onStateDidChange).toHaveBeenCalledTimes(2);

    const fields = onStateDidChange.mock.calls.map(
      ([change]: [IrisGridStateChange]) => change.field
    );
    expect(new Set(fields)).toEqual(
      new Set(['isFilterBarShown', 'showSearchBar'])
    );
    for (const call of onStateDidChange.mock.calls) {
      expect((call[0] as IrisGridStateChange).source).toBe('external');
    }
  });

  it('ignores an empty patch', () => {
    const onStateDidChange = jest.fn();
    const { handle } = mountAsHandle({ onStateDidChange });

    act(() => {
      handle.apply({});
    });

    expect(onStateDidChange).not.toHaveBeenCalled();
  });
});

describe('IrisGridControlHandle subscriptions', () => {
  it('subscribe fires for any changed field and unsubscribe stops it', () => {
    const { handle } = mountAsHandle();
    const listener = jest.fn();
    const unsubscribe = handle.subscribe(listener);

    act(() => {
      handle.apply('isMenuShown', true);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as IrisGridStateChange).field).toBe(
      'isMenuShown'
    );

    unsubscribe();
    act(() => {
      handle.apply('isFilterBarShown', true);
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribeField only fires for the named field', () => {
    const { handle } = mountAsHandle();
    const listener = jest.fn();
    const unsubscribe = handle.subscribeField('isMenuShown', listener);

    act(() => {
      handle.apply('isFilterBarShown', true);
    });
    expect(listener).not.toHaveBeenCalled();

    act(() => {
      handle.apply('isMenuShown', true);
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
