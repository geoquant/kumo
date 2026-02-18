# A2UI Bridge Demo

An interactive demo application showcasing the A2UI Bridge capabilities for AI-generated user interfaces.

## Features

### Core Capabilities

- **Real-time UI Generation**: Describe any interface in natural language and watch it render
- **Multiple LLM Providers**: Support for Anthropic Claude, OpenAI GPT, and Google Gemini
- **Progressive Streaming**: UI builds incrementally as the AI generates it
- **Live Protocol Viewer**: See the A2UI JSON being generated in real-time

### Enhanced User Experience

#### Streaming Progress Feedback

The demo includes a comprehensive streaming progress system that keeps users informed during UI generation:

```tsx
import { StreamingProgress } from './components/StreamingProgress';

<StreamingProgress
  isGenerating={isGenerating}
  componentCount={componentCount}
  streamLength={streamLength}
  isDark={isDark}
  onCancel={handleCancel}
/>
```

**Features:**
- Stage-based progress indicators (Connecting, Thinking, Planning, Generating, Finalizing)
- Real-time elapsed time display
- Component count during generation
- Rotating contextual loading messages
- Cancel button for long-running generations

#### Error Boundaries

Graceful error handling prevents the entire application from crashing when UI rendering fails:

```tsx
import { A2UIErrorBoundary } from './components/ErrorBoundary';

<A2UIErrorBoundary isDark={isDark} onReset={handleReset}>
  <Surface processor={processor} components={components} />
</A2UIErrorBoundary>
```

**Features:**
- Catches rendering errors without crashing the app
- User-friendly error display with technical details
- One-click retry functionality
- Debug information for development

### Architecture

#### Provider Abstraction Layer

A unified interface for multiple LLM providers:

```tsx
import { providerRegistry, AnthropicProvider } from './services/providers';

// Get available providers
const providers = providerRegistry.getAvailable();

// Get the current provider
const provider = providerRegistry.getProvider('anthropic');

// Generate with any provider
const response = await provider.generate({
  messages: [{ role: 'user', content: 'Create a contact form' }],
  system: systemPrompt,
});
```

**Supported Providers:**
| Provider | Model | Capabilities |
|----------|-------|--------------|
| Anthropic | claude-opus-4-5-20251101 | Streaming, Vision, Functions |
| OpenAI | gpt-5.2 | Streaming, Vision, Functions |
| Google | gemini-3-pro | Streaming, Vision |

#### Configuration Layer

Centralized, type-safe configuration with validation:

```tsx
import { config, loadConfig, validateConfig } from './config';

// Get current configuration
const { api, providers, ui, streaming } = config();

// Load with overrides
loadConfig({
  api: { timeout: 60000 },
  ui: { theme: 'dark' },
});

// Validate configuration
const result = validateConfig(config());
if (!result.valid) {
  console.error('Config errors:', result.errors);
}
```

**Configuration Sections:**

| Section | Purpose |
|---------|---------|
| `api` | API endpoints, timeouts, retry settings |
| `providers` | LLM provider settings and models |
| `ui` | Theme, visibility toggles, limits |
| `streaming` | Progress updates, cancellation |
| `components` | Surface ID, error boundaries |
| `features` | Feature flags and debug mode |

## Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT=120000

# Provider Configuration
VITE_DEFAULT_PROVIDER=anthropic
VITE_ANTHROPIC_API_KEY=sk-ant-...

# UI Configuration
VITE_DEFAULT_THEME=system

# Feature Flags
VITE_DEBUG_MODE=false
VITE_ANALYTICS=false
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- An API key from Anthropic, OpenAI, or Google

### Installation

```bash
# From the monorepo root
pnpm install

# Build dependencies
pnpm run build

# Start the demo
cd apps/demo
pnpm run dev
```

### Development

```bash
# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Build for production
pnpm run build
```

## Project Structure

```
apps/demo/
├── src/
│   ├── components/
│   │   ├── Demo.tsx              # Main demo component
│   │   ├── Landing.tsx           # Landing page
│   │   ├── StreamingProgress.tsx # Progress indicators
│   │   ├── ErrorBoundary.tsx     # Error handling
│   │   └── ProtocolViewer.tsx    # A2UI JSON viewer
│   ├── config/
│   │   ├── config.ts             # Configuration types & loading
│   │   ├── defaults.ts           # Default values
│   │   ├── validation.ts         # Config validation
│   │   └── index.ts              # Exports
│   ├── services/
│   │   ├── ai.ts                 # AI generation service
│   │   └── providers/
│   │       ├── types.ts          # Provider interfaces
│   │       ├── base.ts           # Base provider class
│   │       ├── anthropic.ts      # Anthropic implementation
│   │       ├── openai.ts         # OpenAI implementation
│   │       ├── google.ts         # Google implementation
│   │       ├── registry.ts       # Provider registry
│   │       └── index.ts          # Exports
│   └── adapters/                 # A2UI component adapters
└── public/                       # Static assets
```

## Customization

### Adding a New Provider

1. Create a new provider class extending `BaseProvider`:

```tsx
// services/providers/custom.ts
import { BaseProvider } from './base';
import type { Provider, GenerationRequest } from './types';

export class CustomProvider extends BaseProvider implements Provider {
  readonly id = 'custom';
  readonly name = 'Custom Provider';
  readonly description = 'My custom LLM provider';

  readonly capabilities = {
    streaming: true,
    vision: false,
    functionCalling: false,
    maxContextTokens: 4096,
  };

  async generate(request: GenerationRequest) {
    // Implementation
  }

  async *streamGenerate(request: GenerationRequest) {
    // Streaming implementation
  }
}
```

2. Register it in the registry:

```tsx
// services/providers/registry.ts
import { CustomProvider } from './custom';

providerRegistry.register(new CustomProvider());
```

### Customizing the Theme

The demo uses a dark/light theme system. Modify `src/App.css` or use Tailwind classes:

```tsx
// In any component
const isDark = theme === 'dark';

<div className={isDark ? 'bg-slate-900' : 'bg-white'}>
  {/* Content */}
</div>
```

### Extending Configuration

Add new configuration sections in `config/config.ts`:

```tsx
export interface MyFeatureConfig {
  enabled: boolean;
  setting: string;
}

export interface A2UIConfig {
  // ... existing sections
  myFeature: MyFeatureConfig;
}
```

## Performance Considerations

### Streaming Benefits

- **Perceived Performance**: Users see progress immediately instead of waiting 30+ seconds
- **Cancellation**: Users can cancel long-running generations
- **Progressive Display**: UI renders as it's generated, not all at once

### Bundle Size

The demo includes all providers. For production, tree-shake unused providers:

```tsx
// Only import what you need
import { AnthropicProvider } from './services/providers/anthropic';
```

## Troubleshooting

### Common Issues

**"API key not found"**
- Ensure your API key is set in `.env` or entered in the UI
- Check that the key has the correct prefix (sk-ant- for Anthropic)

**"Generation taking too long"**
- Complex UIs may take 30-60 seconds to generate
- Use the cancel button if needed
- Try simplifying your request

**"Component not rendering"**
- Check the Protocol Viewer for A2UI JSON errors
- Verify the component type is supported
- Check browser console for adapter errors

### Debug Mode

Enable debug mode for additional logging:

```bash
VITE_DEBUG_MODE=true pnpm run dev
```

## License

MIT - See the root repository LICENSE file.
