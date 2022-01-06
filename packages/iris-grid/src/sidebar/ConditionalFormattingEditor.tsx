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
import ConditionalRuleEditor, {
  NumberFormatCondition,
  StringFormatCondition,
  FormatPointType,
  FormatStyleType,
  ConditionConfig,
  getLabelForStringCondition,
  DateFormatCondition,
} from './conditional-formatting/ConditionalRuleEditor';
import { getLabelForStyleType } from './conditional-formatting/ConditionalFormattingUtils';
import ConditionalRowFormatEditor from './conditional-formatting/ConditionalRowFormatEditor';

const log = Log.module('ConditionalFormattingEditor');

export type ConditionalFormattingSaveCallback = (rule: FormattingRule) => void;

export type ConditionalFormattingCancelCallback = () => void;

export type FormattingRuleEditorChangeCallback = (
  ruleConfig: ConditionConfig
) => void;

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
    color: string;
    background: string;
  };
}
export interface AdvancedConditionConfig {
  column: ModelColumn;
  condition: string;
  style: FormatStyleConfig;
}

export interface ProgressConfig {
  column: ModelColumn;
  style: FormatStyleConfig;
  startType: FormatPointType;
  endType: FormatPointType;
  // Optional depending on point type
  start?: number;
  end?: number;
}

export interface ColorScaleConfig {
  column: ModelColumn;
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

export interface ConditionalFormattingRule {
  type: FormatterType;
  column: ModelColumn;
  config: ConditionConfig;
}

export interface FormattingRule {
  type: FormatterType;
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
  disableCancel?: boolean;
  onCancel?: ConditionalFormattingCancelCallback;
  onSave?: ConditionalFormattingSaveCallback;
  onUpdate?: ConditionalFormattingSaveCallback;
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

function getShortLabelForStringCondition(
  condition: StringFormatCondition
): string {
  switch (condition) {
    case StringFormatCondition.IS_EXACTLY:
      return '==';
    case StringFormatCondition.IS_NOT_EXACTLY:
      return '!=';
    case StringFormatCondition.CONTAINS:
      return 'contains';
    case StringFormatCondition.DOES_NOT_CONTAIN:
      return 'does not contain';
    case StringFormatCondition.STARTS_WITH:
      return 'starts with';
    case StringFormatCondition.ENDS_WITH:
      return 'ends with';
  }
}

function getShortLabelForDateCondition(condition: DateFormatCondition): string {
  switch (condition) {
    case DateFormatCondition.IS_EXACTLY:
      return '==';
    case DateFormatCondition.IS_NOT_EXACTLY:
      return '!=';
    case DateFormatCondition.IS_BEFORE:
      return '<';
    case DateFormatCondition.IS_BEFORE_OR_EQUAL:
      return '<=';
    case DateFormatCondition.IS_AFTER:
      return '>';
    case DateFormatCondition.IS_AFTER_OR_EQUAL:
      return '>=';
  }
}

export function getShortLabelForNumberCondition(
  condition: NumberFormatCondition
): string {
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

export function getTextForNumberCondition(
  columnName: string,
  condition: NumberFormatCondition,
  value: unknown,
  start: unknown,
  end: unknown
): string {
  switch (condition) {
    case NumberFormatCondition.IS_EQUAL:
      return `${columnName} == ${value}`;
    case NumberFormatCondition.IS_NOT_EQUAL:
      return `${columnName} != ${value}`;
    case NumberFormatCondition.IS_BETWEEN:
      return `${columnName} > ${start} && ${columnName} < ${end}`;
    case NumberFormatCondition.GREATER_THAN:
      return `${columnName} > ${value}`;
    case NumberFormatCondition.GREATER_THAN_OR_EQUAL:
      return `${columnName} >= ${value}`;
    case NumberFormatCondition.LESS_THAN:
      return `${columnName} < ${value}`;
    case NumberFormatCondition.LESS_THAN_OR_EQUAL:
      return `${columnName} <= ${value}`;
  }
}

export function getTextForStringCondition(
  columnName: string,
  condition: StringFormatCondition,
  value: unknown
): string {
  switch (condition) {
    case StringFormatCondition.IS_EXACTLY:
      return `${columnName} == "${value}"`;
    case StringFormatCondition.IS_NOT_EXACTLY:
      return `${columnName} != "${value}"`;
    case StringFormatCondition.CONTAINS:
      return `${columnName}.contains("${value}")`;
    case StringFormatCondition.DOES_NOT_CONTAIN:
      return `!${columnName}.contains("${value}")`;
    case StringFormatCondition.STARTS_WITH:
      return `${columnName}.startsWith("${value}")`;
    case StringFormatCondition.ENDS_WITH:
      return `${columnName}.endsWith("${value}")`;
  }
}

export function getTextForDateCondition(
  columnName: string,
  condition: DateFormatCondition,
  value: unknown
): string {
  switch (condition) {
    case DateFormatCondition.IS_EXACTLY:
      return `${columnName} == convertDateTime("${value}")`;
    case DateFormatCondition.IS_NOT_EXACTLY:
      return `${columnName} != convertDateTime(\`${value}\`)`;
    case DateFormatCondition.IS_BEFORE:
      return `${columnName} < convertDateTime(\`${value}\`)`;
    case DateFormatCondition.IS_BEFORE_OR_EQUAL:
      return `${columnName} <=  convertDateTime("${value}")`;
    case DateFormatCondition.IS_AFTER:
      return `${columnName} > convertDateTime(\`${value}\`)`;
    case DateFormatCondition.IS_AFTER_OR_EQUAL:
      return `${columnName} >=  convertDateTime(\`${value}\`)`;
  }
}

export function getLabelForConditionType(
  columnType: string,
  condition: StringFormatCondition | NumberFormatCondition | DateFormatCondition
): string {
  if (TableUtils.isNumberType(columnType)) {
    return getShortLabelForNumberCondition(condition as NumberFormatCondition);
  }

  if (TableUtils.isTextType(columnType)) {
    return getShortLabelForStringCondition(condition as StringFormatCondition);
  }

  if (TableUtils.isDateType(columnType)) {
    return getShortLabelForDateCondition(condition as DateFormatCondition);
  }

  throw new Error('Invalid column type');
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

function getDefaultConditionForType(
  columnType: string | undefined
): NumberFormatCondition | StringFormatCondition {
  // TODO: other types
  return TableUtils.isNumberType(columnType)
    ? NumberFormatCondition.IS_EQUAL
    : StringFormatCondition.IS_EXACTLY;
}

function makeDefaultRule(columns: ModelColumn[]): FormattingRule {
  const { type, name } = columns[0];
  const column = { type, name };
  const condition = getDefaultConditionForType(type);
  return {
    type: FormatterType.CONDITIONAL,
    config: {
      column,
      condition,
      value: undefined,
      style: {
        type: FormatStyleType.NO_FORMATTING,
      },
    },
  };
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
    onSave = DEFAULT_CALLBACK,
    onUpdate = DEFAULT_CALLBACK,
    onCancel = DEFAULT_CALLBACK,
    rule: defaultRule,
    disableCancel = false,
  } = props;

  const { type: defaultType, config } = defaultRule ?? makeDefaultRule(columns);
  const { column: defaultColumn } = config;

  const [selectedColumn, setColumn] = useState(
    columns.length > 0
      ? columns.find(
          c => c.name === defaultColumn.name && c.type === defaultColumn.type
        )
      : undefined
  );

  const [selectedFormatter, setFormatter] = useState(defaultType);

  const [rule, setRule] = useState(defaultRule);

  // TODO: init?
  const [conditionValue, setConditionValue] = useState(
    defaultType === FormatterType.CONDITIONAL
      ? (config as ConditionConfig).value
      : undefined
  );
  // TODO: style only needed for some of the conditional format types
  const [selectedStyle, setStyle] = useState(
    defaultType === FormatterType.CONDITIONAL
      ? (config as ConditionConfig).style.type
      : undefined
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
  }, [selectedColumnType]);

  // TODO: test on different columns
  const [selectedCondition, setCondition] = useState(
    defaultType === FormatterType.CONDITIONAL
      ? (config as ConditionConfig).condition
      : undefined
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
    if (rule === undefined) {
      log.error('Unable to apply formatting. Rule is not defined.');
      return;
    }
    onSave(rule);
  }, [onSave, rule]);

