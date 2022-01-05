import { TableUtils } from '../..';
import {
  FormatStyleConfig,
  getTextForNumberCondition,
  getTextForStringCondition,
} from '../ConditionalFormattingEditor';
import {
  ConditionConfig,
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

export function getColorForStyleConfig(
  config: FormatStyleConfig
): string | null {
  const { type, customConfig } = config;
  switch (type) {
    case FormatStyleType.NO_FORMATTING:
      return null;
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
      return customConfig === undefined ? null : customConfig.background;
    default:
      return null;
  }
}

export function getTextForStyleConfig(
  config: FormatStyleConfig
): string | null {
  return `bgfga(\`${getColorForStyleConfig(config)}\`)`;
}

function getNumberConditionText(config: ConditionConfig): string {
  const { column, value } = config;
  return getTextForNumberCondition(
    column.name,
    config.condition as NumberFormatCondition,
    value
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

export function getConditionText(config: ConditionConfig): string {
  const { column } = config;

  if (TableUtils.isNumberType(column.type)) {
    return getNumberConditionText(config);
  }
  if (TableUtils.isTextType(column.type)) {
    return getStringConditionText(config);
  }

  throw new Error('Invalid condition config');
}
