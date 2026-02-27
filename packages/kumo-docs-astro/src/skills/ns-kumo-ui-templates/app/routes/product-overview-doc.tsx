import { LayoutIcon, CodeIcon } from "@phosphor-icons/react";
import {
  Surface,
  Code,
  Text,
  CodeBlock,
  Table,
  LayerCard,
  LinkButton,
} from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";

export const PAGE_DESCRIPTION =
  "A product overview page template with metrics, usage limits, and a two-column layout.";

const BASIC_USAGE = `import { ProductOverview } from "~/components/templates/ProductOverview";
import { TableIcon } from "@phosphor-icons/react";

export default function MyProductPage() {
  return (
    <ProductOverview
      title="My Product"
      subtitle="A short description of the product."
      titleIcon={<TableIcon size={28} />}
    >
      <p>Your main content goes here.</p>
    </ProductOverview>
  );
}`;

const FULL_USAGE = `import { Button, Text } from "@cloudflare/kumo";
import { TableIcon } from "@phosphor-icons/react";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { DocumentationCard } from "~/components/blocks/DocumentationCard";

export default function FullExamplePage() {
  return (
    <ProductOverview
      titleIcon={<TableIcon size={28} className="text-kumo-strong" />}
      title="Workers"
      subtitle="Deploy serverless functions at the edge."
      actions={[
        <Button key="docs" variant="outline">Documentation</Button>,
        <Button key="create" variant="primary">Create Worker</Button>,
      ]}
      metrics={[
        { title: "Total requests", value: "1.2M" },
        { title: "Success rate", value: "99.8%" },
        { title: "Avg latency", value: "45ms" },
        { title: "Active workers", value: "12" },
      ]}
      usageLimits={[
        {
          translatedName: "Requests",
          usedQuantity: 850000,
          limit: 1000000,
          renderValue: (v) => \`\${(v / 1000000).toFixed(1)}M\`,
        },
      ]}
      displayedDates={{
        start: new Date("2026-02-01"),
        end: new Date("2026-02-28"),
      }}
      footer={
        <div className="flex flex-col gap-4">
          <Text variant="heading2">Common use cases</Text>
          <DocumentationCard
            title="Getting started"
            description="Learn the basics of Workers."
            href="#"
          />
        </div>
      }
    >
      {/* Main content: tables, charts, forms, etc. */}
    </ProductOverview>
  );
}`;

const WITH_METRICS = `<ProductOverview
  title="Analytics"
  subtitle="View your product metrics."
  metrics={[
    { title: "Total requests", value: "1.2M" },
    { title: "Success rate", value: "99.8%", tooltip: "Percentage of 2xx responses" },
    { title: "Avg latency", value: "45ms", loading: false },
    { title: "Active workers", value: "12" },
  ]}
  isMetricsLoading={false}
>
  {/* content */}
</ProductOverview>`;

const WITH_USAGE_LIMITS = `<ProductOverview
  title="Usage"
  subtitle="Monitor your resource consumption."
  usageLimits={[
    {
      translatedName: "Requests",
      usedQuantity: 850000,
      limit: 1000000,
      renderValue: (v) => \`\${(v / 1000000).toFixed(1)}M\`,
    },
    {
      translatedName: "Storage",
      usedQuantity: 5,
      limit: 10,
      renderValue: (v) => \`\${v} GB\`,
    },
  ]}
  displayedDates={{
    start: new Date("2026-02-01"),
    end: new Date("2026-02-28"),
  }}
  displayedDatesTooltip="Current billing period"
>
  {/* content */}
</ProductOverview>`;

const WITH_FOOTER = `<ProductOverview
  title="Overview"
  subtitle="Product landing page."
  footer={
    <div className="flex flex-col gap-4">
      <Text variant="heading2">Common use cases</Text>
      <DocumentationCard
        title="Getting started"
        description="Learn the basics."
        href="/docs/getting-started"
      />
      <DocumentationCard
        title="Advanced usage"
        description="Explore advanced features."
        href="/docs/advanced"
      />
    </div>
  }
>
  {/* content */}
</ProductOverview>`;