  // const handleUpdate = useCallback(() => {
  //   // TODO: validation
  //   if (rule === undefined) {
  //     log.error('Unable to apply formatting. Rule is not defined.');
  //     return;
  //   }
  //   onUpdate(rule);
  // }, [onUpdate, rule]);

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

  const handleRuleChange = useCallback(
    ruleConfig => {
      log.debug('handleRuleChange', ruleConfig, selectedFormatter);
      if (selectedFormatter === undefined) {
        log.debug('Unable to create new rule - formatter not selected.');
        return;
      }
      const updatedRule = {
        type: selectedFormatter,
        config: ruleConfig as ConditionConfig,
      };
      setRule(updatedRule);
      onUpdate(updatedRule);
    },
    [onUpdate, selectedFormatter]
  );

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
          {formatterTypes.map((type, index) => (
            <div key={type} className="col col-formatter-type">
              <button
                type="button"
                className={classNames('btn', 'btn-icon', 'btn-formatter-type', {
                  active: type === selectedFormatter,
                })}
                data-index={index}
                onClick={() => handleFormatterChange(type)}
              >
                {getFormatterTypeIcon(type)}
                {getFormatterTypeLabel(type)}
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedFormatter === FormatterType.CONDITIONAL && (
        <ConditionalRuleEditor
          columns={columns}
          config={rule?.config as ConditionConfig}
          onChange={handleRuleChange}
        />
      )}

      {selectedFormatter === FormatterType.ROWS && (
        <ConditionalRowFormatEditor
          columns={columns}
          config={rule?.config as ConditionConfig}
          onChange={handleRuleChange}
        />
      )}

      {/* {selectedFormatter !== FormatterType.CONDITIONAL && (
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
      )} */}

      {selectedFormatter === FormatterType.ADVANCED &&
        // ||
        // TODO
        // selectedFormatter === FormatterType.ROWS
        selectedColumn !== undefined && (
          <>
            <div className="mb-2">
              <label className="mb-0" htmlFor="condition-select">
                {/* {selectedFormatter === FormatterType.ROWS
                  ? ''
                  : 'Format Cell If'} */}
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
            // selectedFormatter !== FormatterType.ADVANCED &&
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
