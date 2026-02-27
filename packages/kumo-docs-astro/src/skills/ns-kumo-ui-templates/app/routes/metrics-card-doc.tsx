import { SquaresFourIcon, CodeIcon } from "@phosphor-icons/react";
import { Surface, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { MetricsCard } from "~/components/blocks/MetricsCard";

export const PAGE_DESCRIPTION = "A horizontal metrics strip block built on OverviewCard — displays labelled KPI values with optional units and status badges.";

const BASIC_USAGE = `import { MetricsCard } from "~/components/blocks/MetricsCard";

export default function MyPage() {
  return (
    <MetricsCard
      metrics={[
        { label: "Requests", value: "1.2M", unit: "/day" },
        { label: "Latency", value: "42", unit: "ms" },
        { label: "Error Rate", value: "0.03", unit: "%" },
      ]}
    />
  );
}`;

const WITH_STATUS_BADGE = `import { MetricsCard } from "~/components/blocks/MetricsCard";

<MetricsCard
  metrics={[
    { label: "Health", statusBadge: "Healthy" },
    { label: "Uptime", value: "99.99", unit: "%" },
    { label: "Incidents", value: "0" },
  ]}
/>`;

const WITH_INFO_ICON = `<MetricsCard
  metrics={[
    { label: "P50 Latency", value: "12", unit: "ms", showInfo: true },
    { label: "P99 Latency", value: "230", unit: "ms", showInfo: true },
  ]}
/>`;

const PROPS_DATA = [
  { name: "metrics", type: "MetricItemConfig[]", default: "—", required: "Yes", description: "Array of metric items to render as equal-width columns" },
];

const METRIC_ITEM_PROPS = [
  { name: "label", type: "string", default: "—", required: "Yes", description: "Metric label displayed above the value" },
  { name: "value", type: "string", default: "—", required: "No", description: "Primary numeric or text value" },
  { name: "unit", type: "string", default: "—", required: "No", description: "Unit suffix displayed next to the value" },
  { name: "showInfo", type: "boolean", default: "false", required: "No", description: "Whether to show an info icon next to the label" },
  { name: "statusBadge", type: "string", default: "—", required: "No", description: 'Renders a coloured status badge (supports "Healthy", "Degraded", "Down")' },
];

export default function MetricsCardDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Metrics Card"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/MetricsCard.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">MetricsCard</Text> block renders a row of KPI
              metrics inside an <Text variant="mono" size="lg">OverviewCard</Text>. Each metric
              occupies an equal-width column separated by vertical borders.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              Metrics can display a numeric value with an optional unit suffix, an info icon for
              additional context, or a coloured status badge. The status badge colour is determined
              automatically based on the string value:{" "}
              <Text variant="mono" size="lg">"Healthy"</Text>,{" "}
              <Text variant="mono" size="lg">"Degraded"</Text>, or{" "}
              <Text variant="mono" size="lg">"Down"</Text>.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="p-6 rounded-lg">
            <MetricsCard
              metrics={[
                { label: "Requests", value: "1.2M", unit: "/day" },
                { label: "Latency", value: "42", unit: "ms" },
                { label: "Error Rate", value: "0.03", unit: "%" },
                { label: "Health", statusBadge: "Healthy" },
              ]}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">Pass an array of metric objects with labels, values, and units:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- With Status Badge ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Status Badge</Text>
          <Text variant="secondary">
            Use <Text variant="mono" size="lg">statusBadge</Text> to render a coloured pill instead
            of a numeric value:
          </Text>
          <CodeBlock lang="tsx" code={WITH_STATUS_BADGE} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">MetricsCard</Text>:
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
                      <Table.Cell><Text variant="mono">{prop.name}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.type}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.default}</Text></Table.Cell>
                      <Table.Cell>{prop.required}</Table.Cell>
                      <Table.Cell>{prop.description}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>
        </div>

        {/* ---- MetricItemConfig Type ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">MetricItemConfig Type</Text>
          <Text variant="secondary">
            Each item in the <Text variant="mono" size="lg">metrics</Text> array conforms to the{" "}
            <Text variant="mono" size="lg">MetricItemConfig</Text> interface:
          </Text>
          <LayerCard>
            <LayerCard.Primary className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Property</Table.Head>
                    <Table.Head>Type</Table.Head>
                    <Table.Head>Default</Table.Head>
                    <Table.Head>Required</Table.Head>
                    <Table.Head>Description</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {METRIC_ITEM_PROPS.map((prop) => (
                    <Table.Row key={prop.name}>
                      <Table.Cell><Text variant="mono">{prop.name}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.type}</Text></Table.Cell>
                      <Table.Cell><Text variant="mono">{prop.default}</Text></Table.Cell>
                      <Table.Cell>{prop.required}</Table.Cell>
                      <Table.Cell>{prop.description}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>
        </div>

        {/* ---- Recipes ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Recipes</Text>

          <Text variant="heading3">Info Tooltips</Text>
          <Text variant="secondary">
            Set <Text variant="mono" size="lg">showInfo</Text> to{" "}
            <Text variant="mono" size="lg">true</Text> to display an info icon next to the label:
          </Text>
          <CodeBlock lang="tsx" code={WITH_INFO_ICON} />
        </div>
      </div>
    </ProductOverview>
  );
}
