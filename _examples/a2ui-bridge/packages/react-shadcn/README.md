# @a2ui-bridge/react-shadcn

ShadCN/Tailwind component implementations for A2UI Bridge.

## Installation

```bash
npm install @a2ui-bridge/core @a2ui-bridge/react @a2ui-bridge/react-shadcn
```

### Setup Tailwind CSS

Add the package to your Tailwind content paths:

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@a2ui-bridge/react-shadcn/dist/**/*.js',
  ],
  // ...
}
```

### Add CSS Variables

Add ShadCN-style CSS variables to your stylesheet:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

## Usage

```tsx
import { Surface, useA2uiProcessor } from '@a2ui-bridge/react';
import { shadcnComponents } from '@a2ui-bridge/react-shadcn';

function App() {
  const processor = useA2uiProcessor();

  return (
    <Surface
      processor={processor}
      components={shadcnComponents}
      onAction={(action) => console.log('Action:', action)}
    />
  );
}
```

## Components

### Text
Renders text with various styles based on `usageHint`:

| usageHint | Style |
|-----------|-------|
| `h1` | Large heading |
| `h2` | Medium heading |
| `h3` | Small heading |
| `body` | Body text |
| `caption` | Small, muted text |
| `label` | Form label |

### Button
Interactive button with action support:

```json
{
  "componentType": "Button",
  "properties": {
    "child": "button-text",
    "action": { "name": "submit" }
  }
}
```

### Card
Elevated container with rounded corners:

```json
{
  "componentType": "Card",
  "properties": {
    "children": ["card-content"]
  }
}
```

### Row
Horizontal flex layout:

```json
{
  "componentType": "Row",
  "properties": {
    "alignment": "center",
    "children": ["item1", "item2"]
  }
}
```

### Column
Vertical flex layout:

```json
{
  "componentType": "Column",
  "properties": {
    "children": ["item1", "item2"]
  }
}
```

### TextField
Text input with data binding:

```json
{
  "componentType": "TextField",
  "properties": {
    "label": { "literalString": "Email" },
    "text": { "path": "form.email" },
    "type": "shortText"
  }
}
```

### Badge
Small status indicator:

```json
{
  "componentType": "Badge",
  "properties": {
    "text": { "literalString": "Active" }
  }
}
```

### Divider
Visual separator line.

### List
Container for list items:

```json
{
  "componentType": "List",
  "properties": {
    "direction": "vertical",
    "children": ["item1", "item2"]
  }
}
```

### Image
Image display with usage hints:

```json
{
  "componentType": "Image",
  "properties": {
    "url": { "literalString": "https://example.com/image.jpg" },
    "usageHint": "avatar"
  }
}
```

## Theming

Components use Tailwind CSS with CSS variables for theming. Override variables in your CSS to customize:

```css
:root {
  --primary: 220 90% 56%;  /* Custom primary color */
  --radius: 0.75rem;       /* Larger border radius */
}
```

## License

MIT
