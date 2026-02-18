# Contributing to A2UI Bridge

Thank you for your interest in contributing to A2UI Bridge! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Adding Components](#adding-components)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)

## Code of Conduct

This project follows a standard open source code of conduct. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Git

### Setup

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/a2ui-bridge.git
   cd a2ui-bridge
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Build all packages:
   ```bash
   pnpm run build
   ```

5. Run the demo to verify setup:
   ```bash
   cd apps/demo
   pnpm run dev
   ```

## Development Workflow

### Building Packages

The monorepo uses Turborepo for build orchestration:

```bash
# Build all packages (respects dependency order)
pnpm run build

# Build a specific package
pnpm --filter @a2ui-bridge/core build
pnpm --filter @a2ui-bridge/react build

# Watch mode for development
pnpm --filter @a2ui-bridge/core dev
```

### Running Tests

```bash
# Lint all packages
pnpm run lint

# Type check
pnpm run typecheck
```

### Clean Build

```bash
# Remove all build artifacts
pnpm run clean

# Fresh install and build
pnpm install && pnpm run build
```

## Project Structure

```
a2ui-bridge/
├── packages/
│   ├── core/              # Protocol processing (framework-agnostic)
│   ├── react/             # React bindings and hooks
│   ├── react-shadcn/      # ShadCN/Tailwind adapters
│   └── react-mantine/     # Mantine UI adapters
├── apps/
│   └── demo/              # Interactive demo application
└── api/                   # Vercel serverless functions
```

### Package Dependency Chain

```
@a2ui-bridge/core
        ↓
@a2ui-bridge/react
        ↓
@a2ui-bridge/react-shadcn (or react-mantine)
        ↓
apps/demo
```

## Adding Components

### 1. Define in Core

Add the component interface in `packages/core/src/components.ts`:

```typescript
export interface MyNewComponent extends ComponentNode {
  type: 'MyNewComponent';
  label?: StringValue;
  // ... other props
}
```

### 2. Add Type Guard

Add a type guard in `packages/core/src/guards.ts`:

```typescript
export function isMyNewComponent(node: AnyComponentNode): node is MyNewComponent {
  return node.type === 'MyNewComponent';
}
```

### 3. Update Types

Add to the `AnyComponentNode` union in `packages/core/src/types.ts`.

### 4. Handle in Processor

Add a switch case in `packages/core/src/processor.ts` in `buildNodeRecursive()`.

### 5. Create Adapter

Create the adapter in the appropriate package:

```typescript
// packages/react-shadcn/src/components/MyNewComponent.tsx
import { createAdapter, extractValue } from '@a2ui-bridge/react';
import { MyComponent } from '@/components/ui/my-component';

export const MyNewComponentAdapter = createAdapter(
  ({ node }) => {
    const label = extractValue(node.label);
    return <MyComponent>{label}</MyComponent>;
  },
  { mapProps: { label: 'children' } }
);
```

### 6. Register Adapter

Add to the component mapping in `packages/react-shadcn/src/mapping.ts`:

```typescript
export const shadcnComponents = {
  // ... existing components
  MyNewComponent: MyNewComponentAdapter,
};
```

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the coding standards below

3. **Test your changes**:
   ```bash
   pnpm run build
   pnpm run lint
   cd apps/demo && pnpm run dev
   ```

4. **Commit with a descriptive message**:
   ```bash
   git commit -m "Add MyNewComponent with adapter support"
   ```

5. **Push and create a PR**:
   ```bash
   git push origin feature/my-feature
   ```

6. **PR Requirements**:
   - Clear description of changes
   - Passes all CI checks
   - Documentation updated if needed
   - No breaking changes without discussion

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use interfaces for component props
- Export types from package index files

### Component Patterns

- Use `extractValue()` for all A2UI property access
- Support both light and dark themes
- Follow accessibility best practices
- Keep adapters focused and simple

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Types: `types.ts` or inline
- Tests: `*.test.ts` or `*.spec.ts`

### Commit Messages

Follow conventional commit format:

```
feat: Add DateTimeInput component
fix: Resolve Select value extraction bug
docs: Update README with new examples
chore: Update dependencies
```

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Be specific and provide reproduction steps for bugs

Thank you for contributing!
