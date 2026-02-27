import { CodeIcon, LayoutIcon } from "@phosphor-icons/react";
import { Surface, Code, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";

export const PAGE_DESCRIPTION = "A tabbed service page using ServiceDetail and ServiceSettings templates with resource tables and configuration forms.";

const PAGE_STRUCTURE = `┌─ AppHeader (sticky) ──────────────────────────────────────────────┐
│ [portal target ← breadcrumbs land HERE when scrolled]              │
└───────────────────────────────────────────────────────────────────┘

┌─ PageSurface ────────────────────────────────────────────────────┐
│ ┌─ PageHeader ─────────────────────────────────────────────────┐ │
│ │  [Breadcrumbs]                                                 │ │
│ │  [Tabs: IP prefixes | Routes | WAN configuration]              │ │
│ │ ┌─ Tab content ────────────────────────────────────────────┐ │ │
│ │ │                                                            │ │ │
│ │ │  IP prefixes tab     → ServiceDetail template              │ │ │
│ │ │  Routes tab          → ServiceDetail template              │ │ │
│ │ │  WAN configuration   → ServiceSettings template            │ │ │
│ │ │                                                            │ │ │
│ │ └────────────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘`;

const SERVICE_DETAIL_TAB_STRUCTURE = `┌─ ServiceDetail ──────────────────────────────────────────────────┐
│  [title + description]                  [Documentation] [action]  │
│ ─────────────────────────────────────────────────────────────────  │
│  ┌─ children ────────────────────────────────────────────────┐   │
│  │  [Toolbar: search + status filter + edit columns + refresh]│   │
│  │  ┌─ Table ────────────────────────────────────────────┐   │   │
│  │  │  Name | Status | Attribute | Attribute | Attribute │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  │  [Pagination]                                              │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘`;

const SERVICE_SETTINGS_TAB_STRUCTURE = `┌─ ServiceSettings ────────────────────────────────────────────────┐
│  [title + description]                                             │
│ ─────────────────────────────────────────────────────────────────  │
│  ┌─ children (settings cards) ───────────────────────────────┐   │
│  │  ┌─ Surface card 1 ──────────────────────────────────┐    │   │
│  │  │  Account-level virtual network overlay              │    │   │
│  │  │  [ASN input + Update button]                        │    │   │
│  │  └────────────────────────────────────────────────────┘    │   │
│  │  ┌─ Surface card 2 ──────────────────────────────────┐    │   │
│  │  │  Propagated routes to cloud networks                │    │   │
│  │  │  [CIDR prefix list + Save/Restore buttons]          │    │   │
│  │  └────────────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘`;

const BASIC_USAGE = `import { useState } from "react";
import { Breadcrumbs, Tabs, Button } from "@cloudflare/kumo";
import { PageSurface } from "~/components/blocks/PageSurface";
import { PageHeader } from "~/components/blocks/PageHeader";
import { ServiceDetail } from "~/components/templates/ServiceDetail";
import { ServiceSettings } from "~/components/templates/ServiceSettings";

export default function MyServiceTabsPage() {
  const [activeTab, setActiveTab] = useState("resources");

  return (
    <PageSurface>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Current>My Service</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        tabs={
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
            tabs={[
              { value: "resources", label: "Resources" },
              { value: "settings", label: "Settings" },
            ]}
          />
        }
      >
        {activeTab === "resources" && (
          <ServiceDetail
            title="Resources"
            description="Manage your service resources."
            docsHref="https://developers.cloudflare.com/"
            actions={<Button variant="primary">Create resource</Button>}
          >
            {/* Resource table */}
          </ServiceDetail>
        )}
        {activeTab === "settings" && (
          <ServiceSettings
            title="Settings"
            description="Configure your service."
          >
            {/* Settings form cards */}
          </ServiceSettings>
        )}
      </PageHeader>
    </PageSurface>
  );
}`;

const PAGE_HEADER_PROPS = [
  { name: "breadcrumbs", type: "ReactNode", required: "No", description: "Breadcrumb navigation rendered above the tabs" },
  { name: "tabs", type: "ReactNode", required: "No", description: "Tab bar rendered in a sticky header below the breadcrumbs" },
  { name: "actions", type: "ReactNode", required: "No", description: "Action buttons rendered alongside the tabs" },
  { name: "children", type: "ReactNode", required: "No", description: "Tab content rendered below the header" },
];

const SERVICE_DETAIL_PROPS = [
  { name: "title", type: "string", required: "Yes", description: "Page heading displayed at the top of the tab" },
  { name: "description", type: "string", required: "No", description: "Description text displayed below the heading" },
  { name: "docsHref", type: "string", required: "No", description: "URL for the Documentation link button" },
  { name: "canUpdate", type: "boolean", required: "No", description: "Whether action buttons are rendered (default true)" },
  { name: "actions", type: "ReactNode", required: "No", description: "Action buttons rendered in the header area" },
  { name: "children", type: "ReactNode", required: "Yes", description: "Main content — typically a filtered, paginated table" },
  { name: "emptyState", type: "ReactNode", required: "No", description: "Fallback UI shown when children is null/undefined" },
];

const SERVICE_SETTINGS_PROPS = [
  { name: "title", type: "string", required: "Yes", description: "Page heading displayed at the top of the tab" },
  { name: "description", type: "string", required: "No", description: "Description text displayed below the heading" },
  { name: "docsHref", type: "string", required: "No", description: "URL for the Documentation link button" },
  { name: "canUpdate", type: "boolean", required: "No", description: "Whether action buttons are rendered (default true)" },
  { name: "actions", type: "ReactNode", required: "No", description: "Action buttons rendered in the header area" },
  { name: "sideNav", type: "ReactNode", required: "No", description: "Side navigation rendered in a sticky sidebar" },
  { name: "sideNavRef", type: "Ref<HTMLElement>", required: "No", description: "Ref for the side navigation element" },
  { name: "sideNavTop", type: "number", required: "No", description: "Custom sticky top offset for the side navigation" },
  { name: "children", type: "ReactNode", required: "Yes", description: "Main content — typically Surface cards with form fields" },
  { name: "contentRef", type: "Ref<HTMLDivElement>", required: "No", description: "Ref for the main content container" },
];

export default function ServiceTabsDocPage() {
  return (
    <ProductOverview
      title="Service Tabs"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="example" variant="primary" href="/service-tabs-example">
            View Example
          </LinkButton>
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/blob/main/app/routes/service-tabs-example.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>
        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The service tabs page renders a multi-tab view for managing service
              resources and configuration. It is built by wrapping a{" "}
              <Text variant="mono" size="lg">PageHeader</Text> block (with breadcrumbs
              and tabs) inside a <Text variant="mono" size="lg">PageSurface</Text> block.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              Resource tabs (IP prefixes, Routes) use the{" "}
              <Text variant="mono" size="lg">ServiceDetail</Text> template which provides
              a header with title, description, documentation link, and action buttons,
              followed by a content area for tables. The configuration tab uses the{" "}
              <Text variant="mono" size="lg">ServiceSettings</Text> template which adds
              an optional side navigation alongside form-based content cards.
            </span>
          </Text>
        </div>

        {/* ---- Page Structure ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Page Structure</Text>
          <Text variant="secondary">
            The outer layout uses <Text variant="mono" size="lg">PageSurface</Text> and{" "}
            <Text variant="mono" size="lg">PageHeader</Text> to provide breadcrumbs and a
            sticky tab bar. Each tab renders a different template.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code lang="bash" code={PAGE_STRUCTURE} />
          </Surface>
        </div>

        {/* ---- ServiceDetail Tabs ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Resource Tabs (ServiceDetail)</Text>
          <Text variant="secondary">
            The IP prefixes and Routes tabs both use the{" "}
            <Text variant="mono" size="lg">ServiceDetail</Text> template. Each tab receives
            a different title, description, action label, and dataset. The template renders
            a header section and delegates the table content to children.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code lang="bash" code={SERVICE_DETAIL_TAB_STRUCTURE} />
          </Surface>

          <Text variant="heading3">Blocks Used</Text>
          <ul className="list-disc list-inside space-y-1 text-kumo-text-secondary">
            <li><code className="text-sm">PageSurface</code> — full-page background surface</li>
            <li><code className="text-sm">PageHeader</code> — breadcrumbs, sticky tab bar, and content shell</li>
            <li>Custom <code className="text-sm">RouteResourceTable</code> — toolbar with search, status filter, column editor, and refresh; a data table; and pagination</li>
          </ul>
        </div>

        {/* ---- ServiceSettings Tab ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Configuration Tab (ServiceSettings)</Text>
          <Text variant="secondary">
            The WAN configuration tab uses the{" "}
            <Text variant="mono" size="lg">ServiceSettings</Text> template. It provides a
            header section and a two-column layout with a main content area and an optional
            sticky side navigation. The content area contains Surface cards with form fields.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code lang="bash" code={SERVICE_SETTINGS_TAB_STRUCTURE} />
          </Surface>

          <Text variant="heading3">Blocks Used</Text>
          <ul className="list-disc list-inside space-y-1 text-kumo-text-secondary">
            <li><code className="text-sm">Surface</code> — card containers for each settings section</li>
            <li>Form controls (<code className="text-sm">Input</code>, <code className="text-sm">Label</code>, <code className="text-sm">Button</code>) — standard Kumo form elements</li>
          </ul>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">
            A minimal service tabs page with a resource tab and a settings tab:
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

          <Text variant="heading3">ServiceDetail (template)</Text>
          <Text variant="secondary">
            A tab layout with a header section (title, description, docs link, actions) and
            a content area for resource tables or other list views.
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
                  {SERVICE_DETAIL_PROPS.map((prop) => (
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

          <Text variant="heading3">ServiceSettings (template)</Text>
          <Text variant="secondary">
            A tab layout with a header section and a two-column content area. The main column
            holds form cards; the optional sidebar holds sticky navigation links.
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
                  {SERVICE_SETTINGS_PROPS.map((prop) => (
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
            <li><code className="text-sm">PageSurface</code> — full-page background surface wrapper</li>
            <li><code className="text-sm">PageHeader</code> — breadcrumbs, sticky tab bar, and content shell</li>
            <li><code className="text-sm">Surface</code> — card containers for settings sections</li>
            <li><code className="text-sm">LayerCard</code> — card wrapper for data tables</li>
            <li><code className="text-sm">Table</code> — Kumo data table for resource listings</li>
            <li><code className="text-sm">Pagination</code> — page navigation for table results</li>
            <li><code className="text-sm">InputGroup</code> — search input with icon label</li>
            <li><code className="text-sm">Combobox</code> — dropdown filter for status</li>
          </ul>
        </div>
      </div>
    </ProductOverview>
  );
}
