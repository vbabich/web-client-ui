/**
 * TableOptionRenderer - Registry for custom table option rendering
 *
 * Provides a mechanism to register and retrieve custom rendering components
 * for table options, enabling extensible option UI without modifying core component.
 */

import type React from 'react';
import type {
  ExtendedOptionItem,
  CustomOptionRenderProps,
} from '../CommonTypes';
import type OptionType from './OptionType';

/**
 * Custom renderer component type for table options
 */
export type CustomOptionRenderer = React.ComponentType<CustomOptionRenderProps>;

/**
 * Registry for storing custom option renderers
 * Maps option types to their custom rendering components
 */
class TableOptionRendererRegistry {
  private renderers: Map<string, CustomOptionRenderer> = new Map();

  /**
   * Register a custom renderer for a specific option type
   * @param optionType - The option type identifier (can be standard OptionType or custom string)
   * @param renderer - The React component to render
   */
  registerRenderer(
    optionType: string | OptionType,
    renderer: CustomOptionRenderer
  ): void {
    this.renderers.set(String(optionType), renderer);
  }

  /**
   * Unregister a custom renderer for a specific option type
   * @param optionType - The option type identifier
   */
  unregisterRenderer(optionType: string | OptionType): void {
    this.renderers.delete(String(optionType));
  }

  /**
   * Get the custom renderer for an option type, if registered
   * @param optionType - The option type identifier
   * @returns The registered renderer component, or undefined if not found
   */
  getRenderer(
    optionType: string | OptionType
  ): CustomOptionRenderer | undefined {
    return this.renderers.get(String(optionType));
  }

  /**
   * Check if a custom renderer is registered for an option type
   * @param optionType - The option type identifier
   * @returns true if a renderer is registered
   */
  hasRenderer(optionType: string | OptionType): boolean {
    return this.renderers.has(String(optionType));
  }

  /**
   * Get all registered option type identifiers
   * @returns Array of registered option type keys
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Clear all registered renderers
   * Useful for testing or resetting state
   */
  clear(): void {
    this.renderers.clear();
  }
}

/**
 * Global singleton instance of the renderer registry
 * Can be used to register custom renderers for any application
 */
export const tableOptionRendererRegistry = new TableOptionRendererRegistry();

/**
 * Helper function to create a custom option with a registered renderer
 * @param baseOption - The base option item (must have type and title)
 * @param renderComponent - The component to render
 * @param customData - Optional custom data for the renderer
 * @returns An ExtendedOptionItem with rendering configuration
 */
export function createCustomRenderedOption(
  baseOption: {
    type: string;
    title: string;
    subtitle?: string;
    icon?: unknown;
  },
  renderComponent: CustomOptionRenderer,
  customData?: Record<string, unknown>
): ExtendedOptionItem {
  const extended: ExtendedOptionItem = {
    // @ts-expect-error - Allow custom type strings for extensibility
    type: baseOption.type,
    title: baseOption.title,
    subtitle: baseOption.subtitle,
    // @ts-expect-error - Allow custom icon types for extensibility
    icon: baseOption.icon,
    renderComponent,
    customData,
    isCustomRendered: true,
  };
  return extended;
}

/**
 * Utility to check if an option has custom rendering
 * @param option - The option to check
 * @returns true if the option should use custom rendering
 */
export function hasCustomRendering(option: ExtendedOptionItem): boolean {
  return option.isCustomRendered === true || option.renderComponent != null;
}
