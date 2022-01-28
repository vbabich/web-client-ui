import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Log from '@deephaven/log';
import { ColorUtils } from '@deephaven/utils';
import { ComboBox } from '@deephaven/components';
import { TableUtils } from '../..';
import {
  ModelColumn,
  FormatStyleConfig,
  FormattingRuleEditorChangeCallback,
} from '../ConditionalFormattingEditor';
import { getLabelForStyleType } from './ConditionalFormattingUtils';

import '../ConditionalFormattingEditor.scss';

const log = Log.module('ConditionalRuleEditor');

export enum NumberCondition {
  IS_EQUAL = 'is-equal',
  IS_NOT_EQUAL = 'is-not-equal',
  IS_BETWEEN = 'is-between',
  GREATER_THAN = 'greater-than',
  GREATER_THAN_OR_EQUAL = 'greater-than-or-equal',
  LESS_THAN = 'less-than',
  LESS_THAN_OR_EQUAL = 'less-than-or-equal',
}

export enum StringCondition {
  IS_EXACTLY = 'is-exactly',
  IS_NOT_EXACTLY = 'is-not-exactly',
  CONTAINS = 'contains',
  DOES_NOT_CONTAIN = 'does-not-contain',
  STARTS_WITH = 'starts-with',
  ENDS_WITH = 'ends-with',
}

