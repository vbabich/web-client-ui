import { FormatStyleType } from './ConditionalRuleEditor';

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