const HIDE_SECTIONS = `<ProductOverview
  title="Minimal Page"
  subtitle="Only main content, no sidebar."
  hideRightColumn={true}
  hideHeader={false}
>
  {/* Full-width content */}
</ProductOverview>`;

const PROPS_DATA = [
  {
    name: "title",
    type: "string",
    default: "—",
    required: "No",
    description: "Page heading text",
  },
  {
    name: "titleIcon",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Icon rendered next to the title",
  },
  {
    name: "subtitle",
    type: "string",
    default: "—",
    required: "No",
    description: "Subtitle below the heading",
  },
  {
    name: "actions",
    type: "ReactNode[]",
    default: "—",
    required: "No",
    description: "Array of action buttons for the header",
  },
  {
    name: "children",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Main content area — tables, charts, forms, etc.",
  },
  {
    name: "metrics",
    type: "MetricsProps[]",
    default: "—",
    required: "No",
    description: "Array of metric cards for the right column",
  },
  {
    name: "isMetricsLoading",
    type: "boolean",
    default: "false",
    required: "No",
    description: "Show skeleton loaders for all metrics",
  },
  {
    name: "usageLimits",
    type: "UsageLimit[]",
    default: "—",
    required: "No",
    description: "Array of usage limits with progress bars",
  },
  {
    name: "displayedDates",
    type: "{ start: Date; end: Date }",
    default: "—",
    required: "No",
    description: "Billing period date range",
  },
  {
    name: "displayedDatesTooltip",
    type: "string",
    default: '"Current billing period"',
    required: "No",
    description: "Tooltip for the date range",
  },
  {
    name: "footer",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Footer content (use case cards, links, etc.)",
  },
  {
    name: "hideRightColumn",
    type: "boolean",
    default: "false",
    required: "No",
    description: "Hide the entire right sidebar",
  },
  {
    name: "hideHeader",
    type: "boolean",
    default: "false",
    required: "No",
    description: "Hide the page header",
  },
  {
    name: "className",
    type: "string",
    default: "—",
    required: "No",
    description: "Extra CSS classes on the outer wrapper",
  },
];

const METRICS_TYPE = `export type MetricsProps = {
  title: string;           // Label for the metric
  value: string | ReactNode; // Display value
  tooltip?: ReactNode;     // Optional tooltip content
  loading?: boolean;       // Show skeleton loader
};`;

const USAGE_LIMIT_TYPE = `export type UsageLimit = {
  translatedName: string;  // Label for the limit
  usedQuantity: number;    // Current usage
  limit: number;           // Maximum allowed
  renderValue?: (value: number) => string; // Custom formatter
};`;

