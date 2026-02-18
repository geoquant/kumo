# Changelog

All notable changes to A2UI Bridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-XX

### Added

#### Core Protocol (`@a2ui-bridge/core`)
- A2UI Protocol message processor with surface management
- Data model binding with path resolution
- Component type guards and TypeScript definitions
- Support for all A2UI component types: Layout, Input, Display, Interactive

#### React Bindings (`@a2ui-bridge/react`)
- `Surface` component for rendering A2UI trees
- `useA2uiProcessor` hook for message processing
- Adapter pattern with `createAdapter()`, `extractValue()`, `createActionHandler()`
- Component registry system for pluggable UI libraries

#### ShadCN Adapter (`@a2ui-bridge/react-shadcn`)
- 30+ component adapters for ShadCN/Tailwind
- Full Tailwind CSS styling support
- Dark/light mode theming
- Accessible component implementations

#### Mantine Adapter (`@a2ui-bridge/react-mantine`)
- 76 component adapters for Mantine UI
- Complete Mantine theme integration
- Enhanced form components with validation
- Rich data display components (Table, Timeline, Accordion)

#### Demo Application (`apps/demo`)
- Interactive AI-powered UI generation demo
- Multi-provider LLM support (Anthropic Claude, OpenAI GPT, Google Gemini)
- Real-time streaming progress feedback
- Protocol viewer for debugging A2UI JSON
- Composable Snippets system for faster generation
- MCP server for Claude Desktop integration
- Design system toggle (Mantine/ShadCN)
- Generation mode selector (Fast/MCP Enhanced)

#### Documentation
- Comprehensive README files for all packages
- MCP server with component schemas and layout patterns
- Architecture documentation with data flow diagrams

### Technical Details

#### LLM Provider Support
| Provider | Model | Capabilities |
|----------|-------|--------------|
| Anthropic | claude-opus-4-5-20251101 | Streaming, Vision, Functions |
| OpenAI | gpt-5.2 | Streaming, Vision, Functions |
| Google | gemini-3-pro | Streaming, Vision |

#### Component Categories
- **Layout**: Row, Column, Card, Grid, Tabs, List, Accordion
- **Input**: TextField, Select, Checkbox, Slider, DateTimeInput
- **Display**: Text, Image, Icon, Badge, Avatar, Progress
- **Interactive**: Button, Modal, Menu, Tooltip

#### Deployment
- Vercel serverless functions for API proxy
- Edge-optimized static assets
- SPA routing configuration

### Fixed
- JSON parsing for AI responses with markdown code fences
- Select component option handling and value extraction
- Component mapping for MCP Enhanced mode
- Visual hierarchy and text styling
- Dark mode consistency across components
- Favicon support for dark/light modes

---

## [Unreleased]

### Planned
- Additional component adapters
- Enhanced data binding features
- Performance optimizations
- Additional LLM provider integrations

---

[0.1.0]: https://github.com/southleft/a2ui-bridge/releases/tag/v0.1.0
[Unreleased]: https://github.com/southleft/a2ui-bridge/compare/v0.1.0...HEAD
