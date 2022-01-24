import { TableUtils } from '../..';
import {
  FormatStyleConfig,
  getTextForDateCondition,
  getTextForNumberCondition,
  getTextForStringCondition,
} from '../ConditionalFormattingEditor';
import {
  ConditionConfig,
  DateFormatCondition,
  FormatStyleType,
  NumberFormatCondition,
  StringFormatCondition,
} from './ConditionalRuleEditor';

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
      // TODO: test with unset custom bg
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

export function getTextForStyleConfig(
  config: FormatStyleConfig
): string | null {
  return `bgfg(\`${getBackgroundForStyleConfig(config) ?? null}\`, \`${
    getColorForStyleConfig(config) ?? null
  }\`)`;
}

function getNumberConditionText(config: ConditionConfig): string {
  const { column, value, start, end } = config;
  return getTextForNumberCondition(
    column.name,
    config.condition as NumberFormatCondition,
    value,
    start,
    end
  );
}

function getStringConditionText(config: ConditionConfig): string {
  const { column, value } = config;
  return getTextForStringCondition(
    column.name,
    config.condition as StringFormatCondition,
    value
  );
}

function getDateConditionText(config: ConditionConfig): string {
  const { column, value } = config;
  return getTextForDateCondition(
    column.name,
    config.condition as DateFormatCondition,
    value
  );
}

export function getConditionText(config: ConditionConfig): string {
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
