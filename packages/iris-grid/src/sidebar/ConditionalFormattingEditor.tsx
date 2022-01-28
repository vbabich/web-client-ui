import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { Button } from '@deephaven/components';
import Log from '@deephaven/log';
import { FormatColumnWhereIcon, FormatRowWhereIcon } from './icons';
import ConditionalRuleEditor, {
  ConditionConfig,
} from './conditional-formatting/ConditionalRuleEditor';
import RowRuleEditor, {
  RowFormatConfig,
} from './conditional-formatting/RowRuleEditor';
import {
  FormatStyleType,
  getDefaultConditionForType,
  ModelColumn,
} from './conditional-formatting/ConditionalFormattingUtils';
import './ConditionalFormattingEditor.scss';

const log = Log.module('ConditionalFormattingEditor');

export type SaveCallback = (rule: FormattingRule) => void;

export type CancelCallback = () => void;

export type ChangeCallback = (ruleConfig: ConditionConfig) => void;

export enum FormatterType {
  CONDITIONAL = 'conditional',
  ROWS = 'rows',
}

export interface FormattingRule {
  type: FormatterType;
  config: ConditionConfig | RowFormatConfig;
}

export interface ConditionalFormattingEditorProps {
  columns: ModelColumn[];
  rule?: FormattingRule;
  onCancel?: CancelCallback;
  onSave?: SaveCallback;
  onUpdate?: SaveCallback;
}

const DEFAULT_CALLBACK = () => undefined;

function getFormatterTypeIcon(option: FormatterType): JSX.Element | undefined {
  switch (option) {
    case FormatterType.CONDITIONAL:
      return <FormatColumnWhereIcon />;
    case FormatterType.ROWS:
      return <FormatRowWhereIcon />;
  }
}

function getFormatterTypeLabel(option: FormatterType): string {
  switch (option) {
    case FormatterType.CONDITIONAL:
      return 'Conditional';
    case FormatterType.ROWS:
      return 'Rows';
  }
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
        <RowRuleEditor
          columns={columns}
          config={rule?.config as RowFormatConfig}
          onChange={handleRuleChange}
        />
      )}
      <hr />
      <div className="d-flex justify-content-end my-3">
        <Button kind="secondary" onClick={handleCancel} className="mr-2">
          Cancel
        </Button>
        <Button kind="primary" onClick={handleApply}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default ConditionalFormattingEditor;
