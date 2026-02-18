export type { DemoScenario } from './types';
export { contactCardScenario } from './contact-card';
export { formDemoScenario } from './form-demo';
export { streamingDemoScenario } from './streaming-demo';
export { listDemoScenario } from './list-demo';

import { contactCardScenario } from './contact-card';
import { formDemoScenario } from './form-demo';
import { streamingDemoScenario } from './streaming-demo';
import { listDemoScenario } from './list-demo';

export const allScenarios = [
  contactCardScenario,
  formDemoScenario,
  streamingDemoScenario,
  listDemoScenario,
];
