import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import { Button } from '@deephaven/components';
import Log from '@deephaven/log';
import {
  FormatColumnWhereIcon,
  FormatHeatMapIcon,
  FormatProgressBarIcon,
  FormatRowWhereIcon,
} from './icons';
import { TableUtils } from '..';

import './ConditionalFormattingEditor.scss';

const log = Log.module('ConditionalFormattingEditor');

export type ConditionalFormattingApplyCallback = (
  rule: FormattingRule,
  index?: number
) => void;

export type ConditionalFormattingCancelCallback = () => void;

export interface ModelColumn {
  name: string;
  type: string;
}

export enum FormatterType {
  CONDITIONAL = 'conditional',
  ADVANCED = 'advanced',
  PROGRESS = 'progress',
  HEATMAP = 'heatmap',
  ROWS = 'rows',
}

export enum NumberFormatCondition {
  IS_EQUAL = 'is-equal',
  IS_NOT_EQUAL = 'is-not-equal',
  IS_BETWEEN = 'is-between',
  GREATER_THAN = 'greater-than',
  GREATER_THAN_OR_EQUAL = 'greater-than-or-equal',
  LESS_THAN = 'less-than',
  LESS_THAN_OR_EQUAL = 'less-than-or-equal',
}

export enum StringFormatCondition {
  IS_EXACTLY = 'is-exactly',
  IS_NOT_EXACTLY = 'is-not-exactly',
  CONTAINS = 'contains',
  DOES_NOT_CONTAIN = 'does-not-contain',
  STARTS_WITH = 'starts-with',
  ENDS_WITH = 'ends-with',
}

export enum FormatStyleType {
  NO_FORMATTING = 'no-formatting',
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  WARN = 'warn',
  NEUTRAL = 'neutral',
  ACCENT_1 = 'accent-1',
  ACCENT_2 = 'accent-2',
  CUSTOM = 'custom',
}

export enum FormatPointType {
  AUTO = 'auto',
  NUMBER = 'number',
  MIN_VALUE = 'min-value',
  MAX_VALUE = 'max-value',
}

export enum ColorScaleType {
  STANDARD = 'standard',
  WARM = 'warm',
  COOL = 'cool',

  TRAFFIC = 'traffic',
  DIVERGING = 'diverging',

  COLORBLIND = 'colorblind',
  UNIQUE = 'unique',
}

export interface FormatStyleConfig {
  type: FormatStyleType;
  customConfig?: {
    foreground: string;
    background: string;
  };
}

export interface ConditionConfig {
  condition: NumberFormatCondition | StringFormatCondition;
  value?: string | number;
  start?: number;
  end?: number;
  style: FormatStyleConfig;
}

export interface AdvancedConditionConfig {
  condition: string;
  style: FormatStyleConfig;
}

export interface ProgressConfig {
  style: FormatStyleConfig;
  startType: FormatPointType;
  endType: FormatPointType;
  // Optional depending on point type
  start?: number;
  end?: number;
}

export interface ColorScaleConfig {
  // TODO: heatmap on non-number columns?
  // TODO: only show numeric columns in the selector?
  scale: ColorScaleType;
  startType: FormatPointType;
  // Optional depending on the scale
  midType?: FormatPointType;
  endType: FormatPointType;
  // Optional depending on point type
  start?: number;
  mid?: number;
  end?: number;
}

// Same fields as in ConditionConfig for now
export type RowsConfig = ConditionConfig;

export interface FormattingRule {
  type: FormatterType;
  column: ModelColumn;
  config:
    | ConditionConfig
    | AdvancedConditionConfig
    | ProgressConfig
    | ColorScaleConfig
    | RowsConfig;
}

export interface ConditionalFormattingEditorProps {
  columns: ModelColumn[];
  rule?: FormattingRule;
  id?: number;
  disableCancel?: boolean;
  onApply?: ConditionalFormattingApplyCallback;
  onCancel?: ConditionalFormattingCancelCallback;
}

const DEFAULT_CALLBACK = () => undefined;

