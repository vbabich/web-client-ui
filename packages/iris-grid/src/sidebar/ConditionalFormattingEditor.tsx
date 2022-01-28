import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { Button } from '@deephaven/components';
import Log from '@deephaven/log';
import { FormatColumnWhereIcon, FormatRowWhereIcon } from './icons';
import { TableUtils } from '..';

import './ConditionalFormattingEditor.scss';
import ConditionalRuleEditor, {
  NumberCondition,
  StringCondition,
  FormatPointType,
  FormatStyleType,
  ConditionConfig,
  DateCondition,
} from './conditional-formatting/ConditionalRuleEditor';
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

function getShortLabelForStringCondition(condition: StringCondition): string {
  switch (condition) {
    case StringCondition.IS_EXACTLY:
      return '==';
    case StringCondition.IS_NOT_EXACTLY:
      return '!=';
    case StringCondition.CONTAINS:
      return 'contains';
    case StringCondition.DOES_NOT_CONTAIN:
      return 'does not contain';
    case StringCondition.STARTS_WITH:
      return 'starts with';
    case StringCondition.ENDS_WITH:
      return 'ends with';
  }
}

function getShortLabelForDateCondition(condition: DateCondition): string {
  switch (condition) {
    case DateCondition.IS_EXACTLY:
      return '==';
    case DateCondition.IS_NOT_EXACTLY:
      return '!=';
    case DateCondition.IS_BEFORE:
      return '<';
    case DateCondition.IS_BEFORE_OR_EQUAL:
      return '<=';
    case DateCondition.IS_AFTER:
      return '>';
    case DateCondition.IS_AFTER_OR_EQUAL:
      return '>=';
  }
}

export function getShortLabelForNumberCondition(
  condition: NumberCondition
): string {
  switch (condition) {
    case NumberCondition.IS_EQUAL:
      return '==';
    case NumberCondition.IS_NOT_EQUAL:
      return '!=';
    case NumberCondition.IS_BETWEEN:
      return '==';
    case NumberCondition.GREATER_THAN:
      return '>';
    case NumberCondition.GREATER_THAN_OR_EQUAL:
      return '>=';
    case NumberCondition.LESS_THAN:
      return '<';
    case NumberCondition.LESS_THAN_OR_EQUAL:
      return '<=';
  }
}

export function getTextForNumberCondition(
  columnName: string,
  condition: NumberCondition,
  value: unknown,
  start: unknown,
  end: unknown
): string {
  switch (condition) {
    case NumberCondition.IS_EQUAL:
      return `${columnName} == ${value}`;
    case NumberCondition.IS_NOT_EQUAL:
      return `${columnName} != ${value}`;
    case NumberCondition.IS_BETWEEN:
      return `${columnName} > ${start} && ${columnName} < ${end}`;
    case NumberCondition.GREATER_THAN:
      return `${columnName} > ${value}`;
    case NumberCondition.GREATER_THAN_OR_EQUAL:
      return `${columnName} >= ${value}`;
    case NumberCondition.LESS_THAN:
      return `${columnName} < ${value}`;
    case NumberCondition.LESS_THAN_OR_EQUAL:
      return `${columnName} <= ${value}`;
  }
}

export function getTextForStringCondition(
  columnName: string,
  condition: StringCondition,
  value: unknown
): string {
  switch (condition) {
    case StringCondition.IS_EXACTLY:
      return `${columnName} == "${value}"`;
    case StringCondition.IS_NOT_EXACTLY:
      return `${columnName} != "${value}"`;
    case StringCondition.CONTAINS:
      return `${columnName}.contains("${value}")`;
    case StringCondition.DOES_NOT_CONTAIN:
      return `!${columnName}.contains("${value}")`;
    case StringCondition.STARTS_WITH:
      return `${columnName}.startsWith("${value}")`;
    case StringCondition.ENDS_WITH:
      return `${columnName}.endsWith("${value}")`;
  }
}

export function getTextForDateCondition(
  columnName: string,
  condition: DateCondition,
  value: unknown
): string {
  switch (condition) {
    case DateCondition.IS_EXACTLY:
      return `${columnName} == convertDateTime("${value}")`;
    case DateCondition.IS_NOT_EXACTLY:
      return `${columnName} != convertDateTime(\`${value}\`)`;
    case DateCondition.IS_BEFORE:
      return `${columnName} < convertDateTime(\`${value}\`)`;
    case DateCondition.IS_BEFORE_OR_EQUAL:
      return `${columnName} <=  convertDateTime("${value}")`;
    case DateCondition.IS_AFTER:
      return `${columnName} > convertDateTime(\`${value}\`)`;
    case DateCondition.IS_AFTER_OR_EQUAL:
      return `${columnName} >=  convertDateTime(\`${value}\`)`;
  }
}

export function getLabelForConditionType(
  columnType: string,
  condition: StringCondition | NumberCondition | DateCondition
): string {
  if (TableUtils.isNumberType(columnType)) {
    return getShortLabelForNumberCondition(condition as NumberCondition);
  }

  if (TableUtils.isTextType(columnType)) {
    return getShortLabelForStringCondition(condition as StringCondition);
  }

  if (TableUtils.isDateType(columnType)) {
    return getShortLabelForDateCondition(condition as DateCondition);
  }

  throw new Error('Invalid column type');
}

function getFormatterTypeIcon(option: FormatterType): JSX.Element | undefined {
  switch (option) {
    case FormatterType.CONDITIONAL:
      return <FormatColumnWhereIcon />;
    case FormatterType.ROWS:
      return <FormatRowWhereIcon />;
  }
  return undefined;
}

function getFormatterTypeLabel(option: FormatterType): string {
  switch (option) {
    case FormatterType.CONDITIONAL:
      return 'Conditional';
    case FormatterType.ROWS:
      return 'Rows';
  }
}

function getDefaultConditionForType(
  columnType: string | undefined
): NumberCondition | StringCondition {
  // TODO: other types
  return TableUtils.isNumberType(columnType)
    ? NumberCondition.IS_EQUAL
    : StringCondition.IS_EXACTLY;
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

const formatterTypes = [FormatterType.CONDITIONAL, FormatterType.ROWS];

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

  const { type: defaultType } = defaultRule ?? makeDefaultRule(columns);

  const [selectedFormatter, setFormatter] = useState(defaultType);

  const [rule, setRule] = useState(defaultRule);

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

  return (
    <div className="conditional-formatting-editor form">
      <div className="mb-2">
        <label className="mb-0" htmlFor="formatter-select">
          Select Formatter
        </label>

        <div className="formatter-list">
          {formatterTypes.map((type, index) => (
            <div key={type} className="formatter-type">
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
