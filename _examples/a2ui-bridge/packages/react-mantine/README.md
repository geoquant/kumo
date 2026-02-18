# @a2ui-bridge/react-mantine

Mantine UI component implementations for A2UI Bridge. This package provides 70+ beautifully designed components with built-in dark mode support.

## Installation

```bash
npm install @a2ui-bridge/core @a2ui-bridge/react @a2ui-bridge/react-mantine @mantine/core @mantine/hooks
```

### Setup MantineProvider

Wrap your app with MantineProvider:

```tsx
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

function App() {
  return (
    <MantineProvider>
      {/* Your app */}
    </MantineProvider>
  );
}
```

## Usage

```tsx
import { Surface, useA2uiProcessor } from '@a2ui-bridge/react';
import { mantineComponents } from '@a2ui-bridge/react-mantine';

function App() {
  const processor = useA2uiProcessor();

  return (
    <Surface
      processor={processor}
      components={mantineComponents}
      onAction={(action) => console.log('Action:', action)}
    />
  );
}
```

## Components

### Layout

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Row` | `Group`, `HStack` | Horizontal flex layout |
| `Column` | `Stack`, `VStack` | Vertical flex layout |
| `Flex` | - | Flexible box layout |
| `Grid` | `SimpleGrid` | Grid layout system |
| `Center` | - | Centers content |
| `Box` | - | Generic container |
| `Container` | - | Responsive container |
| `Space` | - | Adds spacing |

### Surfaces

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Card` | - | Elevated container |
| `Paper` | `Section`, `Panel` | Flat surface |
| `Divider` | `Separator` | Visual separator |
| `ScrollArea` | - | Scrollable container |
| `Fieldset` | - | Grouped form fields |

### Typography

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Text` | `Paragraph`, `Label` | Body text with variants |
| `Title` | `Heading`, `H1`-`H6` | Headings |
| `Code` | - | Code snippets |
| `Blockquote` | - | Quoted text |
| `Highlight` | - | Highlighted text |

Text supports `usageHint` for styling:

| usageHint | Style |
|-----------|-------|
| `h1` | Extra large heading |
| `h2` | Large heading |
| `h3` | Medium heading |
| `body` | Body text |
| `caption` | Small, muted text |
| `label` | Form label |

### Inputs

| Component | Aliases | Description |
|-----------|---------|-------------|
| `TextField` | `TextInput` | Single-line text input |
| `TextArea` | `Textarea` | Multi-line text input |
| `NumberInput` | `Number` | Numeric input |
| `PasswordInput` | `Password` | Password field |
| `DateTimeInput` | `DatePicker`, `DateInput` | Date/time picker |
| `ColorInput` | `Color` | Color picker |
| `FileInput` | `File` | File upload |
| `PinInput` | `OTP`, `PIN` | PIN/OTP entry |

### Selection

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Checkbox` | `CheckBox` | Single checkbox |
| `Switch` | `Toggle` | Toggle switch |
| `RadioGroup` | `Radio` | Radio button group |
| `Select` | `Dropdown`, `ComboBox` | Single select dropdown |
| `MultiSelect` | `MultiDropdown` | Multi-select dropdown |
| `SegmentedControl` | `ButtonGroup` | Segmented buttons |
| `Chip` | - | Selectable chip |

### Feedback

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Alert` | `Message`, `Banner` | Alert messages |
| `Notification` | `Toast` | Notifications |
| `Progress` | `ProgressBar` | Linear progress |
| `RingProgress` | `CircularProgress` | Circular progress |
| `Spinner` | `Loader`, `Loading` | Loading spinner |
| `Skeleton` | - | Loading placeholder |

### Overlays

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Modal` | `Dialog` | Modal dialog |
| `Drawer` | `Sidebar` | Slide-out panel |
| `Tooltip` | - | Hover tooltip |
| `Popover` | `Popup` | Click popover |
| `Menu` | - | Dropdown menu |

### Navigation

| Component | Aliases | Description |
|-----------|---------|-------------|
| `TabsNav` | `Tabs` | Tab navigation |
| `Breadcrumb` | `Breadcrumbs` | Breadcrumb trail |
| `Pagination` | `Pager` | Page navigation |
| `Stepper` | `Steps`, `Wizard` | Step indicator |
| `NavLink` | `NavigationLink` | Navigation link |

### Data Display

| Component | Aliases | Description |
|-----------|---------|-------------|
| `List` | - | A2UI list container |
| `Table` | `DataTable` | Data table |
| `Timeline` | - | Event timeline |
| `Badge` | `Tag`, `Status` | Status badge |
| `Avatar` | `ProfileImage` | User avatar |
| `Image` | `Img` | Image display |

### Buttons

| Component | Aliases | Description |
|-----------|---------|-------------|
| `Button` | `Btn` | Action button |
| `ActionIcon` | `IconButton` | Icon-only button |

## Component Examples

### Button with Action

```json
{
  "componentType": "Button",
  "properties": {
    "child": "button-text",
    "action": { "name": "submit" },
    "variant": { "literalString": "filled" }
  }
}
```

### Card with Content

```json
{
  "componentType": "Card",
  "properties": {
    "children": ["card-header", "card-body"],
    "padding": { "literalString": "md" },
    "shadow": { "literalString": "sm" }
  }
}
```

### TextField with Data Binding

```json
{
  "componentType": "TextField",
  "properties": {
    "label": { "literalString": "Email Address" },
    "text": { "path": "form.email" },
    "placeholder": { "literalString": "you@example.com" }
  }
}
```

### Select Dropdown

```json
{
  "componentType": "Select",
  "properties": {
    "label": { "literalString": "Country" },
    "options": [
      { "value": "us", "label": "United States" },
      { "value": "uk", "label": "United Kingdom" },
      { "value": "ca", "label": "Canada" }
    ],
    "selected": { "path": "form.country" }
  }
}
```

## Theming

Mantine components automatically use your MantineProvider theme. Customize colors, fonts, and spacing:

```tsx
import { MantineProvider, createTheme } from '@mantine/core';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
  radius: {
    md: '0.5rem',
  },
});

function App() {
  return (
    <MantineProvider theme={theme}>
      {/* Your app */}
    </MantineProvider>
  );
}
```

### Dark Mode

Toggle dark mode with Mantine's color scheme:

```tsx
import { MantineProvider } from '@mantine/core';

<MantineProvider defaultColorScheme="dark">
  {/* Dark mode by default */}
</MantineProvider>
```

## Custom Mappings

Create custom component mappings with a subset of adapters:

```tsx
import { createComponentMapping } from '@a2ui-bridge/react';
import { adapters } from '@a2ui-bridge/react-mantine';

const customComponents = createComponentMapping({
  // Only include what you need
  Button: adapters.Button,
  Card: adapters.Card,
  Text: adapters.Text,
  TextField: adapters.TextField,
});
```

## License

MIT
