/**
 * Phase 0: React context exposing the controllable surface of an
 * `IrisGrid` instance to descendants. Both the imperative-ref branch
 * and the expanded-override branch will publish their public write
 * surface through this context, so consumers (`children` render slot,
 * `TablePluginProps`, etc.) get a stable shape regardless of which
 * branch wins.
 *
 * In Phase 0 the write surface is a single generic `apply(field,
 * value)` keyed off the registry. Subsequent branches MAY add more
 * specialized methods alongside it, but `apply` itself stays.
 */

import { createContext, useContext } from 'react';
import type { IrisGridState } from '../IrisGrid';
import type {
  ControllableFieldName,
  ControllableFieldValue,
  IrisGridStateChange,
  IrisGridStateChangeListener,
} from './ControllableFields';

/**
 * Public read/write/subscribe surface for the controllable fields of a
 * single `IrisGrid` instance.
 */
export interface IrisGridControlHandle {
  /**
   * Snapshot getter for the full `IrisGridState`. Fresh on each call.
   * Plugins should normally subscribe to deltas via `subscribe`
   * instead of polling this.
   */
  getState(): Readonly<IrisGridState>;

  /**
   * Read a single registered field.
   */
  get<K extends ControllableFieldName>(field: K): ControllableFieldValue<K>;

  /**
   * Drive a single registered field. Source is fixed to `'external'`
   * so internal mutators can distinguish plugin writes from user
   * gestures.
   *
   * Calling `apply` is semantically equivalent to the user performing
   * the corresponding gesture; the change flows through the same
   * canonical `applyState` pipe and fires `onStateDidChange`.
   */
  apply<K extends ControllableFieldName>(
    field: K,
    value: ControllableFieldValue<K>
  ): void;

  /**
   * Subscribe to granular `IrisGridStateChange` events. Returns an
   * unsubscribe function. The listener fires synchronously after the
   * underlying `setState` completes (i.e. inside the `setState`
   * callback), so it sees the new value via the `snapshot()` getter
   * rather than via React's render cycle.
   */
  subscribe(listener: IrisGridStateChangeListener): () => void;

  /**
   * Subscribe to a single field, with the change pre-narrowed to that
   * field's value type. Sugar over `subscribe`.
   */
  subscribeField<K extends ControllableFieldName>(
    field: K,
    listener: (change: IrisGridStateChange<K>) => void
  ): () => void;
}

/**
 * React context. `null` until an `IrisGrid` mounts and registers
 * itself. Consumers should treat `null` as "no controllable grid in
 * scope" rather than throwing — there are valid render paths
 * (snapshot tests, error fallbacks) where the context is unset.
 */
export const IrisGridControlContext =
  createContext<IrisGridControlHandle | null>(null);

IrisGridControlContext.displayName = 'IrisGridControlContext';

/**
 * Hook to read the current controllable handle. Returns `null` when
 * called outside an `IrisGrid` subtree.
 */
export function useIrisGridControl(): IrisGridControlHandle | null {
  return useContext(IrisGridControlContext);
}
