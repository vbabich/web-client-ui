import React from 'react';
import {
  tableOptionRendererRegistry,
  createCustomRenderedOption,
  hasCustomRendering,
} from './TableOptionRenderer';

function TestRenderer1(): JSX.Element {
  return <div>Test1</div>;
}

function TestRenderer2(): JSX.Element {
  return <div>Test2</div>;
}

function TestRenderer(): JSX.Element {
  return <div>Test</div>;
}

function Renderer1(): JSX.Element {
  return <div>1</div>;
}

function Renderer2(): JSX.Element {
  return <div>2</div>;
}

function Renderer3(): JSX.Element {
  return <div>3</div>;
}

describe('TableOptionRenderer', () => {
  beforeEach(() => {
    tableOptionRendererRegistry.clear();
  });

  describe('TableOptionRendererRegistry', () => {
    it('registers and retrieves custom renderers', () => {
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      const retrieved = tableOptionRendererRegistry.getRenderer('CUSTOM_TYPE');
      expect(retrieved).toBe(TestRenderer);
    });

    it('returns undefined for unregistered types', () => {
      const retrieved = tableOptionRendererRegistry.getRenderer('NONEXISTENT');
      expect(retrieved).toBeUndefined();
    });

    it('checks if renderer is registered with hasRenderer', () => {
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(true);
      expect(tableOptionRendererRegistry.hasRenderer('OTHER_TYPE')).toBe(false);
    });

    it('unregisters custom renderers', () => {
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(true);

      tableOptionRendererRegistry.unregisterRenderer('CUSTOM_TYPE');
      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(
        false
      );
    });

    it('retrieves all registered option types', () => {
      tableOptionRendererRegistry.registerRenderer('TYPE_1', TestRenderer1);
      tableOptionRendererRegistry.registerRenderer('TYPE_2', TestRenderer2);

      const registered = tableOptionRendererRegistry.getRegisteredTypes();
      expect(registered).toContain('TYPE_1');
      expect(registered).toContain('TYPE_2');
      expect(registered.length).toBe(2);
    });

    it('clears all registered renderers', () => {
      tableOptionRendererRegistry.registerRenderer('CUSTOM_TYPE', TestRenderer);

      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(true);

      tableOptionRendererRegistry.clear();
      expect(tableOptionRendererRegistry.hasRenderer('CUSTOM_TYPE')).toBe(
        false
      );
      expect(tableOptionRendererRegistry.getRegisteredTypes().length).toBe(0);
    });

    it('supports multiple renderers for different types', () => {
      tableOptionRendererRegistry.registerRenderer('TYPE_A', Renderer1);
      tableOptionRendererRegistry.registerRenderer('TYPE_B', Renderer2);
      tableOptionRendererRegistry.registerRenderer('TYPE_C', Renderer3);

      expect(tableOptionRendererRegistry.getRenderer('TYPE_A')).toBe(Renderer1);
      expect(tableOptionRendererRegistry.getRenderer('TYPE_B')).toBe(Renderer2);
      expect(tableOptionRendererRegistry.getRenderer('TYPE_C')).toBe(Renderer3);
    });

    it('allows re-registering the same type with a different renderer', () => {
      tableOptionRendererRegistry.registerRenderer('TYPE', Renderer1);
      expect(tableOptionRendererRegistry.getRenderer('TYPE')).toBe(Renderer1);

      tableOptionRendererRegistry.registerRenderer('TYPE', Renderer2);
      expect(tableOptionRendererRegistry.getRenderer('TYPE')).toBe(Renderer2);
    });
  });

  describe('createCustomRenderedOption', () => {
    it('creates extended option with renderer component', () => {
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
        type: 'CUSTOM',
        title: 'Test',
        isCustomRendered: true,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(hasCustomRendering(option as any)).toBe(true);
    });

    it('returns true when renderComponent is provided', () => {
      const option = {
        type: 'CUSTOM',
        title: 'Test',
        renderComponent: TestRenderer,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(hasCustomRendering(option as any)).toBe(true);
    });

    it('returns true when both are provided', () => {
      const option = {
        type: 'CUSTOM',
        title: 'Test',
        isCustomRendered: true,
        renderComponent: TestRenderer,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(hasCustomRendering(option as any)).toBe(true);
    });

    it('returns false when neither is provided', () => {
      const option = {
        type: 'STANDARD',
        title: 'Test',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(hasCustomRendering(option as any)).toBe(false);
    });

    it('returns false when isCustomRendered is false', () => {
      const option = {
        type: 'CUSTOM',
        title: 'Test',
        isCustomRendered: false,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(hasCustomRendering(option as any)).toBe(false);
    });
  });
});
