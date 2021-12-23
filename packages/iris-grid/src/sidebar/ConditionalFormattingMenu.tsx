import React, { useCallback, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dhNewCircleLargeFilled, vsGripper, vsTrash } from '@deephaven/icons';
import { Button, DragUtils, Tooltip } from '@deephaven/components';
import Log from '@deephaven/log';
import ConditionalFormattingEditor, {
  FormatterType,
  FormattingRule,
  getTextForConditionType,
} from './ConditionalFormattingEditor';

import './ConditionalFormattingMenu.scss';
import { ConditionConfig } from './conditional-formatting/ConditionalRuleEditor';

const log = Log.module('ConditionalFormattingMenu');

export type ConditionalFormattingMenuCallback = (
  rules: FormattingRule[]
) => void;

export type ModelColumn = {
  name: string;
  type: string;
};

export type ConditionalFormattingMenuProps = {
  rules: FormattingRule[];
  columns: ModelColumn[];
  selectedColumn?: string;
  onChange?: ConditionalFormattingMenuCallback;
};

const ConditionalFormattingMenu = (
  props: ConditionalFormattingMenuProps
): JSX.Element => {
  const { rules = [], columns, onChange = () => undefined } = props;

  const [selectedRuleId, setSelectedRuleId] = useState(undefined);

  // TODO: remove callback?
  const [createNewRule, setCreateNewRule] = useState(false);

  const handleCancel = useCallback(() => {
    log.debug('Cancel update');
    setCreateNewRule(false);
    setSelectedRuleId(undefined);
  }, []);

  const handleApply = useCallback(
    (rule, index) => {
      log.debug('Apply formatting', rule);
      setCreateNewRule(false);
      if (index === undefined) {
        onChange([...rules, rule]);
        return;
      }
      if (index < 0 || index >= rules.length) {
        log.error('Unable to update the rules, index out of bounds');
        return;
      }
      const updatedRules = [...rules];
      updatedRules[index] = rule;
      onChange(updatedRules);
    },
    [onChange, rules]
  );

  const handleAddClick = useCallback(() => {
    setCreateNewRule(true);
  }, []);

  const handleRuleClick = useCallback((e, rule, index) => {
    e.stopPropagation();
    log.debug('rule clicked', rule, index);
    setSelectedRuleId(index);
  }, []);

  const handleDeleteClick = useCallback(
    (e, rule, index) => {
      e.stopPropagation();
      log.debug('delete button clicked', rule, index);
      const updatedRules = [...rules];
      updatedRules.splice(index, 1);
      onChange(updatedRules);
    },
    [onChange, rules]
  );

  const handleDragHandlerClick = useCallback(e => {
    e.stopPropagation();
  }, []);

  const handleDragEnd = useCallback(
    result => {
      DragUtils.stopDragging();

      // if dropped outside the list
      if (!result.destination) {
        return;
      }
      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;
      const updatedRules = [...rules];
      const sourceInput = rules[sourceIndex];

      updatedRules.splice(sourceIndex, 1);
      updatedRules.splice(destinationIndex, 0, sourceInput);

      onChange(updatedRules);
    },
    [onChange, rules]
  );

  if (createNewRule || rules.length === 0 || selectedRuleId !== undefined) {
    return (
      <ConditionalFormattingEditor
        columns={columns}
        id={selectedRuleId}
        rule={
          selectedRuleId !== undefined
            ? rules[(selectedRuleId as unknown) as number]
            : undefined
        }
        onCancel={handleCancel}
        onApply={handleApply}
        disableCancel={rules.length === 0}
      />
    );
  }

  // Display list of rules
  return (
    <div className="conditional-formatting-rules">
      <DragDropContext
        onDragStart={DragUtils.startDragging}
        onDragEnd={handleDragEnd}
      >
        <Droppable droppableId="droppable-custom-columns">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...provided.droppableProps}
              className={classNames('droppable-container', {
                dragging: snapshot.draggingFromThisWith,
              })}
            >
              {rules.map((rule, index) => (
                <Draggable
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${index}-${rule.type}`}
                  draggableId={`${index}-${rule.type}`}
                  index={index}
                  disableInteractiveElementBlocking
                >
                  {
                    // eslint-disable-next-line @typescript-eslint/no-shadow
                    (provided, snapshot) => (
                      <div
                        role="menuitem"
                        tabIndex={0}
                        onClick={e => handleRuleClick(e, rule, index)}
                        className={classNames('draggable-container', {
                          dragging: snapshot.isDragging,
                        })}
                        ref={provided.innerRef}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...provided.draggableProps}
                      >
                        <div className="conditional-formatting-list-item">
                          <div className="formatting-item">
                            <div className="rule-title">
                              {(rule.config as ConditionConfig).column.name}{' '}
                              {rule.type === FormatterType.CONDITIONAL
                                ? `${getTextForConditionType(
                                    (rule.config as ConditionConfig).column
                                      .type,
                                    (rule.config as ConditionConfig).condition
                                  )} `
                                : null}
                              {rule.type === FormatterType.CONDITIONAL
                                ? (rule.config as ConditionConfig).value
                                : null}
                            </div>
                            <button
                              type="button"
                              className="btn btn-link btn-link-icon ml-1 px-2"
                              onClick={e => handleDeleteClick(e, rule, index)}
                            >
                              <Tooltip>Delete rule</Tooltip>
                              <FontAwesomeIcon icon={vsTrash} />
                            </button>

                            <button
                              type="button"
                              className="btn btn-link btn-link-icon px-2 btn-drag-handle"
                              onClick={handleDragHandlerClick}
                              // eslint-disable-next-line react/jsx-props-no-spreading
                              {...provided.dragHandleProps}
                            >
                              <Tooltip>Drag to re-order</Tooltip>
                              <FontAwesomeIcon icon={vsGripper} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  }
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <hr />
      <Button
        kind="ghost"
        onClick={handleAddClick}
        icon={dhNewCircleLargeFilled}
      >
        Add New Rule
      </Button>
    </div>
  );
};

export default ConditionalFormattingMenu;
