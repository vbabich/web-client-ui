import React from 'react';

export type ConditionalFormattingMenuCallback = (rules: string[]) => void;

export type ModelColumn = {
  name: string;
  type: string;
};

export type ConditionalFormattingMenuProps = {
  columns: ModelColumn[];
  selectedColumn?: string;
  onChange?: ConditionalFormattingMenuCallback;
};

const ConditionalFormattingMenu = (
  props: ConditionalFormattingMenuProps
): JSX.Element => {
  const {
    columns,
    selectedColumn = undefined,
    onChange = () => undefined,
  } = props;
  const columnOptions = columns.map(({ name }) => (
    <option key={name} value={name}>
      {name}
    </option>
  ));

  const numberFormatConditions = [
    <option key="greater-than" value="greater-than">
      Greater Than
    </option>,
  ];
  return (
    <div>
      <div>
        <label>Apply to Column</label>
        <select
          value={selectedColumn}
          className="custom-select"
          onChange={event => {
            onChange([]);
          }}
        >
          {columnOptions}
        </select>
      </div>
      <div>
        <label>Format Cell If</label>
        <select
          value={undefined}
          className="custom-select"
          onChange={event => {
            onChange([]);
          }}
        >
          {numberFormatConditions}
        </select>
        <input
          type="text"
          className="form-control"
          placeholder="Enter value"
          value={50}
          onChange={event => {
            onChange([]);
          }}
        />
      </div>
    </div>
  );
};

export default ConditionalFormattingMenu;
