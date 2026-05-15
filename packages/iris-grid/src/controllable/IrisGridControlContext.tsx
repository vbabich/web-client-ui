import { createContext, useContext } from 'react';
import type { IrisGridState } from '../IrisGrid';
import type {
  ControllableFieldName,
  ControllableSource,
  IrisGridStateChange,
} from './ControllableFields';
import type IrisGridModel from '../IrisGridModel';

/**
 * Callback for subscribing to granular state changes.
 */
export type IrisGridControlSubscriber = (change: IrisGridStateChange) => void;

/**
 * The public API exposed to plugin children of IrisGrid via context.
 *
 * Provides read access to the current state, a generic `apply` mutator
 * for writing registered fields, and a `subscribe` primitive for
 * listening to granular changes.
 */
export interface IrisGridControlContextValue {
  /**
   * The current IrisGrid state (read-only snapshot).
   * Consumers should not mutate this object.
   */
  state: Readonly<IrisGridState>;

  /**
   * The IrisGridModel backing this grid instance.
   */
  model: IrisGridModel;

  /**
   * Apply a mutation to a registered controllable field.
   *
   * @param field The name of the field to mutate (must be in the registry).
   * @param value The new value for the field.
   * @param source Who is triggering the change — `'user'` for internal
   *   UI-driven changes, `'external'` for plugin / API-driven changes.
   */
  apply: (
    field: ControllableFieldName,
    value: unknown,
    source: ControllableSource
  ) => void;

  /**
   * Subscribe to granular state changes.
   *
   * @param callback Called after each registered field changes, with the
   *   change payload.
   * @returns An unsubscribe function.
   */
  subscribe: (callback: IrisGridControlSubscriber) => () => void;
}

/**
 * React context that exposes the controllable IrisGrid API to child
 * components (including `TablePlugin` children rendered in the grid bar).
 *
 * The context is provided by `IrisGrid` itself and is `null` when
 * consumed outside of an `IrisGrid` tree.
 */
export const IrisGridControlContext =
  createContext<IrisGridControlContextValue | null>(null);

IrisGridControlContext.displayName = 'IrisGridControlContext';

/**
 * Hook to consume the IrisGrid control context.
 *
 * @throws If used outside of an `<IrisGrid>` tree.
 */
export function useIrisGridControlContext(): IrisGridControlContextValue {
  const ctx = useContext(IrisGridControlContext);
  if (ctx == null) {
    throw new Error(
      'useIrisGridControlContext must be used within an <IrisGrid> component'
    );
  }
  return ctx;
}