export enum DateCondition {
  IS_EXACTLY = 'is-exactly',
  IS_NOT_EXACTLY = 'is-not-exactly',
  IS_BEFORE = 'is-before',
  IS_BEFORE_OR_EQUAL = 'is-before-or-equal',
  IS_AFTER = 'is-after',
  IS_AFTER_OR_EQUAL = 'is-after-or-equal',
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

export interface ConditionConfig {
  column: ModelColumn;
  condition: NumberCondition | StringCondition | DateCondition;
  value?: string | number;
  start?: number;
  end?: number;
  style: FormatStyleConfig;
}

export interface ConditionalRuleEditorProps {
  columns: ModelColumn[];
  config?: ConditionConfig;
  onChange?: FormattingRuleEditorChangeCallback;
}

const DEFAULT_CALLBACK = () => undefined;

// TODO: move to utils?
function getLabelForNumberCondition(condition: NumberCondition): string {
  switch (condition) {
    case NumberCondition.IS_EQUAL:
      return 'Is equal to';
    case NumberCondition.IS_NOT_EQUAL:
      return 'Is not equal to';
    case NumberCondition.IS_BETWEEN:
      return 'Is between';
    case NumberCondition.GREATER_THAN:
      return 'Greater than';
    case NumberCondition.GREATER_THAN_OR_EQUAL:
      return 'Greater than or equal to';
    case NumberCondition.LESS_THAN:
      return 'Less than';
    case NumberCondition.LESS_THAN_OR_EQUAL:
      return 'Less than or equal to';
  }
}

export function getLabelForStringCondition(condition: StringCondition): string {
  switch (condition) {
    case StringCondition.IS_EXACTLY:
      return 'Is exactly';
    case StringCondition.IS_NOT_EXACTLY:
      return 'Is not exactly';
    case StringCondition.CONTAINS:
      return 'Contains';
    case StringCondition.DOES_NOT_CONTAIN:
      return 'Does not contain';
    case StringCondition.STARTS_WITH:
      return 'Starts with';
    case StringCondition.ENDS_WITH:
      return 'Ends with';
  }
}

export function getLabelForDateCondition(condition: DateCondition): string {
  switch (condition) {
    case DateCondition.IS_EXACTLY:
      return 'Is';
    case DateCondition.IS_NOT_EXACTLY:
      return 'Is not';
    case DateCondition.IS_BEFORE:
      return 'Is before';
    case DateCondition.IS_BEFORE_OR_EQUAL:
      return 'Is before or equal';
    case DateCondition.IS_AFTER:
      return 'Is after';
    case DateCondition.IS_AFTER_OR_EQUAL:
      return 'Is after or equal';
  }
}

function getDefaultConditionForType(
  columnType: string | undefined
): NumberCondition | StringCondition | DateCondition {
  if (TableUtils.isNumberType(columnType)) {
    return NumberCondition.IS_EQUAL;
  }

  if (TableUtils.isTextType(columnType)) {
    return StringCondition.IS_EXACTLY;
  }

  if (TableUtils.isDateType(columnType)) {
    return DateCondition.IS_EXACTLY;
  }

  throw new Error('Invalid column type');
}

function makeDefaultConfig(columns: ModelColumn[]): ConditionConfig {
  const { type, name } = columns[0];
  const column = { type, name };
  const condition = getDefaultConditionForType(type);

  const config = {
    column,
    condition,
    value: undefined,
    start: undefined,
    end: undefined,
    style: {
      type: FormatStyleType.NO_FORMATTING,
    },
  };

  log.debug('makeDefaultConfig', config);
  return config;
}

const numberConditionOptions = [
  NumberCondition.IS_EQUAL,
  NumberCondition.IS_NOT_EQUAL,
  NumberCondition.IS_BETWEEN,
  NumberCondition.GREATER_THAN,
  NumberCondition.GREATER_THAN_OR_EQUAL,
  NumberCondition.LESS_THAN,
  NumberCondition.LESS_THAN_OR_EQUAL,
].map(option => (
  <option key={option} value={option}>
    {getLabelForNumberCondition(option)}
  </option>
));

const stringConditions = [
  StringCondition.IS_EXACTLY,
  StringCondition.IS_NOT_EXACTLY,
  StringCondition.CONTAINS,
  StringCondition.DOES_NOT_CONTAIN,
  StringCondition.STARTS_WITH,
  StringCondition.ENDS_WITH,
].map(option => (
  <option key={option} value={option}>
    {getLabelForStringCondition(option)}
  </option>
));

const dateConditions = [
  DateCondition.IS_EXACTLY,
  DateCondition.IS_NOT_EXACTLY,
  DateCondition.IS_BEFORE,
  DateCondition.IS_BEFORE_OR_EQUAL,
  DateCondition.IS_AFTER,
  DateCondition.IS_AFTER_OR_EQUAL,
].map(option => (
  <option key={option} value={option}>
    {getLabelForDateCondition(option)}
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

const ConditionalRuleEditor = (
  props: ConditionalRuleEditorProps
): JSX.Element => {
  const {
    columns,
    config = makeDefaultConfig(columns),
    onChange = DEFAULT_CALLBACK,
  } = props;

  // TODO
  const { column: defaultColumn } = config;

  const [selectedColumn, setColumn] = useState(
    columns.length > 0
      ? columns.find(
          c => c.name === defaultColumn.name && c.type === defaultColumn.type
        )
      : undefined
  );

  const [conditionValue, setConditionValue] = useState(config?.value);
  const [startValue, setStartValue] = useState(config?.start);
  const [endValue, setEndValue] = useState(config?.end);
  // TODO: style only needed for some of the conditional format types
  const [selectedStyle, setStyle] = useState(
    (config as ConditionConfig).style.type
  );

  const [selectedColor, setColor] = useState(
    (config as ConditionConfig).style.customConfig?.background ?? '#fcfcfa'
  );

  const selectedColumnType = selectedColumn?.type;

  const conditions = useMemo(() => {
    if (selectedColumnType === undefined) {
      return [];
    }
    if (TableUtils.isNumberType(selectedColumnType)) {
      return numberConditionOptions;
    }
    if (TableUtils.isTextType(selectedColumnType)) {
      return stringConditions;
    }
    if (TableUtils.isDateType(selectedColumnType)) {
      return dateConditions;
    }
  }, [selectedColumnType]);

  // TODO: test on different columns
  const [selectedCondition, setCondition] = useState(
    (config as ConditionConfig).condition
  );

  const handleColumnChange = useCallback(
    value => {
      const newColumn = columns.find(({ name }) => name === value);
      if (newColumn && selectedColumnType !== newColumn.type) {
        log.debug('handleColumnChange', selectedColumnType, newColumn.type);
        setCondition(getDefaultConditionForType(newColumn.type));
        setConditionValue(undefined);
        setStartValue(undefined);
        setEndValue(undefined);
      }
      setColumn(newColumn);
    },
    [columns, selectedColumnType]
  );

  //   const handleApply = useCallback(() => {
  //     // TODO: validation
  //     if (selectedColumn === undefined) {
  //       log.error('Unable to create formatting rule. Column is not selected.');
  //       return;
  //     }

  //     if (selectedStyle === undefined) {
  //       log.error('Unable to create formatting rule. Style is not selected.');
  //       return;
  //     }

  //     if (selectedCondition === undefined) {
  //       log.error('Unable to create formatting rule. Condition is not selected.');
  //       return;
  //     }

  //     const { type, name } = selectedColumn;
  //     const column = { type, name };

  //     log.debug(
  //       'TEST',
  //       TableUtils.isNumberType(selectedColumn.type),
  //       Number.isNaN(Number(conditionValue))
  //     );

  //     if (
  //       TableUtils.isNumberType(selectedColumn.type) &&
  //       Number.isNaN(Number(conditionValue))
  //     ) {
  //       log.error(
  //         'Unable to create formatting rule. Invalid value',
  //         conditionValue
  //       );
  //       return;
  //     }
  //     // const rule = `${
  //     //   selectedFormatter === FormatterType.ROWS ? '[ROW]' : '[COL]'
  //     // } ${selectedColumn.name} ${selectedCondition} ${conditionValue ?? '""'}`;
  //     // TODO: build config based on formatter type, conditions, values, style, etc
  //     onApply(
  //       {
  //         type: selectedFormatter,
  //         column,
  //         config: {
  //           condition: selectedCondition,
  //           style: {
  //             type: selectedStyle,
  //             // TODO
  //             customConfig: undefined,
  //           },
  //           value: conditionValue,
  //         },
  //       },
  //       id
  //     );
  //   }, [
  //     onApply,
  //     selectedColumn,
  //     selectedCondition,
  //     selectedFormatter,
  //     selectedStyle,
  //     conditionValue,
  //     id,
  //   ]);

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

  const handleStartValueChange = useCallback(e => {
    const { value } = e.target;
    log.debug('handleStartValueChange', value);
    setStartValue(value);
  }, []);

  const handleEndValueChange = useCallback(e => {
    const { value } = e.target;
    log.debug('handleEndValueChange', value);
    setEndValue(value);
  }, []);

  const handleStyleChange = useCallback(e => {
    const { value } = e.target;
    log.debug('handleStyleChange', value);
    setStyle(value);
  }, []);

  const handleColorChange = useCallback(e => {
    const { value } = e.target;
    log.debug('handleColorChange', value);
    setColor(value);
  }, []);

  useEffect(() => {
    // TODO: validation;
    if (selectedColumn === undefined) {
      log.error('Unable to create formatting rule. Column is not selected.');
      return;
    }

    if (selectedStyle === undefined) {
      log.error('Unable to create formatting rule. Style is not selected.');
      return;
    }

    if (selectedCondition === undefined) {
      log.error('Unable to create formatting rule. Condition is not selected.');
      return;
    }

    const { type, name } = selectedColumn;
    const column = { type, name };

    if (
      TableUtils.isNumberType(selectedColumn.type) &&
      ((Number.isNaN(Number(conditionValue)) &&
        selectedCondition !== NumberCondition.IS_BETWEEN) ||
        (selectedCondition === NumberCondition.IS_BETWEEN &&
          (Number.isNaN(Number(startValue)) || Number.isNaN(Number(endValue)))))
    ) {
      log.error(
        'Unable to create formatting rule. Invalid value',
        conditionValue
      );
      return;
    }
    // TODO: debounce?
    onChange({
      column,
      condition: selectedCondition,
      style: {
        type: selectedStyle,
        // TODO
        customConfig: {
          //
          // $interfacewhite: #f0f0ee;
          // $interfaceblack: #1a171a;
          color: ColorUtils.isDark(selectedColor) ? '#f0f0ee' : '#1a171a',
          background: selectedColor,
        },
      },
      value: conditionValue,
      start: startValue,
      end: endValue,
    });
  }, [
    onChange,
    selectedColor,
    selectedColumn,
    selectedStyle,
    selectedCondition,
    conditionValue,
    startValue,
    endValue,
  ]);

  const conditionInputs = useMemo(() => {
    if (TableUtils.isNumberType(selectedColumnType)) {
      switch (selectedCondition) {
        case NumberCondition.IS_EQUAL:
        case NumberCondition.IS_NOT_EQUAL:
        case NumberCondition.GREATER_THAN:
        case NumberCondition.GREATER_THAN_OR_EQUAL:
        case NumberCondition.LESS_THAN:
        case NumberCondition.LESS_THAN_OR_EQUAL:
          return (
            <input
              type="text"
              className="form-control"
              placeholder="Enter value"
              value={conditionValue ?? ''}
              onChange={handleValueChange}
            />
          );
        case NumberCondition.IS_BETWEEN:
          return (
            <div className="d-flex flex-row">
              <input
                type="text"
                className="form-control d-flex mr-2"
                placeholder="Start value"
                value={startValue ?? ''}
                onChange={handleStartValueChange}
              />
              <input
                // TODO: fix this
                // move into a separate component that calls onChange with the updated config
                type="text"
                className="form-control d-flex"
                placeholder="End value"
                value={endValue ?? ''}
                onChange={handleEndValueChange}
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
    } else if (TableUtils.isDateType(selectedColumnType)) {
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
    startValue,
    endValue,
    handleValueChange,
    handleStartValueChange,
    handleEndValueChange,
  ]);

  const columnInputOptions = columns.map(({ name }) => ({
    title: name,
    value: name,
  }));

  return (
    <div className="conditional-rule-editor form">
      <div className="mb-2">
        <label className="mb-0">Apply to Column</label>
        <ComboBox
          defaultValue={selectedColumn?.name}
          options={columnInputOptions}
          inputPlaceholder="Select a column"
          spellCheck={false}
          onChange={handleColumnChange}
          searchPlaceholder="Filter columns"
        />
      </div>

      {selectedColumn !== undefined && (
        <>
          <div className="mb-2">
            <label className="mb-0" htmlFor="condition-select">
              Format Cell If
            </label>
            <select
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

          {selectedStyle === FormatStyleType.CUSTOM && (
            <div className="mb-2">
              <label className="mb-0" htmlFor="color-select">
                Color
              </label>
              <input
                type="color"
                value={selectedColor}
                className="custom-select"
                id="color-select"
                onChange={handleColorChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConditionalRuleEditor;
