/**
 * @a2ui-bridge/react-kumo - Component mapping
 * Maps A2UI component type strings to Kumo adapter components.
 */

import type { ComponentMapping } from "@a2ui-bridge/react";

// Layout components
import { Row } from "./components/Row.js";
import { Column } from "./components/Column.js";
import { Card } from "./components/Card.js";
import { Divider } from "./components/Divider.js";
import { Separator } from "./components/Separator.js";
import { ScrollArea } from "./components/ScrollArea.js";
import { AspectRatio } from "./components/AspectRatio.js";
import { Flex } from "./components/Flex.js";
import { Grid } from "./components/Grid.js";
import { Center } from "./components/Center.js";
import { Box } from "./components/Box.js";
import { Container } from "./components/Container.js";

// Typography & Display
import { Text } from "./components/Text.js";
import { Badge } from "./components/Badge.js";
import { Label } from "./components/Label.js";
import { Link } from "./components/Link.js";
import { Image } from "./components/Image.js";
import { Avatar } from "./components/Avatar.js";
import { Skeleton } from "./components/Skeleton.js";
import { Title } from "./components/Title.js";
import { Code } from "./components/Code.js";
import { Blockquote } from "./components/Blockquote.js";

// Form inputs
import { Button } from "./components/Button.js";
import { Input } from "./components/Input.js";
import { TextField } from "./components/TextField.js";
import { TextArea } from "./components/TextArea.js";
import { Checkbox } from "./components/Checkbox.js";
import { Switch } from "./components/Switch.js";
import { Select } from "./components/Select.js";
import { RadioGroup } from "./components/RadioGroup.js";
import { Slider } from "./components/Slider.js";
import { ActionIcon } from "./components/ActionIcon.js";
import { MultiSelect } from "./components/MultiSelect.js";
import { NumberInput } from "./components/NumberInput.js";
import { DateTimeInput } from "./components/DateTimeInput.js";

// Feedback & Status
import { Alert } from "./components/Alert.js";
import { Progress } from "./components/Progress.js";
import { Spinner } from "./components/Spinner.js";
import { Toast } from "./components/Toast.js";
import { Tooltip } from "./components/Tooltip.js";

// Navigation
import { Tabs } from "./components/Tabs.js";
import { TabPanel } from "./components/TabPanel.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { Pagination } from "./components/Pagination.js";

// Data display
import { List } from "./components/List.js";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "./components/Table.js";

// Disclosure & Overlay
import { Accordion, AccordionItem } from "./components/Accordion.js";
import { Collapsible } from "./components/Collapsible.js";
import { Dialog } from "./components/Dialog.js";
import { Sheet } from "./components/Sheet.js";
import { Popover } from "./components/Popover.js";
import { DropdownMenu } from "./components/DropdownMenu.js";
import { HoverCard } from "./components/HoverCard.js";

// Fallback
import { Fallback } from "./components/Fallback.js";

/**
 * Kumo component mapping for A2UI.
 * Use this with the Root or Surface components from @a2ui-bridge/react.
 *
 * @example
 * ```tsx
 * import { Surface } from '@a2ui-bridge/react';
 * import { kumoComponents } from '@a2ui-bridge/react-kumo';
 *
 * <Surface
 *   processor={processor}
 *   components={kumoComponents}
 *   onAction={handleAction}
 * />
 * ```
 */
export const kumoComponents: ComponentMapping = {
  // Layout (12 + aliases)
  Row,
  Column,
  Card,
  Divider,
  Separator,
  ScrollArea,
  AspectRatio,
  Flex,
  Grid,
  Center,
  Box,
  Container,
  // Layout aliases
  HStack: Row,
  VStack: Column,
  Stack: Column,

  // Typography & Display (10)
  Text,
  Badge,
  Label,
  Link,
  Image,
  Avatar,
  Skeleton,
  Title,
  Code,
  Blockquote,
  // Typography aliases
  Heading: Title,
  H1: Title,
  H2: Title,
  H3: Title,
  H4: Title,
  H5: Title,
  H6: Title,

  // Form inputs (13)
  Button,
  Input,
  TextField,
  TextArea,
  Checkbox,
  Switch,
  Select,
  RadioGroup,
  Slider,
  ActionIcon,
  MultiSelect,
  NumberInput,
  DateTimeInput,
  // Form aliases
  IconButton: ActionIcon,
  TextInput: TextField,
  Textarea: TextArea,
  CheckBox: Checkbox,
  Toggle: Switch,

  // Feedback & Status (5)
  Alert,
  Progress,
  Spinner,
  Toast,
  Tooltip,
  // Feedback aliases
  Loader: Spinner,
  Loading: Spinner,
  Banner: Alert,
  Notification: Alert,

  // Navigation (4)
  Tabs,
  TabPanel,
  Breadcrumb,
  Pagination,
  // Navigation aliases
  Breadcrumbs: Breadcrumb,

  // Data display (6)
  List,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,

  // Disclosure & Overlay (8)
  Accordion,
  AccordionItem,
  Collapsible,
  Dialog,
  Sheet,
  Popover,
  DropdownMenu,
  HoverCard,
  // Overlay aliases
  Modal: Dialog,
  Drawer: Sheet,
  Menu: DropdownMenu,

  // Fallback for unknown components
  __fallback__: Fallback,
};

/**
 * Creates a component mapping with optional custom overrides.
 */
export function createComponentsWithFallback(
  customComponents?: Partial<ComponentMapping>,
): ComponentMapping {
  return {
    ...kumoComponents,
    ...customComponents,
  };
}

export { Fallback };
