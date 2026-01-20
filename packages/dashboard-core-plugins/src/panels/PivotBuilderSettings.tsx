import React, { useState, useCallback } from 'react';
import type { PivotBuilderSettings } from './PivotBuilderUtils';
import './PivotBuilderSettings.scss';

export interface PivotBuilderSettingsProps {
  onApply?: (settings: PivotBuilderSettings) => void;
}

/**
 * PivotBuilderSettings - A settings page component for configuring pivot table settings
 *
 * This is an example implementation showing how to handle custom table options
 * from the IrisGrid extensibility system. Renders as an inline settings page with
 * empty placeholder sections for Rows, Columns, Values, and Aggregations.
 *
 * Can be used as a custom renderer for table options:
 *
 * const pivotBuilderOption = {
 *   type: 'PIVOT_BUILDER',
 *   title: 'Pivot Builder',
 *   renderComponent: PivotBuilderSettings,
 *   isCustomRendered: true,
 * };
 */
export function PivotBuilderSettings({
  onApply,
}: PivotBuilderSettingsProps): JSX.Element {
  const [settings] = useState<PivotBuilderSettings>({
    rows: [],
    columns: [],
    values: [],
    aggregations: {},
  });

  const handleApply = useCallback((): void => {
    onApply?.(settings);
  }, [settings, onApply]);

  return (
    <div className="pivot-builder-settings">
      <div className="pivot-builder-header">
        <p className="pivot-builder-title">Pivot Builder Settings</p>
        <p className="pivot-builder-subtitle">
          Configure rows, columns, values, and aggregation functions for your
          pivot table.
        </p>
      </div>

      <div className="pivot-builder-sections">
        <div className="pivot-builder-section">
          <h3 className="section-title">Rows</h3>
          <p className="section-description">
            Drop columns here to group by rows
          </p>
        </div>

        <div className="pivot-builder-section">
          <h3 className="section-title">Columns</h3>
          <p className="section-description">
            Drop columns here to group by columns
          </p>
        </div>

        <div className="pivot-builder-section">
          <h3 className="section-title">Values</h3>
          <p className="section-description">
            Drop columns here to compute values
          </p>
        </div>

        <div className="pivot-builder-section">
          <h3 className="section-title">Aggregations</h3>
          <p className="section-description">Configure aggregation functions</p>
        </div>
      </div>

      <div className="pivot-builder-actions">
        <button
          type="button"
          className="pivot-builder-apply-button"
          onClick={handleApply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
