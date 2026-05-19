import React, { useMemo } from 'react';
import { type IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { vsChevronRight } from '@deephaven/icons';
import './MenuItem.scss';

import UISwitch from '../UISwitch';

export type MenuItemDef = {
  title: string;
  subtitle?: string;
  icon?: IconProp;
  /** When true the item is visually dimmed and clicks are ignored. */
  disabled?: boolean;
  /** Tooltip text shown on hover (rendered as the native `title` attribute). */
  tooltip?: string;
};

export type SwitchMenuItemDef = MenuItemDef & {
  isOn: boolean;
  onChange: (isOn: boolean) => void;
};

function isSwitchMenuItemType(item: MenuItemDef): item is SwitchMenuItemDef {
  return (item as SwitchMenuItemDef).isOn !== undefined;
}

export type MenuItemProps = {
  item: MenuItemDef;
  onSelect?: () => void;
  'data-testid'?: string;
};

/**
 * @param props.item The menu item to set. Set a SwitchMenuItemDef to show a switch.
 * @param props.onSelect Called when the menu item is selected
 */
export function MenuItem({
  item,
  onSelect = () => undefined,
  'data-testid': dataTestId,
}: MenuItemProps): JSX.Element {
  const { icon, subtitle, title } = item;
  const { disabled = false, tooltip } = item;
  const handleSelect = useMemo(() => {
    if (disabled) {
      return () => {
        // no-op when disabled
      };
    }
    if (isSwitchMenuItemType(item)) {
      return () => {
        item.onChange(!item.isOn);
      };
    }
    return onSelect;
  }, [item, onSelect, disabled]);
  return (
    <div
      className={`btn btn-navigation-menu-item${disabled ? ' disabled' : ''}`}
      data-testid={`menu-item-${title}`}
      onClick={handleSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleSelect();
        }
      }}
      tabIndex={disabled ? -1 : 0}
      role="menuitem"
      aria-disabled={disabled || undefined}
      title={tooltip}
    >
      {icon !== undefined && (
        <div className="icon">
          <FontAwesomeIcon icon={icon} />
        </div>
      )}
      <div className="title">{title}</div>
      {subtitle !== undefined && <div className="shortcut">{subtitle}</div>}
      <div className="accessory" data-testid={dataTestId}>
        {isSwitchMenuItemType(item) ? (
          <UISwitch
            on={item.isOn}
            onClick={event => {
              event.stopPropagation();
              handleSelect();
            }}
          />
        ) : (
          <FontAwesomeIcon icon={vsChevronRight} />
        )}
      </div>
    </div>
  );
}

export default MenuItem;
