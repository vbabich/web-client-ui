import React from 'react';
import {
  tableOptionRendererRegistry,
  createCustomRenderedOption,
  hasCustomRendering,
  type CustomOptionRenderer,
} from './TableOptionRenderer';

describe('TableOptionRenderer', () => {
  beforeEach(() => {
    tableOptionRendererRegistry.clear();
  });

  describe('TableOptionRendererRegistry', () => {
    it('registers and retrieves custom renderers', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      const retrieved = tableOptionRendererRegistry.getRenderer('CUSTOM_TYPE');
      expect(retrieved).toBe(TestRenderer);
    });

    it('returns undefined for unregistered types', () => {
      const retrieved = tableOptionRendererRegistry.getRenderer(
        'NONEXISTENT'
      );
      expect(retrieved).toBeUndefined();
    });

    it('checks if renderer is registered with hasRenderer', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(true);
      expect(tableOptionRendererRegistry.hasRenderer('OTHER_TYPE')).toBe(false);
    });

    it('unregisters custom renderers', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(true);

      tableOptionRendererRegistry.unregisterRenderer('CUSTOM_TYPE');
      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(false);
    });

    it('retrieves all registered option types', () => {
      const TestRenderer1: CustomOptionRenderer = () => <div>Test1</div>;
      const TestRenderer2: CustomOptionRenderer = () => <div>Test2</div>;

      tableOptionRendererRegistry.registerRenderer('TYPE_1', TestRenderer1);
      tableOptionRendererRegistry.registerRenderer('TYPE_2', TestRenderer2);

      const registered = tableOptionRendererRegistry.getRegisteredTypes();
      expect(registered).toContain('TYPE_1');
      expect(registered).toContain('TYPE_2');
      expect(registered.length).toBe(2);
    });

    it('clears all registered renderers', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(true);

      tableOptionRendererRegistry.clear();
      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(false);
      expect(tableOptionRendererRegistry.getRegisteredTypes().length).toBe(0);
    });

    it('supports multiple renderers for different types', () => {
      const Renderer1: CustomOptionRenderer = () => <div>1</div>;
      const Renderer2: CustomOptionRenderer = () => <div>2</div>;
      const Renderer3: CustomOptionRenderer = () => <div>3</div>;

      tableOptionRendererRegistry.registerRenderer('TYPE_A', Renderer1);
      tableOptionRendererRegistry.registerRenderer('TYPE_B', Renderer2);
      tableOptionRendererRegistry.registerRenderer('TYPE_C', Renderer3);

      expect(tableOptionRendererRegistry.getRenderer('TYPE_A')).toBe(Renderer1);
      expect(tableOptionRendererRegistry.getRenderer('TYPE_B')).toBe(Renderer2);
      expect(tableOptionRendererRegistry.getRenderer('TYPE_C')).toBe(Renderer3);
    });

    it('allows re-registering the same type with a different renderer', () => {
      const Renderer1: CustomOptionRenderer = () => <div>1</div>;
      const Renderer2: CustomOptionRenderer = () => <div>2</div>;

      tableOptionRendererRegistry.registerRenderer('TYPE', Renderer1);
      expect(tableOptionRendererRegistry.getRenderer('TYPE')).toBe(Renderer1);

      tableOptionRendererRegistry.registerRenderer('TYPE', Renderer2);
      expect(tableOptionRendererRegistry.getRenderer('TYPE')).toBe(Renderer2);
    });
  });

  describe('createCustomRenderedOption', () => {
    it('creates extended option with renderer component', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      const baseOption = {
        type: 'CUSTOM',
        title: 'Custom Option',
      };

      const extended = createCustomRenderedOption(baseOption, TestRenderer);

      expect(extended.type).toBe('CUSTOM');
      expect(extended.title).toBe('Custom Option');
      expect(extended.renderComponent).toBe(TestRenderer);
      expect(extended.isCustomRendered).toBe(true);
    });

    it('includes custom data in extended option', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      const customData = { key: 'value', count: 42 };
      const baseOption = {
        type: 'CUSTOM',
        title: 'Custom Option',
      };

      const extended = createCustomRenderedOption(
        baseOption,
        TestRenderer,
        customData
      );

      expect(extended.customData).toEqual(customData);
    });

    it('preserves optional properties from base option', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      const baseOption = {
        type: 'CUSTOM',
        title: 'Custom Option',
        subtitle: 'This is a subtitle',
        icon: undefined,
      };

      const extended = createCustomRenderedOption(baseOption, TestRenderer);

      expect(extended.type).toBe('CUSTOM');
      expect(extended.title).toBe('Custom Option');
      expect(extended.subtitle).toBe('This is a subtitle');
      expect(extended.renderComponent).toBe(TestRenderer);
    });

    it('sets isCustomRendered flag correctly', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      const baseOption = {
        type: 'CUSTOM',
        title: 'Custom Option',
      };

      const extended = createCustomRenderedOption(baseOption, TestRenderer);

      expect(extended.isCustomRendered).toBe(true);
    });
  });

  describe('hasCustomRendering', () => {
    it('returns true when isCustomRendered is true', () => {
      const option = {
        type: 'CUSTOM' as any,
        title: 'Test',
        isCustomRendered: true,
      };

      expect(hasCustomRendering(option)).toBe(true);
    });

    it('returns true when renderComponent is provided', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      const option = {
        type: 'CUSTOM' as any,
        title: 'Test',
        renderComponent: TestRenderer,
      };

      expect(hasCustomRendering(option)).toBe(true);
    });

    it('returns true when both are provided', () => {
      const TestRenderer: CustomOptionRenderer = () => <div>Test</div>;
      const option = {
        type: 'CUSTOM' as any,
        title: 'Test',
        isCustomRendered: true,
        renderComponent: TestRenderer,
      };

      expect(hasCustomRendering(option)).toBe(true);
    });

    it('returns false when neither is provided', () => {
      const option = {
        type: 'STANDARD' as any,
        title: 'Test',
      };

      expect(hasCustomRendering(option)).toBe(false);
    });

    it('returns false when isCustomRendered is false', () => {
      const option = {
        type: 'CUSTOM' as any,
        title: 'Test',
        isCustomRendered: false,
      };

      expect(hasCustomRendering(option)).toBe(false);
    });
  });
});