// TODO: move to utils?
function getLabelForNumberCondition(condition: NumberFormatCondition): string {
  switch (condition) {
    case NumberFormatCondition.IS_EQUAL:
      return 'Is equal to';
    case NumberFormatCondition.IS_NOT_EQUAL:
      return 'Is not equal to';
    case NumberFormatCondition.IS_BETWEEN:
      return 'Is between';
    case NumberFormatCondition.GREATER_THAN:
      return 'Greater than';
    case NumberFormatCondition.GREATER_THAN_OR_EQUAL:
      return 'Greater than or equal to';
    case NumberFormatCondition.LESS_THAN:
      return 'Less than';
    case NumberFormatCondition.LESS_THAN_OR_EQUAL:
      return 'Less than or equal to';
  }
}

function getLabelForStringCondition(condition: StringFormatCondition): string {
  switch (condition) {
    case StringFormatCondition.IS_EXACTLY:
      return 'Is exactly';
    case StringFormatCondition.IS_NOT_EXACTLY:
      return 'Is not exactly';
    case StringFormatCondition.CONTAINS:
      return 'Contains';
    case StringFormatCondition.DOES_NOT_CONTAIN:
      return 'Does not contain';
    case StringFormatCondition.STARTS_WITH:
      return 'Starts with';
    case StringFormatCondition.ENDS_WITH:
      return 'Ends with';
  }
}

function getTextForNumberCondition(condition: NumberFormatCondition): string {
  switch (condition) {
    case NumberFormatCondition.IS_EQUAL:
      return '==';
    case NumberFormatCondition.IS_NOT_EQUAL:
      return '!=';
    case NumberFormatCondition.IS_BETWEEN:
      return '==';
    case NumberFormatCondition.GREATER_THAN:
      return '>';
    case NumberFormatCondition.GREATER_THAN_OR_EQUAL:
      return '>=';
    case NumberFormatCondition.LESS_THAN:
      return '<';
    case NumberFormatCondition.LESS_THAN_OR_EQUAL:
      return '<=';
  }
}

function getTextForStringCondition(condition: StringFormatCondition): string {
  switch (condition) {
    case StringFormatCondition.IS_EXACTLY:
      return '==';
    case StringFormatCondition.IS_NOT_EXACTLY:
      return '!=';
    // case StringFormatCondition.CONTAINS:
    //   return '==';
    // case StringFormatCondition.DOES_NOT_CONTAIN:
    //   return 'Does not contain';
    // case StringFormatCondition.STARTS_WITH:
    //   return 'Starts with';
    // case StringFormatCondition.ENDS_WITH:
    //   return 'Ends with';
    default:
      return '==';
  }
}

export function getTextForConditionType(
  columnType: string,
  condition: StringFormatCondition | NumberFormatCondition
): string {
  if (TableUtils.isNumberType(columnType)) {
    return getTextForNumberCondition(condition as NumberFormatCondition);
  }
  return getTextForStringCondition(condition as StringFormatCondition);
}

function getLabelForStyleType(option: FormatStyleType): string {
  switch (option) {
    case FormatStyleType.NO_FORMATTING:
      return 'No formatting';
    case FormatStyleType.POSITIVE:
      return 'Positive';
    case FormatStyleType.NEGATIVE:
      return 'Negative';
    case FormatStyleType.WARN:
      return 'Warn';
    case FormatStyleType.NEUTRAL:
      return 'Neutral';
    case FormatStyleType.ACCENT_1:
      return 'Accent 1';
    case FormatStyleType.ACCENT_2:
      return 'Accent 2';
    case FormatStyleType.CUSTOM:
      return 'Custom...';
  }
}

export function getColorForStyleType(option: FormatStyleType): string {
  switch (option) {
    case FormatStyleType.NO_FORMATTING:
      return 'null';
    case FormatStyleType.POSITIVE:
      return 'GREEN';
    case FormatStyleType.NEGATIVE:
      return 'RED';
    case FormatStyleType.WARN:
      return 'ORANGE';
    case FormatStyleType.NEUTRAL:
      return 'YELLOW';
    case FormatStyleType.ACCENT_1:
      return 'BLUE';
    case FormatStyleType.ACCENT_2:
      return 'PURPLE';
    case FormatStyleType.CUSTOM:
      return 'null';
    default:
      return 'null';
  }
}