export default function ProductOverviewDocPage() {
  return (
    <ProductOverview title="Product Overview" subtitle={PAGE_DESCRIPTION}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton
            key="example"
            variant="primary"
            href="/product-overview-example"
          >
            View Example
          </LinkButton>
          <LinkButton
            key="code"
            variant="secondary"
            href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/blob/7d1fd3b6569c9fdfeee7de41224420915190336c/app/components/templates/ProductOverview.tsx"
            target="_blank"
          >
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>
        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The{" "}
              <Text variant="mono" size="lg">
                ProductOverview
              </Text>{" "}
              template provides a product landing page layout with a two-column
              design. It includes support for metrics cards, usage limits with
              progress bars, and a footer section for use case cards or
              additional content.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The template composes{" "}
              <Text variant="mono" size="lg">
                PrimaryPageHeader
              </Text>{" "}
              and{" "}
              <Text variant="mono" size="lg">
                PageSurface
              </Text>{" "}
              blocks. All props are optional — you can use as few or as many
              features as needed.
            </span>
          </Text>
        </div>

        {/* ---- Visual Layout ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Visual Layout</Text>
          <Text variant="secondary">
            The template renders the following structure. Sections marked with{" "}
            <Text variant="mono" size="lg">
              ?
            </Text>{" "}
            are only rendered when their corresponding prop is provided.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code
              lang="bash"
              code={`┌─ AppHeader (sticky) ──────────────────────────────────────────────┐
│ [portal target ← breadcrumbs land HERE when scrolled]              │
└───────────────────────────────────────────────────────────────────┘

┌─ ProductOverview ────────────────────────────────────────────┐
│  [titleIcon? + title + subtitle]                     [actions?]   │
│ ┌─ children ──────────────────────────┐ ┌─ Right Column ────────┐│
│ │  Main content area:                  │ │  [Usage limits?]      ││
│ │  tables, charts, forms, etc.         │ │  [Metrics cards?]     ││
│ │                                      │ │  [Footer?]            ││
│ └──────────────────────────────────────┘ └──────────────────────┘│
│                                          [Footer? (mobile)]       │
└──────────────────────────────────────────────────────────────────┘`}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">
            The simplest usage with just a title, subtitle, and content:
          </Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- Full Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Full Example</Text>
          <Text variant="secondary">
            Using all available props — metrics, usage limits, actions, and
            footer:
          </Text>
          <CodeBlock lang="tsx" code={FULL_USAGE} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for{" "}
            <Text variant="mono" size="lg">
              ProductOverview
            </Text>
            :
          </Text>
          <LayerCard>
            <LayerCard.Primary className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Prop name</Table.Head>
                    <Table.Head>Type</Table.Head>
                    <Table.Head>Default</Table.Head>
                    <Table.Head>Required</Table.Head>
                    <Table.Head>Description</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {PROPS_DATA.map((prop) => (
                    <Table.Row key={prop.name}>
                      <Table.Cell>
                        <Text variant="mono">{prop.name}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text variant="mono">{prop.type}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text variant="mono">{prop.default}</Text>
                      </Table.Cell>
                      <Table.Cell>{prop.required}</Table.Cell>
                      <Table.Cell>{prop.description}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>

          <Text variant="heading3">MetricsProps</Text>
          <Text variant="secondary">
            Each metric card in the right column. Supports tooltips and loading
            states.
          </Text>
          <CodeBlock lang="tsx" code={METRICS_TYPE} />

          <Text variant="heading3">UsageLimit</Text>
          <Text variant="secondary">
            Each usage limit entry. Only the single entry with the highest usage
            ratio is displayed with a progress bar.
          </Text>
          <CodeBlock lang="tsx" code={USAGE_LIMIT_TYPE} />
        </div>

        {/* ---- Recipes ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Recipes</Text>

          <Text variant="heading3">With Metrics Cards</Text>
          <Text variant="secondary">
            Display key metrics in the right column. Each card can have a
            tooltip and loading state.
          </Text>
          <CodeBlock lang="tsx" code={WITH_METRICS} />

          <Text variant="heading3">With Usage Limits</Text>
          <Text variant="secondary">
            Show resource consumption with progress bars. The limit with the
            highest usage ratio is displayed prominently. Provide{" "}
            <Text variant="mono" size="lg">
              displayedDates
            </Text>{" "}
            to show the billing period.
          </Text>
          <CodeBlock lang="tsx" code={WITH_USAGE_LIMITS} />

          <Text variant="heading3">With Footer Content</Text>
          <Text variant="secondary">
            Add use case cards, quick links, or other content to the footer. On
            large screens, the footer appears below the metrics in the right
            column. On smaller screens, it stacks below the main content.
          </Text>
          <CodeBlock lang="tsx" code={WITH_FOOTER} />

          <Text variant="heading3">Hide Sections</Text>
          <Text variant="secondary">
            Use{" "}
            <Text variant="mono" size="lg">
              hideRightColumn
            </Text>{" "}
            for a full-width layout, or{" "}
            <Text variant="mono" size="lg">
              hideHeader
            </Text>{" "}
            to remove the page header entirely.
          </Text>
          <CodeBlock lang="tsx" code={HIDE_SECTIONS} />
        </div>
      </div>
    </ProductOverview>
  );
}
