/**
 * Demo message types - simplified format for demonstration purposes
 * These are converted to the proper A2UI protocol format by the demo infrastructure
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DemoMessage = Record<string, any>;

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  messages: DemoMessage[];
}
