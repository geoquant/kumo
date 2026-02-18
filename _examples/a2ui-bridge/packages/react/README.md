# @a2ui-bridge/react

React adapter for A2UI Bridge. Provides hooks and components for rendering A2UI protocol messages.

## Installation

```bash
npm install @a2ui-bridge/core @a2ui-bridge/react
```

## Usage

```tsx
import { Surface, useA2uiProcessor } from '@a2ui-bridge/react';
import type { ComponentMapping, UserAction } from '@a2ui-bridge/react';

// Define your component mapping
const components: ComponentMapping = {
  Text: ({ node }) => <span>{node.properties.text?.literalString}</span>,
  Button: ({ node, onAction }) => (
    <button onClick={() => onAction?.(node.properties.action?.name ?? 'click')}>
      {/* render child */}
    </button>
  ),
  // ... more components
};

function App() {
  const processor = useA2uiProcessor();

  const handleAction = (action: UserAction) => {
    console.log('Action:', action.actionName);
    console.log('From:', action.sourceComponentId);
    console.log('Context:', action.context);
  };

  // Process messages (typically from LLM stream)
  useEffect(() => {
    processor.processMessages(messages);
  }, [messages, processor]);

  return (
    <Surface
      processor={processor}
      components={components}
      surfaceId="@default"
      onAction={handleAction}
    />
  );
}
```

## API

### `useA2uiProcessor()`

Creates a stable A2UIProcessor instance that persists across re-renders.

```tsx
const processor = useA2uiProcessor();

// Process messages
processor.processMessages(messages);

// Get current surfaces
const surfaces = processor.getSurfaces();
```

### `<Surface />`

Main rendering component that displays A2UI surfaces.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `processor` | `MessageProcessor` | The A2UI processor instance |
| `components` | `ComponentMapping` | Map of component types to React components |
| `surfaceId` | `string` | Surface ID to render (default: `@default`) |
| `onAction` | `(action: UserAction) => void` | Callback when user triggers an action |

### Types

#### ComponentMapping
```typescript
type ComponentMapping = Record<string, React.ComponentType<A2UIComponentProps>>;
```

#### A2UIComponentProps
```typescript
interface A2UIComponentProps<T = AnyComponentNode> {
  node: T;
  children?: React.ReactNode;
  onAction?: (actionName: string, context?: Record<string, unknown>) => void;
}
```

#### UserAction
```typescript
interface UserAction {
  actionName: string;
  sourceComponentId: string;
  timestamp: number;
  context?: Record<string, unknown>;
}
```

## Using with Component Libraries

This package is designed to work with component implementations like `@a2ui-bridge/react-shadcn`:

```tsx
import { Surface, useA2uiProcessor } from '@a2ui-bridge/react';
import { shadcnComponents } from '@a2ui-bridge/react-shadcn';

function App() {
  const processor = useA2uiProcessor();

  return (
    <Surface
      processor={processor}
      components={shadcnComponents}
      onAction={handleAction}
    />
  );
}
```

## License

MIT
