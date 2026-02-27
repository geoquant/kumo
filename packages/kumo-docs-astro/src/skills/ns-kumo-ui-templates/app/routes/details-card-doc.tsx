import { SquaresFourIcon, PencilSimpleIcon, CopyIcon, CodeIcon } from "@phosphor-icons/react";
import { Surface, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { DetailsCard } from "~/components/blocks/DetailsCard";

export const PAGE_DESCRIPTION = "A key-value detail list block built on OverviewCard — displays labelled rows with optional inline actions.";

const BASIC_USAGE = `import { DetailsCard } from "~/components/blocks/DetailsCard";

export default function MyPage() {
  return (
    <DetailsCard
      title="Service Details"
      items={[
        { title: "Name", value: "my-worker" },
        { title: "Region", value: "US East" },
        { title: "Status", value: "Active" },
      ]}
    />
  );
}`;

const WITH_ACTIONS = `import { DetailsCard } from "~/components/blocks/DetailsCard";
import { PencilSimpleIcon, CopyIcon } from "@phosphor-icons/react";

export default function MyPage() {
  return (
    <DetailsCard
      title="Configuration"
      items={[
        {
          title: "Endpoint",
          value: "https://api.example.com",
          actionIcon: CopyIcon,
          actionLabel: "Copy endpoint",
          onAction: () => navigator.clipboard.writeText("https://api.example.com"),
        },
        {
          title: "Token",
          value: "sk-****",
          actionIcon: PencilSimpleIcon,
          actionLabel: "Edit token",
          onAction: () => console.log("edit"),
        },
      ]}
    />
  );
}`;

const WITH_HREF = `<DetailsCard
  title="Service Details"
  items={items}
  href="/services/my-worker"
/>`;

const PROPS_DATA = [
  { name: "title", type: "string", default: "—", required: "Yes", description: "Heading text displayed in the card header" },
  { name: "items", type: "DetailItem[]", default: "—", required: "Yes", description: "Array of key-value rows to render" },
  { name: "href", type: "string", default: "—", required: "No", description: "Optional link on the card header (passed to OverviewCard)" },
];

const DETAIL_ITEM_PROPS = [
  { name: "title", type: "string", default: "—", required: "Yes", description: "Row label displayed above the value" },
  { name: "value", type: "string", default: "—", required: "No", description: "Text value displayed in the row (shows \"—\" when empty)" },
  { name: "action", type: "ReactNode", default: "—", required: "No", description: "Custom action element rendered on the right side of the row" },
  { name: "actionIcon", type: "Icon", default: "—", required: "No", description: "Phosphor icon rendered as a ghost button when no custom action is provided" },
  { name: "actionLabel", type: "string", default: "—", required: "No", description: "Accessible label for the action button" },
  { name: "onAction", type: "() => void", default: "—", required: "No", description: "Click handler for the action button" },
];

export default function DetailsCardDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Details Card"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/DetailsCard.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">DetailsCard</Text> block renders a vertical list of
              labelled key-value rows inside an{" "}
              <Text variant="mono" size="lg">OverviewCard</Text>. Each row shows a title, a value,
              and an optional action button.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              When a custom <Text variant="mono" size="lg">action</Text> ReactNode is provided it is
              rendered directly. Otherwise, if an{" "}
              <Text variant="mono" size="lg">actionIcon</Text> is supplied, a ghost{" "}
              <Text variant="mono" size="lg">Button</Text> from{" "}
              <Text variant="mono" size="lg">@cloudflare/kumo</Text> is rendered automatically.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="p-6 rounded-lg">
            <DetailsCard
              title="Service Details"
              items={[
                { title: "Name", value: "my-worker" },
                { title: "Region", value: "US East" },
                {
                  title: "Endpoint",
                  value: "https://api.example.com",
                  actionIcon: CopyIcon,
                  actionLabel: "Copy endpoint",
                },
                {
                  title: "Token",
                  value: "sk-****",
                  actionIcon: PencilSimpleIcon,
                  actionLabel: "Edit token",
                },
              ]}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">The simplest usage with title and value rows:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- With Actions ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Action Icons</Text>
          <Text variant="secondary">
            Supply <Text variant="mono" size="lg">actionIcon</Text> and{" "}
            <Text variant="mono" size="lg">onAction</Text> to render inline action buttons:
          </Text>
          <CodeBlock lang="tsx" code={WITH_ACTIONS} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">DetailsCard</Text>:
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

        {/* ---- DetailItem Type ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">DetailItem Type</Text>
          <Text variant="secondary">
            Each item in the <Text variant="mono" size="lg">items</Text> array conforms to the{" "}
            <Text variant="mono" size="lg">DetailItem</Text> interface:
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
                  {DETAIL_ITEM_PROPS.map((prop) => (
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

          <Text variant="heading3">Linked Header</Text>
          <Text variant="secondary">
            Pass an <Text variant="mono" size="lg">href</Text> to make the card header a clickable
            link with an arrow affordance:
          </Text>
          <CodeBlock lang="tsx" code={WITH_HREF} />
        </div>
      </div>
    </ProductOverview>
  );
}
