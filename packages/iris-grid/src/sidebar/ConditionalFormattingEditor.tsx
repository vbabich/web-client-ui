import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { Button } from '@deephaven/components';
import Log from '@deephaven/log';
import { FormatColumnWhereIcon, FormatRowWhereIcon } from './icons';
import { TableUtils } from '..';

import './ConditionalFormattingEditor.scss';
import ConditionalRuleEditor, {
  NumberFormatCondition,
  StringFormatCondition,
  FormatPointType,
  FormatStyleType,
  ConditionConfig,
  DateFormatCondition,
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
