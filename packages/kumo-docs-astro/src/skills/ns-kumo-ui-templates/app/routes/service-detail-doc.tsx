import { CodeIcon, LayoutIcon } from "@phosphor-icons/react";
import { Surface, Code, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";

export const PAGE_DESCRIPTION = "A service detail page example with breadcrumbs, tabs, and Service Overview and Architecture Tab template examples.";

const PAGE_STRUCTURE = `┌─ AppHeader (sticky) ──────────────────────────────────────────────┐
│ [portal target ← breadcrumbs land HERE when scrolled]              │
└───────────────────────────────────────────────────────────────────┘

┌─ PageHeader ─────────────────────────────────────────────────────┐
│  [Breadcrumbs]                                                     │
│  [Tabs: Overview | Routes]                                         │
│ ┌─ Tab content ────────────────────────────────────────────────┐ │
│ │                                                                │ │
│ │  Overview tab  → ServiceOverview template                      │ │
│ │  Routes tab    → ArchitectureTab template                      │ │
│ │                                                                │ │
│ └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘`;

const OVERVIEW_TAB_STRUCTURE = `┌─ ServiceOverview ─────────────────────────────────────────────────┐
│ ┌─ leftContent ─────────────────────┐ ┌─ rightContent ──────────┐│
│ │  MetricsCard                       │ │  DetailsCard            ││
│ │  ListTableCard (Replicas)          │ │  OverviewCard (Token)   ││
│ │  OverviewCard (Routes)             │ │  NextStepsCard          ││
│ │    └─ ArchitectureDiagram          │ │                         ││
│ └────────────────────────────────────┘ └─────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘`;

const ROUTES_TAB_STRUCTURE = `┌─ ArchitectureTab ─────────────────────────────────────────────────┐
│  [title + description]                          [actions]          │
│ ─────────────────────────────────────────────────────────────────  │
│  [diagramTitle]                                                    │
│  ┌─ ArchitectureDiagram ──────────────────────────────────────┐   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌─ RoutesTable (children) ───────────────────────────────────┐   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘`;

const BASIC_USAGE = `import { useState } from "react";
import { Breadcrumbs, Tabs } from "@cloudflare/kumo";
import { PageHeader } from "~/components/blocks/PageHeader";
import { ServiceOverview } from "~/components/templates/ServiceOverview";
import { ArchitectureTab } from "~/components/templates/ArchitectureTab";
import { MetricsCard } from "~/components/blocks/MetricsCard";
import { DetailsCard } from "~/components/blocks/DetailsCard";

export default function MyServiceDetailPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <PageHeader
      breadcrumbs={
        <Breadcrumbs>
          <Breadcrumbs.Link href="/list">Services</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>My Service</Breadcrumbs.Current>
        </Breadcrumbs>
      }
      tabs={
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v)}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "routes", label: "Routes" },
          ]}
        />
      }
    >
      {activeTab === "overview" && (
        <ServiceOverview
          leftContent={[
            <MetricsCard key="metrics" metrics={[...]} />,
          ]}
          rightContent={[
            <DetailsCard key="details" title="Details" items={[...]} />,
          ]}
        />
      )}
      {activeTab === "routes" && (
        <ArchitectureTab
          title="Routes"
          description="Manage your service routes."
          diagramTitle="Connected routes"
          workerName="my-service"
          bindings={[...]}
        >
          {/* Table or other content */}
        </ArchitectureTab>
      )}
    </PageHeader>
  );
}`;

const PAGE_HEADER_PROPS = [
  { name: "breadcrumbs", type: "ReactNode", required: "No", description: "Breadcrumb navigation rendered above the tabs" },
  { name: "tabs", type: "ReactNode", required: "No", description: "Tab bar rendered in a sticky header below the breadcrumbs" },
  { name: "title", type: "ReactNode", required: "No", description: "Page title (alternative to breadcrumbs)" },
  { name: "description", type: "ReactNode", required: "No", description: "Page description below the title" },
  { name: "actions", type: "ReactNode", required: "No", description: "Action buttons rendered alongside the tabs" },
  { name: "children", type: "ReactNode", required: "No", description: "Tab content rendered below the header" },
];

const SERVICE_OVERVIEW_PROPS = [
  { name: "leftContent", type: "ReactNode[]", required: "No", description: "Array of components for the main (left) column — e.g. MetricsCard, ListTableCard, OverviewCard" },
  { name: "rightContent", type: "ReactNode[]", required: "No", description: "Array of components for the sidebar (right) column — e.g. DetailsCard, NextStepsCard" },
  { name: "className", type: "string", required: "No", description: "Extra CSS classes on the outer wrapper" },
];

const ARCHITECTURE_TAB_PROPS = [
  { name: "title", type: "string", required: "Yes", description: "Page heading displayed at the top of the tab" },
  { name: "description", type: "string", required: "Yes", description: "Description text displayed below the heading" },
  { name: "actions", type: "ReactNode", required: "No", description: "Action buttons rendered in the top-right area" },
  { name: "diagramTitle", type: "string", required: "Yes", description: "Heading above the architecture diagram" },
  { name: "workerName", type: "string", required: "Yes", description: "Name shown on the destination node in the diagram" },
  { name: "bindings", type: "BindingItem[]", required: "Yes", description: "Binding rows rendered on the left side of the diagram" },
  { name: "canUpdate", type: "boolean", required: "No", description: "Whether the add-route badge is shown in the diagram" },
  { name: "children", type: "ReactNode", required: "No", description: "Content rendered below the diagram (e.g. a table)" },
];

export default function ServiceDetailDocPage() {
  return (
    <ProductOverview
      title="Service Details"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="example" variant="primary" href="/service-detail-example/Corporate-Apps-Server">
            View Example
          </LinkButton>
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/blob/main/app/routes/service-detail-example.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>
        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The service detail page renders a single-resource view with breadcrumb
              navigation, a tab bar, and tab-specific content. It is built by composing
              the <Text variant="mono" size="lg">PageHeader</Text> block with
              the <Text variant="mono" size="lg">ServiceOverview</Text> and{" "}
              <Text variant="mono" size="lg">ArchitectureTab</Text> templates.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">Overview</Text> tab uses the{" "}
              <Text variant="mono" size="lg">ServiceOverview</Text> template to display a
              two-column layout with metrics, a replicas table, a routes diagram, detail
              cards, and next-steps. The <Text variant="mono" size="lg">Routes</Text> tab
              uses the <Text variant="mono" size="lg">ArchitectureTab</Text> template to
              show an architecture diagram alongside a paginated routes table.
            </span>
          </Text>
        </div>

        {/* ---- Page Structure ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Page Structure</Text>
          <Text variant="secondary">
            The top-level layout wraps everything in a{" "}
            <Text variant="mono" size="lg">PageHeader</Text> block which provides
            breadcrumbs and a sticky tab bar. Each tab renders its own template.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code lang="bash" code={PAGE_STRUCTURE} />
          </Surface>
        </div>

        {/* ---- Overview Tab ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Overview Tab</Text>
          <Text variant="secondary">
            The Overview tab uses the <Text variant="mono" size="lg">ServiceOverview</Text> template
            with a two-column grid. The left column contains data-heavy blocks; the right column
            contains contextual details and actions.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code lang="bash" code={OVERVIEW_TAB_STRUCTURE} />
          </Surface>

          <Text variant="heading3">Left Column Blocks</Text>
          <ul className="list-disc list-inside space-y-1 text-kumo-text-secondary">
            <li><code className="text-sm">MetricsCard</code> — displays key metrics (active replicas, routes, status, uptime)</li>
            <li><code className="text-sm">ListTableCard</code> — tabular list of tunnel replicas with an action button</li>
            <li><code className="text-sm">OverviewCard</code> — wraps an <code className="text-sm">ArchitectureDiagram</code> showing connected routes</li>
          </ul>

          <Text variant="heading3">Right Column Blocks</Text>
          <ul className="list-disc list-inside space-y-1 text-kumo-text-secondary">
            <li><code className="text-sm">DetailsCard</code> — key/value detail items (name, tunnel ID, type) with copy/edit actions</li>
            <li><code className="text-sm">OverviewCard</code> — custom content card (e.g. "Refresh token" with a rotate action)</li>
            <li><code className="text-sm">NextStepsCard</code> — guided next-step links for the user</li>
          </ul>
        </div>

        {/* ---- Routes Tab ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Routes Tab</Text>
          <Text variant="secondary">
            The Routes tab uses the <Text variant="mono" size="lg">ArchitectureTab</Text> template
            which provides a header with title, description, and action buttons, followed by an
            architecture diagram and child content (a paginated routes table).
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code lang="bash" code={ROUTES_TAB_STRUCTURE} />
          </Surface>

          <Text variant="heading3">Blocks Used</Text>
          <ul className="list-disc list-inside space-y-1 text-kumo-text-secondary">
            <li><code className="text-sm">ArchitectureDiagram</code> — visual diagram of connected routes and bindings</li>
            <li>Custom <code className="text-sm">RoutesTable</code> — paginated table with type, destination, service, and description columns</li>
          </ul>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">
            A minimal service detail page with breadcrumbs, tabs, and two tab views:
          </Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- Templates Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Templates Reference</Text>

          <Text variant="heading3">PageHeader (block)</Text>
          <Text variant="secondary">
            The outer shell that provides breadcrumbs, a sticky tab bar, and renders tab content as children.
          </Text>
          <LayerCard>
            <LayerCard.Primary className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Prop name</Table.Head>
                    <Table.Head>Type</Table.Head>
                    <Table.Head>Required</Table.Head>
                    <Table.Head>Description</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {PAGE_HEADER_PROPS.map((prop) => (
                    <Table.Row key={prop.name}>
                      <Table.Cell><Text variant="mono">{prop.name}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.type}</Text></Table.Cell>
                      <Table.Cell>{prop.required}</Table.Cell>
                      <Table.Cell>{prop.description}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>

          <Text variant="heading3">ServiceOverview (template)</Text>
          <Text variant="secondary">
            A two-column grid layout used for the Overview tab. Accepts arrays of components
            for the left and right columns.
          </Text>
          <LayerCard>
            <LayerCard.Primary className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Prop name</Table.Head>
                    <Table.Head>Type</Table.Head>
                    <Table.Head>Required</Table.Head>
                    <Table.Head>Description</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {SERVICE_OVERVIEW_PROPS.map((prop) => (
                    <Table.Row key={prop.name}>
                      <Table.Cell><Text variant="mono">{prop.name}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.type}</Text></Table.Cell>
                      <Table.Cell>{prop.required}</Table.Cell>
                      <Table.Cell>{prop.description}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>

          <Text variant="heading3">ArchitectureTab (template)</Text>
          <Text variant="secondary">
            A full-width tab layout with a header section, an architecture diagram, and
            optional child content below the diagram.
          </Text>
          <LayerCard>
            <LayerCard.Primary className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Prop name</Table.Head>
                    <Table.Head>Type</Table.Head>
                    <Table.Head>Required</Table.Head>
                    <Table.Head>Description</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {ARCHITECTURE_TAB_PROPS.map((prop) => (
                    <Table.Row key={prop.name}>
                      <Table.Cell><Text variant="mono">{prop.name}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.type}</Text></Table.Cell>
                      <Table.Cell>{prop.required}</Table.Cell>
                      <Table.Cell>{prop.description}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>
        </div>

        {/* ---- Blocks Used ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Blocks Used</Text>
          <Text variant="secondary">
            The following blocks are composed within the templates on this page:
          </Text>
          <ul className="list-disc list-inside space-y-1 text-kumo-text-secondary">
            <li><code className="text-sm">PageHeader</code> — breadcrumbs, sticky tab bar, and content shell</li>
            <li><code className="text-sm">MetricsCard</code> — grid of key metric values with optional status badges</li>
            <li><code className="text-sm">ListTableCard</code> — titled card with a columnar data table and action button</li>
            <li><code className="text-sm">OverviewCard</code> — generic titled card for arbitrary content</li>
            <li><code className="text-sm">ArchitectureDiagram</code> — visual binding/route diagram</li>
            <li><code className="text-sm">DetailsCard</code> — key/value list with copy and edit actions</li>
            <li><code className="text-sm">NextStepsCard</code> — guided action links for onboarding or setup</li>
          </ul>
        </div>
      </div>
    </ProductOverview>
  );
}
