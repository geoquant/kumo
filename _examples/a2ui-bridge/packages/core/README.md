# @a2ui-bridge/core

Core protocol processing for Google's Adaptive Agent UI (A2UI) Protocol. Framework-agnostic and design-system-agnostic.

## Installation

```bash
npm install @a2ui-bridge/core
```

## Usage

```typescript
import { A2UIProcessor } from '@a2ui-bridge/core';
import type { ServerToClientMessage } from '@a2ui-bridge/core';

// Create processor instance
const processor = new A2UIProcessor();

// Process messages from LLM
const messages: ServerToClientMessage[] = [
  {
    beginRendering: {
      surfaceId: '@default',
      root: 'my-card',
    },
  },
  {
    surfaceUpdate: {
      surfaceId: '@default',
      components: [
        {
          id: 'my-card',
          component: {
            componentType: 'Card',
            properties: {
              children: ['my-text'],
            },
          },
        },
        {
          id: 'my-text',
          component: {
            componentType: 'Text',
            properties: {
              text: { literalString: 'Hello World' },
            },
          },
        },
      ],
    },
  },
];

processor.processMessages(messages);

// Access surfaces
const surfaces = processor.getSurfaces();
const defaultSurface = surfaces.get('@default');
console.log(defaultSurface?.rootNode);
```

## API

### A2UIProcessor

#### `processMessages(messages: ServerToClientMessage[])`
Processes an array of A2UI protocol messages, updating internal state.

#### `getSurfaces(): ReadonlyMap<string, Surface>`
Returns all current surfaces with their component trees.

#### `getData(node, relativePath, surfaceId): DataValue | null`
Resolves data binding paths for a given component node.

#### `clearSurfaces()`
Clears all surfaces and resets state.

### Message Types

#### BeginRenderingMessage
```typescript
{
  beginRendering: {
    surfaceId: string;
    root: string;
    styles?: Record<string, string>;
  }
}
```

#### SurfaceUpdateMessage
```typescript
{
  surfaceUpdate: {
    surfaceId: string;
    components: ComponentInstance[];
  }
}
```

#### DataModelUpdate
```typescript
{
  dataModelUpdate: {
    surfaceId: string;
    path?: string;
    contents: ValueMap[];
  }
}
```

#### DeleteSurfaceMessage
```typescript
{
  deleteSurface: {
    surfaceId: string;
  }
}
```

## License

MIT
