/**
 * Component map — maps UITree element type strings to React components.
 *
 * This is the bridge between the flat UITree JSON from the LLM and
 * actual Kumo React components. Each entry maps a type name (e.g. "Button")
 * to its React component import from @cloudflare/kumo.
 *
 * We use a deliberately loose type for the map values since this is a
 * dynamic rendering bridge — the LLM generates the props at runtime and
 * we cannot statically verify them. Error boundaries in UITreeRenderer
 * catch any runtime mismatches.
 */

import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Empty,
  Grid,
  Input,
  Link,
  Loader,
  Meter,
  Select,
  Surface,
  Switch,
  Table,
  Tabs,
  Text,
} from "@cloudflare/kumo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic rendering bridge
type AnyComponent = React.ComponentType<any>;

/**
 * Map of UITree type strings -> React components.
 *
 * Keys must match the `type` field in UIElement objects from the LLM.
 */
export const COMPONENT_MAP: Record<string, AnyComponent> = {
  // Layout
  Surface: Surface as AnyComponent,
  Grid: Grid as AnyComponent,

  // Content
  Text: Text as AnyComponent,
  Badge: Badge as AnyComponent,
  Banner: Banner as AnyComponent,

  // Interactive
  Button: Button as AnyComponent,
  Input: Input as AnyComponent,
  Checkbox: Checkbox as AnyComponent,
  Select: Select as AnyComponent,
  SelectOption: Select.Option as AnyComponent,
  Switch: Switch as AnyComponent,

  // Data display
  Table: Table as AnyComponent,
  TableHeader: Table.Header as AnyComponent,
  TableHead: Table.Head as AnyComponent,
  TableBody: Table.Body as AnyComponent,
  TableRow: Table.Row as AnyComponent,
  TableCell: Table.Cell as AnyComponent,
  TableFooter: Table.Footer as AnyComponent,
  Meter: Meter as AnyComponent,
  Tabs: Tabs as AnyComponent,

  // Navigation
  Link: Link as AnyComponent,

  // Feedback
  Loader: Loader as AnyComponent,
  Empty: Empty as AnyComponent,
};

/** Set of all registered component type names. */
export const KNOWN_TYPES = new Set(Object.keys(COMPONENT_MAP));
