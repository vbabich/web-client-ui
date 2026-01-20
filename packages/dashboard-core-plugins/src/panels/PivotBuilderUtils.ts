import { useState } from 'react';

export interface PivotBuilderSettings {
  rows: string[];
  columns: string[];
  values: string[];
  aggregations: Record<string, string>;
}

export interface PivotBuilderDialogState {
  isOpen: boolean;
  onClose: () => void;
  open: () => void;
  close: () => void;
}

/**
 * Example hook for managing the Pivot Builder dialog state
 *
 * Example:
 * const pivotDialogState = usePivotBuilderDialog();
 *
 * // Open the dialog
 * pivotDialogState.open();
 *
 * // Close the dialog
 * pivotDialogState.close();
 *
 * // Use with JSX
 * <PivotBuilderDialog {...pivotDialogState} />
 */
export function usePivotBuilderDialog(): PivotBuilderDialogState {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    onClose: () => setIsOpen(false),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

/**
 * Example function to open the Pivot Builder dialog and handle the result
 *
 * This function demonstrates how to integrate the Pivot Builder dialog with
 * the custom table options system.
 *
 * Example:
 * // In your IrisGridPanel or custom component:
 * const pivotDialogState = usePivotBuilderDialog();
 *
 * const handleCustomTableOption = (option: OptionItem) => {
 *   if ((option as any).type === 'PIVOT_BUILDER') {
 *     openPivotBuilderDialog(pivotDialogState, option.customData);
 *   }
 * };
 */
export function openPivotBuilderDialog(
  dialogState: PivotBuilderDialogState,
  customData?: Record<string, unknown>
): void {
  // eslint-disable-next-line no-console
  console.log('Opening Pivot Builder dialog with custom data:', customData);

  // Open the dialog
  dialogState.open();

  // The dialog will render an empty settings page that can be extended
  // with actual pivot configuration UI
}
