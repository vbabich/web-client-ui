import React, { useRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import dh from '@deephaven/jsapi-shim';
import { DateUtils, type Settings } from '@deephaven/jsapi-utils';
import { TestUtils } from '@deephaven/test-utils';
import { type TypeValue } from '@deephaven/filters';
import {
  type ExpandableColumnGridModel,
  isExpandableColumnGridModel,
} from '@deephaven/grid';
import IrisGrid from './IrisGrid';
import IrisGridTestUtils from './IrisGridTestUtils';
import type IrisGridProxyModel from './IrisGridProxyModel';

jest.mock('@deephaven/grid', () => ({
  ...jest.requireActual('@deephaven/grid'),
  isExpandableColumnGridModel: jest.fn(),
}));

const { asMock } = TestUtils;

const VIEW_SIZE = 500;

const DEFAULT_SETTINGS: Settings = {
  timeZone: 'America/New_York',
  defaultDateTimeFormat: DateUtils.FULL_DATE_FORMAT,
  showTimeZone: false,
  showTSeparator: true,
  formatter: [],
  truncateNumbersWithPound: false,
};

const irisGridTestUtils = new IrisGridTestUtils(dh);

jest
  .spyOn(Element.prototype, 'getBoundingClientRect')
  .mockReturnValue(new DOMRect(0, 0, VIEW_SIZE, VIEW_SIZE));

jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_SIZE);

jest.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(VIEW_SIZE);

function makeComponent(
  model = irisGridTestUtils.makeModel(),
  settings = DEFAULT_SETTINGS,
  props = {}
) {
  let ref: React.RefObject<IrisGrid>;
  function IrisGridWithRef() {
    ref = useRef<IrisGrid>(null);
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <IrisGrid model={model} settings={settings} ref={ref} {...props} />;
  }
  render(<IrisGridWithRef />);
  return ref!.current!;
}

function keyDown(
  key: string,
  component: IrisGrid,
  extraArgs?: Partial<KeyboardEventInit>
) {
  const args = { key, ...extraArgs };
  fireEvent.keyDown(component.grid!.canvas!, args);
}

it('renders without crashing', () => {
  makeComponent();
});

it('handles ctrl+shift+e to clear filters', () => {
  const component = makeComponent();

  component.clearAllFilters = jest.fn();

  keyDown('e', component);
  keyDown('e', component, { ctrlKey: true });
  keyDown('e', component, { shiftKey: true });

  expect(component.clearAllFilters).not.toHaveBeenCalled();

  keyDown('e', component, { ctrlKey: true, shiftKey: true });

  expect(component.clearAllFilters).toHaveBeenCalled();
});

it('handles reverse key shortcut', () => {
  const component = makeComponent();

  component.reverse = jest.fn();

  keyDown('i', component);

  expect(component.reverse).not.toHaveBeenCalled();

  keyDown('i', component, { ctrlKey: true });

  expect(component.reverse).toHaveBeenCalled();
});

it('handles copy key handler', () => {
  const component = makeComponent();

  component.copyRanges = jest.fn();

  keyDown('c', component);

  expect(component.copyRanges).not.toHaveBeenCalled();

  keyDown('c', component, { ctrlKey: true });

  expect(component.copyRanges).toHaveBeenCalled();
});

it('handles value: undefined in setFilterMap, clears column filter', () => {
  const component = makeComponent();
  component.setQuickFilter = jest.fn();
  component.removeQuickFilter = jest.fn();
  component.setFilterMap(
    new Map([
      [
        '2',
        {
          columnType: IrisGridTestUtils.DEFAULT_TYPE,
          filterList: [
            {
              operator: 'eq',
              text: 'any',
              value: undefined,
              startColumnIndex: 0,
            },
          ],
        },
      ],
    ])
  );
  expect(component.setQuickFilter).not.toHaveBeenCalled();
  expect(component.removeQuickFilter).toHaveBeenCalledWith(2);
});

it('handles value: null in setFilterMap', () => {
  const component = makeComponent();
  component.setQuickFilter = jest.fn();
  component.setFilterMap(
    new Map([
      [
        '2',
        {
          columnType: IrisGridTestUtils.DEFAULT_TYPE,
          filterList: [
            { operator: 'eq', text: 'null', value: null, startColumnIndex: 0 },
          ],
        },
      ],
    ])
  );
  expect(component.setQuickFilter).toHaveBeenCalledWith(
    2,
    expect.anything(),
    '=null'
  );
});