function getFormatterTypeIcon(option: FormatterType): JSX.Element | undefined {
  switch (option) {
    case FormatterType.CONDITIONAL:
      return <FormatColumnWhereIcon />;
    case FormatterType.PROGRESS:
      return <FormatProgressBarIcon />;
    case FormatterType.HEATMAP:
      return <FormatHeatMapIcon />;
    case FormatterType.ROWS:
      return <FormatRowWhereIcon />;
  }
  return undefined;
}

function getFormatterTypeLabel(option: FormatterType): string {
  switch (option) {
    case FormatterType.CONDITIONAL:
      return 'Conditional';
    // TODO
    case FormatterType.ADVANCED:
      return 'Advanced';
    case FormatterType.PROGRESS:
      return 'Progress';
    case FormatterType.HEATMAP:
      return 'Color Scale';
    case FormatterType.ROWS:
      return 'Rows';
  }
}

const numberFormatConditionOptions = [
  NumberFormatCondition.IS_EQUAL,
  NumberFormatCondition.IS_NOT_EQUAL,
  NumberFormatCondition.IS_BETWEEN,
  NumberFormatCondition.GREATER_THAN,
  NumberFormatCondition.GREATER_THAN_OR_EQUAL,
  NumberFormatCondition.LESS_THAN,
  NumberFormatCondition.LESS_THAN_OR_EQUAL,
].map(option => (
  <option key={option} value={option}>
    {getLabelForNumberCondition(option)}
  </option>
));

const stringFormatConditions = [
  StringFormatCondition.IS_EXACTLY,
  StringFormatCondition.IS_NOT_EXACTLY,
  StringFormatCondition.CONTAINS,
  StringFormatCondition.DOES_NOT_CONTAIN,
  StringFormatCondition.STARTS_WITH,
  StringFormatCondition.ENDS_WITH,
].map(option => (
  <option key={option} value={option}>
    {getLabelForStringCondition(option)}
  </option>
));

const styleOptions = [
  FormatStyleType.NO_FORMATTING,
  FormatStyleType.POSITIVE,
  FormatStyleType.NEGATIVE,
  FormatStyleType.WARN,
  FormatStyleType.NEUTRAL,
  FormatStyleType.ACCENT_1,
  FormatStyleType.ACCENT_2,
  FormatStyleType.CUSTOM,
].map(option => (
  <option key={option} value={option}>
    {getLabelForStyleType(option)}
  </option>
));

const formatterTypes = [
  // TODO: advanced?
  FormatterType.CONDITIONAL,
  FormatterType.PROGRESS,
  FormatterType.HEATMAP,
  FormatterType.ROWS,
];

