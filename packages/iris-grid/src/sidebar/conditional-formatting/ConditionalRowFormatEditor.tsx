import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Log from '@deephaven/log';
import { TableUtils } from '../..';
import {
  ModelColumn,
  FormatStyleConfig,
  FormattingRuleEditorChangeCallback,
} from '../ConditionalFormattingEditor';

import { getLabelForStyleType } from './ConditionalFormattingUtils';

import '../ConditionalFormattingEditor.scss';

const log = Log.module('ConditionalRowFormatEditor');

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

export enum DateFormatCondition {
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
  condition:
    | NumberFormatCondition
    | StringFormatCondition
    | DateFormatCondition;
  value?: string | number;
  start?: number;
  end?: number;
  style: FormatStyleConfig;
}

export interface ConditionalRowFormatEditorProps {
  columns: ModelColumn[];
  config?: ConditionConfig;
  onChange?: FormattingRuleEditorChangeCallback;
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

export function getLabelForStringCondition(
  condition: StringFormatCondition
): string {
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

export function getLabelForDateCondition(
  condition: DateFormatCondition
): string {
  switch (condition) {
    case DateFormatCondition.IS_EXACTLY:
      return 'Is';
    case DateFormatCondition.IS_NOT_EXACTLY:
      return 'Is not';
    case DateFormatCondition.IS_BEFORE:
      return 'Is before';
    case DateFormatCondition.IS_BEFORE_OR_EQUAL:
      return 'Is before or equal';
    case DateFormatCondition.IS_AFTER:
      return 'Is after';
    case DateFormatCondition.IS_AFTER_OR_EQUAL:
      return 'Is after or equal';
  }
}

function getDefaultConditionForType(
  columnType: string | undefined
): NumberFormatCondition | StringFormatCondition | DateFormatCondition {
  if (TableUtils.isNumberType(columnType)) {
    return NumberFormatCondition.IS_EQUAL;
  }

  if (TableUtils.isTextType(columnType)) {
    return StringFormatCondition.IS_EXACTLY;
  }

  if (TableUtils.isDateType(columnType)) {
    return DateFormatCondition.IS_EXACTLY;
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

const dateFormatConditions = [
  DateFormatCondition.IS_EXACTLY,
  DateFormatCondition.IS_NOT_EXACTLY,
  DateFormatCondition.IS_BEFORE,
  DateFormatCondition.IS_BEFORE_OR_EQUAL,
  DateFormatCondition.IS_AFTER,
  DateFormatCondition.IS_AFTER_OR_EQUAL,
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

const ConditionalRowFormatEditor = (
  props: ConditionalRowFormatEditorProps
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

  // TODO: init?
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

    log.debug(
      'isDateType',
      TableUtils.isDateType(selectedColumnType),
      dateFormatConditions
    );
    if (TableUtils.isDateType(selectedColumnType)) {
      return dateFormatConditions;
    }
  }, [selectedColumnType]);

  // TODO: test on different columns
  const [selectedCondition, setCondition] = useState(
    (config as ConditionConfig).condition
  );

  log.debug('loop', selectedColumnType, config, defaultColumn, config);

  const handleColumnChange = useCallback(
    e => {
      const { value } = e.target;
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
        selectedCondition !== NumberFormatCondition.IS_BETWEEN) ||
        (selectedCondition === NumberFormatCondition.IS_BETWEEN &&
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
          foreground: '',
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

  const columnOptions = columns.map(({ name }) => (
    <option key={name} value={name}>
      {name}
    </option>
  ));

  return (
    <div className="conditional-rule-editor form">
      <div className="mb-2">
        <label className="mb-0" htmlFor="column-select">
          Format Row If
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

      {selectedColumn !== undefined && (
        <>
          <div className="mb-2">
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

export default ConditionalRowFormatEditor;
