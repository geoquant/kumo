# Network Services PX Templates

A demo app showcasing page templates for the Network Services product experience, built with [@cloudflare/kumo](https://github.com/cloudflare/kumo) and React Router v7.

> **📘 Live Documentation Site**
>
> Browse the live site at **[ns-kumo-ui-templates.px-tester.workers.dev](https://ns-kumo-ui-templates.px-tester.workers.dev/)**
>
> Use your **Cloudflare email** to obtain an access token when prompted.

## Tech Stack

- **Framework** — [React Router](https://reactrouter.com/) v7 (SPA mode)
- **UI Library** — [@cloudflare/kumo](https://github.com/cloudflare/kumo) v1.7+
- **Icons** — [Phosphor Icons](https://phosphoricons.com/)
- **Styling** — [Tailwind CSS](https://tailwindcss.com/) v4
- **Build Tool** — [Vite](https://vitejs.dev/) v6
- **Package Manager** — [pnpm](https://pnpm.io/)

## Prerequisites

- **Node.js** — see `.nvmrc` or use Node 20+
- **pnpm** — v9+

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## Scripts

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Start the development server       |
| `pnpm build`     | Build for production               |
| `pnpm preview`   | Build and preview the production bundle |
| `pnpm typecheck` | Run TypeScript type checking       |

## Pages

- **Home** — Landing page with cards linking to all examples, templates, and blocks

### Examples
- **Tunnels** — Product overview page with a resource table
- **Routes** — Tabbed service view switching between multiple resource tables

### Templates
- **Product Overview** — Full-page layout with header, summary cards, and a resource table
- **Service Details** — Detail page with architecture diagram and configuration panels
- **Service Tabs** — Tabbed layout for switching between related resource views

### Blocks
- **Page Header** — Reusable page header with title, subtitle, and actions
- **Documentation Card** — Card linking to a doc or page with title and description
- **Architecture Diagram** — Visual diagram of service bindings and route connections
- **Details Card** — Key-value detail display card
- **List Table Card** — Card wrapping a compact data table
- **Metrics Card** — Card displaying metric values and trends
- **Next Steps Card** — Guided next-steps CTA card
- **Overview Card** — Summary card with icon and description

## Project Structure

```
app/
├── components/
│   ├── blocks/                        # Reusable UI blocks
│   │   ├── ArchitectureDiagram.tsx
│   │   ├── DetailsCard.tsx
│   │   ├── DocumentationCard.tsx
│   │   ├── ListTableCard.tsx
│   │   ├── MetricsCard.tsx
│   │   ├── NextStepsCard.tsx
│   │   ├── OverviewCard.tsx
│   │   ├── PageHeader.tsx
│   │   ├── PageSurface.tsx
│   │   └── PrimaryPageHeader.tsx
│   ├── layout/                        # App shell components
│   │   ├── app-header.tsx
│   │   ├── breadcrumb-portal.tsx
│   │   └── sidebar.tsx
│   └── templates/                     # Full-page layout templates
│       ├── ArchitectureTab.tsx
│       ├── ProductOverview.tsx
│       ├── ServiceDetail.tsx
│       ├── ServiceOverview.tsx
│       └── ServiceSettings.tsx
├── data/                              # Mock data and fixtures
│   ├── ip-prefixes.json
│   ├── navigation.ts
│   ├── tunnels.json
│   ├── tunnels.ts
│   └── wan-routes.json
├── routes/                            # Route modules
│   ├── architecture-diagram-doc.tsx
│   ├── details-card-doc.tsx
│   ├── documentation-card-doc.tsx
│   ├── home.tsx
│   ├── list-table-card-doc.tsx
│   ├── metrics-card-doc.tsx
│   ├── next-steps-card-doc.tsx
│   ├── overview-card-doc.tsx
│   ├── page-header-doc.tsx
│   ├── product-overview-doc.tsx
│   ├── product-overview-example.tsx
│   ├── service-detail-doc.tsx
│   ├── service-detail-example.tsx
│   ├── service-tabs-doc.tsx
│   └── service-tabs-example.tsx
├── app.css                            # Global styles
├── root.tsx                           # Root layout
└── routes.ts                          # Route configuration
```


## License

Internal use only — Cloudflare, Inc.
