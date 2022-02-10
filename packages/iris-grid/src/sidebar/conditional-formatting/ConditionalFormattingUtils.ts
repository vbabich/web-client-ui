import Log from '@deephaven/log';
import { Column, CustomColumn } from '@deephaven/jsapi-shim';
import TableUtils from '../../TableUtils';
import {
  makeColumnFormatColumn,
  makeRowFormatColumn,
  makeTernaryFormatRule,
} from './ConditionalFormattingAPIUtils';

const log = Log.module('ConditionalFormattingUtils');

export type ModelColumn = {
  name: string;
  type: string;
};

export interface BaseFormatConfig {
  column: ModelColumn;
  condition: NumberCondition | StringCondition | DateCondition;
  value?: string | number;
  start?: number;
  end?: number;
  style: FormatStyleConfig;
}

export interface ConditionConfig {
  condition: NumberCondition | StringCondition | DateCondition;
  value?: string | number;
  start?: number;
  end?: number;
}

export enum FormatterType {
  CONDITIONAL = 'conditional',
  ROWS = 'rows',
}

export interface FormattingRule {
  type: FormatterType;
  config: BaseFormatConfig;
}

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

export interface FormatStyleConfig {
  type: FormatStyleType;
  customConfig?: {
    color: string;
    background: string;
  };
}