it('handles undefined operator, should default to eq', () => {
  const component = makeComponent();
  component.setQuickFilter = jest.fn();
  component.setFilterMap(
    new Map([
      [
        '2',
        {
          columnType: IrisGridTestUtils.DEFAULT_TYPE,
          filterList: [
            {
              operator: undefined as unknown as TypeValue,
              text: 'any',
              value: 'any',
              startColumnIndex: 0,
            },
          ],
        },
      ],
    ])
  );
  expect(component.setQuickFilter).toHaveBeenCalledWith(
    2,
    expect.anything(),
    'any'
  );
});

it('should set gotoValueSelectedColumnName to empty string if no columns are given', () => {
  const component = makeComponent(
    irisGridTestUtils.makeModel(
      irisGridTestUtils.makeTable({
        columns: [],
      })
    )
  );

  expect(component.state.gotoValueSelectedColumnName).toEqual('');
});

describe('handleResizeColumn', () => {
  let irisGrid;
  let metricCalculator;

  beforeAll(() => {
    irisGrid = makeComponent(
      irisGridTestUtils.makeModel(
        irisGridTestUtils.makeTable({
          columns: irisGridTestUtils.makeColumns(1),
        })
      )
    );
    metricCalculator = irisGrid.state.metricCalculator;
  });

  it('should set column width to content width if undefined user width', async () => {
    const modelIndex = 0;
    const mockMetricCalculator = {
      ...metricCalculator,
      userColumnWidths: new Map(),
      setColumnWidth: jest.fn((column, size) => {
        mockMetricCalculator.userColumnWidths.set(column, size);
      }),
    };
    Object.assign(irisGrid.state.metricCalculator, mockMetricCalculator);
    const contentWidth =
      irisGrid.state.metrics.contentColumnWidths.get(modelIndex);
    expect(contentWidth).toBeDefined();

    act(() => irisGrid.handleResizeColumn(modelIndex));

    expect(mockMetricCalculator.userColumnWidths.get(modelIndex)).toEqual(
      contentWidth
    );
  });

  it('should reset user width & set calculated width to content width if column has defined user width', () => {
    const modelIndex = 0;
    const mockMetricCalculator = {
      ...metricCalculator,
      userColumnWidths: new Map([[modelIndex, 100]]),
      setCalculatedColumnWidth: jest.fn((column, size) => {
        mockMetricCalculator.calculatedColumnWidths.set(column, size);
      }),
      resetColumnWidth: jest.fn(() => {
        mockMetricCalculator.userColumnWidths.delete(modelIndex);
      }),
    };
    Object.assign(irisGrid.state.metricCalculator, mockMetricCalculator);
    const contentWidth =
      irisGrid.state.metrics.contentColumnWidths.get(modelIndex);
    expect(contentWidth).toBeDefined();

    act(() => irisGrid.handleResizeColumn(modelIndex));

    expect(
      mockMetricCalculator.userColumnWidths.get(modelIndex)
    ).toBeUndefined();
    expect(mockMetricCalculator.calculatedColumnWidths.get(modelIndex)).toEqual(
      contentWidth
    );
  });
});