const ConditionalFormattingEditor = (
  props: ConditionalFormattingEditorProps
): JSX.Element => {
  const {
    columns,
    onApply = DEFAULT_CALLBACK,
    onCancel = DEFAULT_CALLBACK,
    id,
    disableCancel = false,
  } = props;

  const [selectedColumn, setColumn] = useState(() =>
    columns.length > 0 ? columns[0] : undefined
  );

  const [selectedFormatter, setFormatter] = useState(FormatterType.CONDITIONAL);

  // TODO: init?
  const [conditionValue, setConditionValue] = useState();
  const [selectedStyle, setStyle] = useState(FormatStyleType.NO_FORMATTING);

  const selectedColumnType = selectedColumn?.type;

  const conditions = useMemo(() => {
    log.debug('conditions useMemo', selectedColumnType);
    if (selectedColumnType === undefined) {
      return [];
    }
    if (TableUtils.isNumberType(selectedColumnType)) {
      return numberFormatConditionOptions;
    }

    if (TableUtils.isTextType(selectedColumnType)) {
      return stringFormatConditions;
    }
  }, [selectedColumnType]);

  // TODO: test on different columns
  const [selectedCondition, setCondition] = useState(
    TableUtils.isNumberType(selectedColumnType)
      ? NumberFormatCondition.IS_EQUAL
      : StringFormatCondition.IS_EXACTLY
  );

  const handleColumnChange = useCallback(
    e => {
      const { value } = e.target;
      const newColumn = columns.find(({ name }) => name === value);
      if (newColumn && selectedColumnType !== newColumn.type) {
        log.debug('handleColumnChange', selectedColumnType, newColumn.type);
        setCondition(
          TableUtils.isNumberType(newColumn.type)
            ? NumberFormatCondition.IS_EQUAL
            : StringFormatCondition.IS_EXACTLY
        );
      }
      setColumn(newColumn);
    },
    [columns, selectedColumnType]
  );

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleApply = useCallback(() => {
    // TODO: validation
    if (selectedColumn === undefined) {
      log.error('Unable to create formatting rule. Column is not selected.');
      return;
    }

    if (selectedStyle === undefined) {
      log.error('Unable to create formatting rule. Style is not selected.');
      return;
    }

    log.debug(
      'TEST',
      TableUtils.isNumberType(selectedColumn.type),
      Number.isNaN(Number(conditionValue))
    );

    if (
      TableUtils.isNumberType(selectedColumn.type) &&
      Number.isNaN(Number(conditionValue))
    ) {
      log.error(
        'Unable to create formatting rule. Invalid value',
        conditionValue
      );
      return;
    }
    // const rule = `${
    //   selectedFormatter === FormatterType.ROWS ? '[ROW]' : '[COL]'
    // } ${selectedColumn.name} ${selectedCondition} ${conditionValue ?? '""'}`;
    // TODO: build config based on formatter type, conditions, values, style, etc
    onApply(
      {
        type: selectedFormatter,
        column: selectedColumn,
        config: {
          condition: selectedCondition,
          style: {
            type: selectedStyle,
            // TODO
            customConfig: undefined,
          },
          value: conditionValue,
        },
      },
      id
    );
  }, [
    onApply,
    selectedColumn,
    selectedCondition,
    selectedFormatter,
    selectedStyle,
    conditionValue,
    id,
  ]);

  const handleFormatterChange = useCallback(value => {
    log.debug('handleFormatterChange', value);
    setFormatter(value);
  }, []);

  const handleConditionChange = useCallback(
    e => {
      const { value } = e.target;
      log.debug('handleConditionChange', value, selectedColumnType);
      setCondition(value);
    },
    [selectedColumnType]
  );

  const handleValueChange = useCallback(e => {
    const { value } = e.target;
    log.debug('handleValueChange', value);
    setConditionValue(value);
  }, []);

  const handleStyleChange = useCallback(e => {
    const { value } = e.target;
    log.debug('handleStyleChange', value);
    setStyle(value);
  }, []);

  const conditionInputs = useMemo(() => {
    log.debug('conditionInputs useMemo', selectedColumnType, selectedCondition);
    if (TableUtils.isNumberType(selectedColumnType)) {
      switch (selectedCondition) {
        case NumberFormatCondition.IS_EQUAL:
        case NumberFormatCondition.IS_NOT_EQUAL:
        case NumberFormatCondition.GREATER_THAN:
        case NumberFormatCondition.GREATER_THAN_OR_EQUAL:
        case NumberFormatCondition.LESS_THAN:
        case NumberFormatCondition.LESS_THAN_OR_EQUAL:
          return (
            <input
              type="text"
              className="form-control"
              placeholder="Enter value"
              value={conditionValue ?? ''}
              onChange={handleValueChange}
            />
          );
        case NumberFormatCondition.IS_BETWEEN:
          return (
            <div className="d-flex flex-row">
              <input
                type="text"
                className="form-control d-flex mr-2"
                placeholder="Start value"
                value={conditionValue ?? ''}
                onChange={handleValueChange}
              />
              <input
                // TODO: fix this
                // move into a separate component that calls onChange with the updated config
                type="text"
                className="form-control d-flex"
                placeholder="End value"
                value={conditionValue ?? ''}
                onChange={handleValueChange}
              />
            </div>
          );
      }
    } else if (TableUtils.isTextType(selectedColumnType)) {
      return (
        <input
          type="text"
          className="form-control"
          placeholder="Enter value"
          value={conditionValue ?? ''}
          onChange={handleValueChange}
        />
      );
    }
  }, [
    selectedColumnType,
    selectedCondition,
    conditionValue,
    handleValueChange,
  ]);

  const columnOptions = columns.map(({ name }) => (
    <option key={name} value={name}>
      {name}
    </option>
  ));

  return (
    <div className="conditional-formatting-editor form">
      <div className="mb-2">
        <label className="mb-0" htmlFor="formatter-select">
          Select Formatter
        </label>

        <div className="form-row">
          {formatterTypes.map((formatterType, index) => (
            <div key={formatterType} className="col col-formatter-type">
              <button
                type="button"
                className={classNames('btn', 'btn-icon', 'btn-formatter-type', {
                  active: formatterType === selectedFormatter,
                })}
                data-index={index}
                onClick={() => handleFormatterChange(formatterType)}
              >
                {getFormatterTypeIcon(formatterType)}
                {getFormatterTypeLabel(formatterType)}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2">
        <label className="mb-0" htmlFor="column-select">
          {selectedFormatter === FormatterType.ROWS
            ? 'Format Row If'
            : 'Apply to Column'}
        </label>
        <select
          value={selectedColumn?.name}
          className="custom-select"
          id="column-select"
          onChange={handleColumnChange}
        >
          {columnOptions}
        </select>
      </div>

      {(selectedFormatter === FormatterType.CONDITIONAL ||
        // TODO
        selectedFormatter === FormatterType.ADVANCED ||
        selectedFormatter === FormatterType.ROWS) &&
        selectedColumn !== undefined && (
          <>
            <div className="mb-2">
              <label className="mb-0" htmlFor="condition-select">
                {selectedFormatter === FormatterType.ROWS
                  ? ''
                  : 'Format Cell If'}
              </label>
              <select
                // TODO: separate condition editor as a component, one for each type?
                // Pass a callback with a completed condition string?
                value={selectedCondition}
                id="condition-select"
                className="custom-select mb-2"
                onChange={handleConditionChange}
              >
                {conditions}
              </select>
              {conditionInputs}
            </div>
            <div className="mb-2">
              <label className="mb-0" htmlFor="style-select">
                Style
              </label>
              <select
                value={selectedStyle}
                className="custom-select"
                id="style-select"
                onChange={handleStyleChange}
              >
                {styleOptions}
              </select>
            </div>
          </>
        )}

      {selectedFormatter === FormatterType.PROGRESS &&
        selectedColumn !== undefined && (
          <>
            <div>
              <label className="mb-0" htmlFor="style-select">
                Bar Style
              </label>
              <div className="mb-2 d-flex flex-row">
                <div>
                  <select
                    value={selectedStyle}
                    className="custom-select"
                    id="style-select"
                    onChange={handleStyleChange}
                  >
                    {styleOptions}
                  </select>
                </div>
                <div className="d-flex flex-col align-items-center">
                  <label className="mb-0 pl-2" htmlFor="style-select">
                    Show Numbers
                  </label>
                </div>
              </div>
            </div>

            <div className="d-flex flex-row">
              <div className="d-flex mr-2 flex-col flex-wrap">
                <div className="w-100 mb-2">
                  <label className="mb-0">Start</label>
                  <select className="custom-select">
                    <option value="number">Number</option>
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Start value"
                    value={conditionValue ?? ''}
                    onChange={handleValueChange}
                  />
                </div>
              </div>
              <div className="d-flex flex-col flex-wrap">
                <div className="w-100 mb-2">
                  <label className="mb-0">End</label>
                  <select className="custom-select">
                    <option value="number">Number</option>
                  </select>
                </div>
                <input
                  // TODO: fix this
                  // move into a separate component that calls onChange with the updated config
                  type="text"
                  className="form-control d-flex"
                  placeholder="End value"
                  value={conditionValue ?? ''}
                  onChange={handleValueChange}
                />
              </div>
            </div>
          </>
        )}

      <hr />
      <div className="d-flex justify-content-end my-3">
        {!disableCancel && (
          <Button kind="secondary" onClick={handleCancel} className="mr-2">
            {' '}
            Cancel
          </Button>
        )}

        <Button
          kind="primary"
          onClick={handleApply}
          disabled={
            selectedFormatter !== FormatterType.CONDITIONAL &&
            selectedFormatter !== FormatterType.ADVANCED &&
            selectedFormatter !== FormatterType.ROWS
          }
        >
          Apply Format
        </Button>
      </div>
    </div>
  );
};

export default ConditionalFormattingEditor;
