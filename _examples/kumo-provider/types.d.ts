/**
 * TypeScript definitions for Cloudflare Kumo Provider
 * Cross-boundary component rendering for generative UI
 */

declare global {
  interface Window {
    CloudflareKumo: CloudflareKumoAPI;
  }
}

/**
 * Main API exposed on window.CloudflareKumo
 */
export interface CloudflareKumoAPI {
  /**
   * Set the theme for all rendered components
   * @param mode - 'light' or 'dark'
   */
  setTheme(mode: 'light' | 'dark'): void;

  /**
   * Render a component from a JSON definition (recommended for generative UI)
   * @param jsonDef - Component definition in JSON format
   * @param containerId - DOM element ID to render into
   */
  renderFromJSON(jsonDef: ComponentJSON, containerId: string): void;

  /**
   * Render a component by name with props (legacy method)
   * @param name - Component name (Button, Input, Select, LayerCard)
   * @param props - Component props
   * @param containerId - DOM element ID to render into
   */
  render(name: ComponentName, props: ComponentProps, containerId: string): void;
}

/**
 * Available component names
 */
export type ComponentName = 'Button' | 'Input' | 'Select' | 'LayerCard';

/**
 * Component JSON definition structure
 */
export type ComponentJSON = 
  | string
  | ButtonJSON
  | InputJSON
  | SelectJSON
  | LayerCardJSON;

/**
 * Base component definition
 */
interface BaseComponentJSON<T extends ComponentName> {
  component: T;
  props: ComponentProps;
}

/**
 * Button component JSON
 */
export interface ButtonJSON extends BaseComponentJSON<'Button'> {
  props: ButtonProps;
}

export interface ButtonProps {
  children: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  onClick?: () => void;
}

/**
 * Input component JSON
 */
export interface InputJSON extends BaseComponentJSON<'Input'> {
  props: InputProps;
}

export interface InputProps {
  label?: string;
  placeholder?: string;
  className?: string;
  onChange?: (e: Event) => void;
}

/**
 * Select component JSON
 */
export interface SelectJSON extends BaseComponentJSON<'Select'> {
  props: SelectProps;
}

export interface SelectProps {
  label?: string;
  placeholder?: string;
  className?: string;
  options: SelectOption[];
  onValueChange?: (value: string) => void;
}

export interface SelectOption {
  label: string;
  value: string;
}

/**
 * LayerCard component JSON (supports nested components)
 */
export interface LayerCardJSON extends BaseComponentJSON<'LayerCard'> {
  props: LayerCardProps;
}

export interface LayerCardProps {
  className?: string;
  primaryClassName?: string;
  primary?: ComponentJSON | ComponentJSON[] | string;
  secondary?: ComponentJSON | ComponentJSON[] | string;
}

/**
 * Union of all component props
 */
export type ComponentProps = 
  | ButtonProps 
  | InputProps 
  | SelectProps 
  | LayerCardProps;

/**
 * Example usage in TypeScript:
 * 
 * ```typescript
 * const componentJSON: ComponentJSON = {
 *   component: 'LayerCard',
 *   props: {
 *     secondary: 'Configuration',
 *     primary: [
 *       {
 *         component: 'Input',
 *         props: { label: 'Name', placeholder: 'Enter name' }
 *       },
 *       {
 *         component: 'Button',
 *         props: { children: 'Submit', variant: 'primary' }
 *       }
 *     ]
 *   }
 * };
 * 
 * window.CloudflareKumo.renderFromJSON(componentJSON, 'container-id');
 * ```
 */