export function getLabelForStyleType(option: FormatStyleType): string {
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

export function getBackgroundForStyleConfig(
  config: FormatStyleConfig
): string | undefined {
  const { type, customConfig } = config;
  switch (type) {
    case FormatStyleType.NO_FORMATTING:
      return undefined;
    case FormatStyleType.POSITIVE:
      return '#9fde6f';
    case FormatStyleType.NEGATIVE:
      return '#ff6087';
    case FormatStyleType.WARN:
      return '#f67f40';
    case FormatStyleType.NEUTRAL:
      return '#ffd95c';
    case FormatStyleType.ACCENT_1:
      return '#78dce8';
    case FormatStyleType.ACCENT_2:
      return '#ab9bf5';
    case FormatStyleType.CUSTOM:
      return customConfig?.background;
    default:
      return undefined;
  }
}

export function getColorForStyleConfig(
  config: FormatStyleConfig
): string | undefined {
  const { type, customConfig } = config;
  switch (type) {
    case FormatStyleType.NO_FORMATTING:
      return undefined;
    case FormatStyleType.POSITIVE:
      return '#526a3f';
    case FormatStyleType.NEGATIVE:
      return '#802f44';
    case FormatStyleType.WARN:
      return '#663318';
    case FormatStyleType.NEUTRAL:
      return '#63562b';
    case FormatStyleType.ACCENT_1:
      return '#3f6469';
    case FormatStyleType.ACCENT_2:
      return '#554d72';
    case FormatStyleType.CUSTOM:
      return customConfig?.color;
    default:
      return undefined;
  }
}

export function getStyleDBString(config: BaseFormatConfig): string | undefined {
  const color = getColorForStyleConfig(config.style);
  const bg = getBackgroundForStyleConfig(config.style);
  if (color === undefined || bg === undefined) {
    return undefined;
  }
  return `bgfg(\`${bg}\`, \`${color}\`)`;
}

function getNumberConditionText(config: BaseFormatConfig): string {
  const { column, value, start, end } = config;
  return getTextForNumberCondition(
    column.name,
    config.condition as NumberCondition,
    value,
    start,
    end
  );
}

function getStringConditionText(config: BaseFormatConfig): string {
  const { column, value } = config;
  return getTextForStringCondition(
    column.name,
    config.condition as StringCondition,
    value
  );
}

function getDateConditionText(config: BaseFormatConfig): string {
  const { column, value } = config;
  return getTextForDateCondition(
    column.name,
    config.condition as DateCondition,
    value
  );
}

export function getConditionDBString(config: BaseFormatConfig): string {
  const { column } = config;

  if (TableUtils.isNumberType(column.type)) {
    return getNumberConditionText(config);
  }
  if (TableUtils.isTextType(column.type)) {
    return getStringConditionText(config);
  }

  if (TableUtils.isDateType(column.type)) {
    return getDateConditionText(config);
  }

  throw new Error('Invalid column type');
}

export function getLabelForNumberCondition(condition: NumberCondition): string {
  switch (condition) {
    case NumberCondition.IS_EQUAL:
      return 'is equal to';
    case NumberCondition.IS_NOT_EQUAL:
      return 'is not equal to';
    case NumberCondition.IS_BETWEEN:
      return 'is between';
    case NumberCondition.GREATER_THAN:
      return 'greater than';
    case NumberCondition.GREATER_THAN_OR_EQUAL:
      return 'greater than or equal to';
    case NumberCondition.LESS_THAN:
      return 'less than';
    case NumberCondition.LESS_THAN_OR_EQUAL:
      return 'less than or equal to';
  }
}

export function getLabelForStringCondition(condition: StringCondition): string {
  switch (condition) {
    case StringCondition.IS_EXACTLY:
      return 'is exactly';
    case StringCondition.IS_NOT_EXACTLY:
      return 'is not exactly';
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

export function getLabelForDateCondition(condition: DateCondition): string {
  switch (condition) {
    case DateCondition.IS_EXACTLY:
      return 'is';
    case DateCondition.IS_NOT_EXACTLY:
      return 'is not';
    case DateCondition.IS_BEFORE:
      return 'is before';
    case DateCondition.IS_BEFORE_OR_EQUAL:
      return 'is before or equal';
    case DateCondition.IS_AFTER:
      return 'is after';
    case DateCondition.IS_AFTER_OR_EQUAL:
      return 'is after or equal';
  }
}

export function getDefaultConditionForType(
  columnType: string
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

export function getConditionConfig(config: BaseFormatConfig): ConditionConfig {
  const { condition, value, start, end } = config;
  return { condition, value, start, end };
}

export function getDefaultConditionConfigForType(
  type: string
): ConditionConfig {
  return {
    condition: getDefaultConditionForType(type),
    value: undefined,
    start: undefined,
    end: undefined,
  };
}

export function getDefaultStyleConfig(): FormatStyleConfig {
  return {
    type: FormatStyleType.NO_FORMATTING,
  };
}

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

export function getShortLabelForConditionType(
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

/**
 * Get format columns array for the given columns and formatting rules
 * @param columns Available columns
 * @param rules Formatting rules to build the format columns from
 * @returns Array of format columns
 */
export function getFormatColumns(
  columns: Column[],
  rules: FormattingRule[]
): CustomColumn[] {
  const result: CustomColumn[] = [];
  const ruleMap = {
    [FormatterType.ROWS]: new Map(),
    [FormatterType.CONDITIONAL]: new Map(),
  };
  rules.forEach(({ config, type: formatterType }) => {
    const { column } = config;
    // Check both name and type because the type can change
    const col = columns.find(
      ({ name, type }) => name === column.name && type === column.type
    );
    if (col === undefined) {
      log.debug(
        `Column ${column.name}:${column.type} not found. Ignoring format rule.`,
        config
      );
      return;
    }
    // Stack ternary format conditions by column
    const prevRule = ruleMap[formatterType].get(col.name) ?? null;
    const rule = makeTernaryFormatRule(config, prevRule);
    if (rule === undefined) {
      log.debug(`Ignoring format rule.`, config);
      return;
    }
    const index = result.indexOf(prevRule);
    if (index > -1) {
      result.splice(index, 1);
    }
    const formatColumn =
      formatterType === FormatterType.CONDITIONAL
        ? makeColumnFormatColumn(col, rule)
        : makeRowFormatColumn(rule);
    result.push(formatColumn);
    ruleMap[formatterType].set(col.name, rule);
  });

  return result;
}