// auto resize -> reset user width and set calculated width to content width
// manual resize -> set user width to content width
describe('handleResizeAllColumns', () => {
  let irisGrid;
  let metricCalculator;

  beforeAll(() => {
    irisGrid = makeComponent(
      irisGridTestUtils.makeModel(
        irisGridTestUtils.makeTable({
          columns: irisGridTestUtils.makeColumns(3),
        })
      )
    );
    metricCalculator = irisGrid.state.metricCalculator;
  });

  it('should auto resize all columns if all were manually sized', () => {
    const mockMetricCalculator = {
      ...metricCalculator,
      userColumnWidths: new Map([
        [0, 100],
        [1, 100],
        [2, 100],
      ]),
      setCalculatedColumnWidth: jest.fn((column, size) => {
        mockMetricCalculator.calculatedColumnWidths.set(column, size);
      }),
      resetColumnWidth: jest.fn(column => {
        mockMetricCalculator.userColumnWidths.delete(column);
      }),
    };
    Object.assign(irisGrid.state.metricCalculator, mockMetricCalculator);
    const contentWidths = irisGrid.state.metrics.contentColumnWidths;

    act(() => irisGrid.handleResizeAllColumns());

    expect(mockMetricCalculator.userColumnWidths.size).toEqual(0);

    contentWidths.forEach((contentWidth, modelIndex) => {
      expect(
        mockMetricCalculator.calculatedColumnWidths.get(modelIndex)
      ).toEqual(contentWidth);
    });
  });

  it('should manual resize all columns if not all were manually sized', () => {
    const mockMetricCalculator = {
      ...metricCalculator,
      userColumnWidths: new Map([
        [0, 100],
        [1, 100],
      ]),
      setColumnWidth: jest.fn((column, size) => {
        mockMetricCalculator.userColumnWidths.set(column, size);
      }),
      resetColumnWidth: jest.fn(column => {
        mockMetricCalculator.userColumnWidths.delete(column);
      }),
    };
    Object.assign(irisGrid.state.metricCalculator, mockMetricCalculator);
    const contentWidths = irisGrid.state.metrics.contentColumnWidths;

    act(() => irisGrid.handleResizeAllColumns());

    contentWidths.forEach((contentWidth, modelIndex) => {
      expect(mockMetricCalculator.userColumnWidths.get(modelIndex)).toEqual(
        contentWidth
      );
    });
  });

  describe('rebuildFilters', () => {
    it('updates state if filters not empty', () => {
      const component = makeComponent(undefined, undefined, {
        quickFilters: [
          [
            '2',
            {
              columnType: IrisGridTestUtils.DEFAULT_TYPE,
              filterList: [
                {
                  operator: 'eq',
                  text: 'null',
                  value: null,
                  startColumnIndex: 0,
                },
              ],
            },
          ],
        ],
      });
      jest.spyOn(component, 'setState');
      expect(component.setState).not.toBeCalled();
      act(() => {
        component.rebuildFilters();
      });
      expect(component.setState).toBeCalled();
    });

    it('does not update state for empty filters', () => {
      const component = makeComponent();
      jest.spyOn(component, 'setState');
      act(() => {
        component.rebuildFilters();
      });
      expect(component.setState).not.toBeCalled();
    });
  });

  describe('column expand/collapse', () => {
    let model: IrisGridProxyModel & ExpandableColumnGridModel;
    let component: IrisGrid;

    beforeEach(() => {
      model = irisGridTestUtils.makeModel() as IrisGridProxyModel &
        ExpandableColumnGridModel;
      component = makeComponent(model);
      model.setColumnExpanded = jest.fn();
      model.isColumnExpanded = jest.fn(() => false);
      model.expandAllColumns = jest.fn();
      model.collapseAllColumns = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('calls setColumnExpanded if model supports expandable columns', () => {
      asMock(isExpandableColumnGridModel).mockReturnValue(true);
      model.hasExpandableColumns = true;
      component.toggleExpandColumn(0);
      expect(model.setColumnExpanded).toHaveBeenCalled();
    });

    it('ignores setColumnExpanded and expand/collapse all if model does not support expandable columns', () => {
      asMock(isExpandableColumnGridModel).mockReturnValue(false);
      component.toggleExpandColumn(0);
      expect(model.setColumnExpanded).not.toHaveBeenCalled();

      component.expandAllColumns();
      expect(model.expandAllColumns).not.toHaveBeenCalled();

      component.collapseAllColumns();
      expect(model.collapseAllColumns).not.toHaveBeenCalled();
    });

    it('calls expandAllColumns if model supports expandable columns and expand all', () => {
      asMock(isExpandableColumnGridModel).mockReturnValue(true);
      model.isExpandAllColumnsAvailable = true;
      component.expandAllColumns();
      expect(model.expandAllColumns).toHaveBeenCalled();

      component.collapseAllColumns();
      expect(model.collapseAllColumns).toHaveBeenCalled();
    });

    it('ignores expandAllColumns if model does not support expand all', () => {
      asMock(isExpandableColumnGridModel).mockReturnValue(true);
      model.isExpandAllColumnsAvailable = false;

      component.expandAllColumns();
      expect(model.expandAllColumns).not.toHaveBeenCalled();

      component.collapseAllColumns();
      expect(model.collapseAllColumns).not.toHaveBeenCalled();
    });
  });
});

describe('Advanced Filter', () => {
  it.each([
    { columnIndex: -1, expectedVisibility: false },
    { columnIndex: 0, expectedVisibility: true },
    { columnIndex: 1, expectedVisibility: true },
  ])(
    'advanced filter button visibility is $expectedVisibility for column index $columnIndex',
    ({ columnIndex, expectedVisibility }) => {
      const model = irisGridTestUtils.makeModel();
      const ref = React.createRef<IrisGrid>();
      const { container } = render(
        <IrisGrid ref={ref} model={model} settings={DEFAULT_SETTINGS} />
      );

      act(() => {
        ref.current?.setState({
          focusedFilterBarColumn: columnIndex,
          isFilterBarShown: true,
        });
      });

      const advancedFilterButtons = container.querySelectorAll(
        '.advanced-filter-button'
      );

      expect(advancedFilterButtons.length > 0).toBe(expectedVisibility);
    }
  );
});

describe('Table Options Extensibility', () => {
  const makeTestModel = () => irisGridTestUtils.makeModel();

  describe('tableOptionsConfig prop', () => {
    it('shows all built-in options by default when tableOptionsConfig is undefined', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      render(<IrisGrid ref={ref} model={model} settings={DEFAULT_SETTINGS} />);

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        undefined, // tableOptionsConfig - not provided
        undefined // customTableOptions - not provided
      );

      // Should have all built-in options available
      expect(optionItems.length).toBeGreaterThan(8);
    });

    it('hides options when tableOptionsConfig explicitly sets them to false', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const tableOptionsConfig = {
        chartBuilder: false,
        customColumns: false,
        downloadCsv: false,
      };
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          tableOptionsConfig={tableOptionsConfig}
        />
      );

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        tableOptionsConfig,
        undefined // customTableOptions
      );

      // Should not have chart builder, custom columns, or download CSV
      const typeStrings = optionItems.map(item => item.type);
      expect(typeStrings).not.toContain('CHART_BUILDER');
      expect(typeStrings).not.toContain('CUSTOM_COLUMN_BUILDER');
      expect(typeStrings).not.toContain('TABLE_EXPORTER');
    });

    it('shows options when tableOptionsConfig explicitly sets them to true', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const tableOptionsConfig = {
        chartBuilder: true,
        customColumns: true,
        downloadCsv: true,
      };
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          tableOptionsConfig={tableOptionsConfig}
        />
      );

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        tableOptionsConfig,
        undefined // customTableOptions
      );

      // Should have chart builder, custom columns, and download CSV
      const typeStrings = optionItems.map(item => item.type);
      expect(typeStrings).toContain('CHART_BUILDER');
      expect(typeStrings).toContain('CUSTOM_COLUMN_BUILDER');
      expect(typeStrings).toContain('TABLE_EXPORTER');
    });

    it('respects partial configuration with mixed true/false/undefined values', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const tableOptionsConfig = {
        chartBuilder: false, // explicitly hide
        customColumns: true, // explicitly show
        downloadCsv: undefined, // use default (show)
        // organizeColumns not specified (use default - show)
      };
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          tableOptionsConfig={tableOptionsConfig}
        />
      );

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        tableOptionsConfig,
        undefined // customTableOptions
      );

      const typeStrings = optionItems.map(item => item.type);
      expect(typeStrings).not.toContain('CHART_BUILDER');
      expect(typeStrings).toContain('CUSTOM_COLUMN_BUILDER');
      expect(typeStrings).toContain('TABLE_EXPORTER');
      expect(typeStrings).toContain('VISIBILITY_ORDERING_BUILDER');
    });
  });

  describe('customTableOptions prop', () => {
    it('adds custom options to the menu when customTableOptions prop is provided', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const customOptions = [
        {
          type: 'CUSTOM_OPTION_1' as any,
          title: 'Custom Report',
          icon: undefined,
        },
        {
          type: 'CUSTOM_OPTION_2' as any,
          title: 'Export Settings',
          icon: undefined,
        },
      ];
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          customTableOptions={customOptions}
        />
      );

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        undefined, // tableOptionsConfig
        customOptions
      );

      // Should include custom options
      expect(optionItems).toContainEqual(customOptions[0]);
      expect(optionItems).toContainEqual(customOptions[1]);
    });

    it('appends custom options after built-in options', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const customOptions = [
        {
          type: 'CUSTOM_OPTION_1' as any,
          title: 'Custom Report',
          icon: undefined,
        },
      ];
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          customTableOptions={customOptions}
        />
      );

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        undefined, // tableOptionsConfig
        customOptions
      );

      // Custom option should be at the end
      const lastOption = optionItems[optionItems.length - 1];
      expect(lastOption.title).toBe('Custom Report');
    });

    it('does not add custom options if customTableOptions is empty', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          customTableOptions={[]}
        />
      );

      const component = ref.current!;
      const optionItemsWithEmpty = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        undefined, // tableOptionsConfig
        []
      );

      const optionItemsWithoutCustom = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        undefined, // tableOptionsConfig
        undefined
      );

      expect(optionItemsWithEmpty.length).toBe(optionItemsWithoutCustom.length);
    });
  });

  describe('onCustomTableOptionSelect callback', () => {
    it('invokes onCustomTableOptionSelect when a custom option is selected', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const onCustomTableOptionSelect = jest.fn();
      const customOptions = [
        {
          type: 'CUSTOM_OPTION_1' as any,
          title: 'Custom Report',
          icon: undefined,
        },
      ];
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          customTableOptions={customOptions}
          onCustomTableOptionSelect={onCustomTableOptionSelect}
        />
      );

      const component = ref.current!;
      component.handleMenuSelect(customOptions[0]);

      expect(onCustomTableOptionSelect).toHaveBeenCalledWith(customOptions[0]);
      // Should NOT add to openOptions since it's custom
      expect(component.state.openOptions.length).toBe(0);
    });

    it('handles built-in options normally when handleMenuSelect is called', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      render(<IrisGrid ref={ref} model={model} settings={DEFAULT_SETTINGS} />);

      const component = ref.current!;
      const builtInOption = {
        type: 'CHART_BUILDER' as any,
        title: 'Chart Builder',
        icon: undefined,
      };

      component.handleMenuSelect(builtInOption);

      // Built-in option should be added to openOptions
      expect(component.state.openOptions).toContainEqual(builtInOption);
    });

    it('does not invoke callback if onCustomTableOptionSelect is not provided', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const customOptions = [
        {
          type: 'CUSTOM_OPTION_1' as any,
          title: 'Custom Report',
          icon: undefined,
        },
      ];
      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          customTableOptions={customOptions}
          // onCustomTableOptionSelect not provided
        />
      );

      const component = ref.current!;
      // Should not throw error
      expect(() => {
        component.handleMenuSelect(customOptions[0]);
      }).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('renders with all options visible when no new props are provided', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      render(<IrisGrid ref={ref} model={model} settings={DEFAULT_SETTINGS} />);

      const component = ref.current!;
      const optionItems = component.getCachedOptionItems(
        true, // isChartBuilderAvailable
        true, // isCustomColumnsAvailable
        true, // isFormatColumnsAvailable
        true, // isOrganizeColumnsAvailable
        true, // isRollupAvailable
        true, // isTotalsAvailable
        true, // isSelectDistinctAvailable
        true, // isExportAvailable
        component.toggleFilterBarAction,
        component.toggleSearchBarAction,
        component.toggleGotoRowAction,
        false, // isFilterBarShown
        false, // showSearchBar
        true, // canDownloadCsv
        true, // canToggleSearch
        false, // showGotoRow
        true, // hasAdvancedSettings
        undefined, // tableOptionsConfig - not provided
        undefined // customTableOptions - not provided
      );

      // Should have all built-in options
      const typeStrings = optionItems.map(item => item.type);
      expect(typeStrings).toContain('CHART_BUILDER');
      expect(typeStrings).toContain('CUSTOM_COLUMN_BUILDER');
      expect(typeStrings).toContain('VISIBILITY_ORDERING_BUILDER');
      expect(typeStrings).toContain('CONDITIONAL_FORMATTING');
      expect(typeStrings).toContain('ROLLUP_ROWS');
      expect(typeStrings).toContain('AGGREGATIONS');
      expect(typeStrings).toContain('SELECT_DISTINCT');
      expect(typeStrings).toContain('TABLE_EXPORTER');
    });

    it('existing menu selection behavior works for built-in options', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      render(<IrisGrid ref={ref} model={model} settings={DEFAULT_SETTINGS} />);

      const component = ref.current!;
      const builtInOption = {
        type: 'CHART_BUILDER' as any,
        title: 'Chart Builder',
        icon: undefined,
      };

      component.handleMenuSelect(builtInOption);

      // Should behave as before - add to openOptions
      expect(component.state.openOptions).toContainEqual(builtInOption);
    });
  });

  describe('Custom option rendering (Phase 3)', () => {
    it('accepts extendedCustomTableOptions with custom rendering components', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const CustomComponent: React.ComponentType<any> = () => (
        <div>Custom Render</div>
      );
      const extendedOptions = [
        {
          type: 'CUSTOM_RENDER' as any,
          title: 'Custom Rendered Option',
          renderComponent: CustomComponent,
          customData: { key: 'value' },
          isCustomRendered: true,
        },
      ];

      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          extendedCustomTableOptions={extendedOptions}
        />
      );

      const component = ref.current!;
      expect(component).toBeDefined();
      // Props accepted without error
      expect(component.props.extendedCustomTableOptions).toEqual(
        extendedOptions
      );
    });

    it('accepts customOptionRenderers mapping', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const CustomRenderer: React.ComponentType<any> = () => (
        <div>Rendered</div>
      );
      const renderers = new Map([['CUSTOM_TYPE', CustomRenderer]]);

      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          customOptionRenderers={renderers}
        />
      );

      const component = ref.current!;
      expect(component.props.customOptionRenderers).toEqual(renderers);
    });

    it('supports combining extendedCustomTableOptions with customTableOptions', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const CustomComponent: React.ComponentType<any> = () => <div>Custom</div>;

      const extendedOptions = [
        {
          type: 'EXTENDED_CUSTOM' as any,
          title: 'Extended Option',
          renderComponent: CustomComponent,
          isCustomRendered: true,
        },
      ];

      const simpleOptions = [
        {
          type: 'SIMPLE_CUSTOM' as any,
          title: 'Simple Custom Option',
        },
      ];

      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          extendedCustomTableOptions={extendedOptions}
          customTableOptions={simpleOptions}
        />
      );

      const component = ref.current!;
      expect(component.props.extendedCustomTableOptions).toEqual(
        extendedOptions
      );
      expect(component.props.customTableOptions).toEqual(simpleOptions);
    });

    it('supports full extensibility with all Phase 3 props combined', () => {
      const model = makeTestModel();
      const ref = React.createRef<IrisGrid>();
      const CustomRenderer: React.ComponentType<any> = () => (
        <div>Rendered</div>
      );
      const renderers = new Map([['CUSTOM_TYPE', CustomRenderer]]);
      const tableConfig = { chartBuilder: false };
      const simpleOptions = [{ type: 'SIMPLE' as any, title: 'Simple' }];
      const extendedOptions = [
        {
          type: 'EXTENDED' as any,
          title: 'Extended',
          renderComponent: CustomRenderer,
          isCustomRendered: true,
        },
      ];
      const onSelect = jest.fn();

      render(
        <IrisGrid
          ref={ref}
          model={model}
          settings={DEFAULT_SETTINGS}
          tableOptionsConfig={tableConfig}
          customTableOptions={simpleOptions}
          onCustomTableOptionSelect={onSelect}
          extendedCustomTableOptions={extendedOptions}
          customOptionRenderers={renderers}
        />
      );

      const component = ref.current!;
      expect(component.props.tableOptionsConfig).toEqual(tableConfig);
      expect(component.props.customTableOptions).toEqual(simpleOptions);
      expect(component.props.onCustomTableOptionSelect).toEqual(onSelect);
      expect(component.props.extendedCustomTableOptions).toEqual(
        extendedOptions
      );
      expect(component.props.customOptionRenderers).toEqual(renderers);
    });
  });
});
