import { SquaresFourIcon, CodeIcon } from "@phosphor-icons/react";
import { Surface, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { OverviewCard } from "~/components/blocks/OverviewCard";

export const PAGE_DESCRIPTION = "A foundational card wrapper block that provides a consistent header with title, badge, action, and optional link — used as the base for many other card blocks.";

const BASIC_USAGE = `import { OverviewCard } from "~/components/blocks/OverviewCard";

export default function MyPage() {
  return (
    <OverviewCard title="Summary">
      <div className="p-4">Card content goes here.</div>
    </OverviewCard>
  );
}`;

const WITH_HREF = `import { OverviewCard } from "~/components/blocks/OverviewCard";

<OverviewCard title="Service Details" href="/services/my-worker">
  <div className="p-4">Click the header to navigate.</div>
</OverviewCard>`;

const WITH_BADGE_AND_ACTION = `import { OverviewCard } from "~/components/blocks/OverviewCard";
import { Badge, Button } from "@cloudflare/kumo";

<OverviewCard
  title="Endpoints"
  badge={<Badge variant="secondary">3</Badge>}
  action={<Button variant="ghost" size="sm">Manage</Button>}
>
  <div className="p-4">Table or list content.</div>
</OverviewCard>`;

const WITH_HEADER_CLICK = `<OverviewCard
  title="Clickable Header"
  onHeaderClick={() => console.log("header clicked")}
>
  <div className="p-4">Content area.</div>
</OverviewCard>`;

const COMPOUND_USAGE = `import { OverviewCard } from "~/components/blocks/OverviewCard";

<OverviewCard>
  <OverviewCard.Header>
    <span>Custom header content</span>
  </OverviewCard.Header>
  <OverviewCard.Content>
    <div className="p-4">Custom body content.</div>
  </OverviewCard.Content>
</OverviewCard>`;

const PROPS_DATA = [
  { name: "className", type: "string", default: "—", required: "No", description: "Additional CSS class names for the outer LayerCard" },
  { name: "headerClassName", type: "string", default: "—", required: "No", description: "Additional CSS class names for the header section" },
  { name: "contentClassName", type: "string", default: "—", required: "No", description: "Additional CSS class names for the content section" },
  { name: "title", type: "ReactNode", default: "—", required: "No", description: "Heading content displayed in the card header" },
  { name: "badge", type: "ReactNode", default: "—", required: "No", description: "Optional badge rendered next to the title" },
  { name: "action", type: "ReactNode", default: "—", required: "No", description: "Optional action element on the right side of the header (replaces the arrow when present)" },
  { name: "children", type: "ReactNode", default: "—", required: "Yes", description: "Card body content" },
  { name: "href", type: "string", default: "—", required: "No", description: "URL that wraps the header in an anchor tag with an arrow icon" },
  { name: "onHeaderClick", type: "() => void", default: "—", required: "No", description: "Click handler for the header (used when no href is provided)" },
];

export default function OverviewCardDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Overview Card"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/OverviewCard.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">OverviewCard</Text> block is the foundational card
              wrapper used throughout the template system. It renders a{" "}
              <Text variant="mono" size="lg">LayerCard</Text> from{" "}
              <Text variant="mono" size="lg">@cloudflare/kumo</Text> with a structured header and
              content area.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The header supports a title, an optional badge, and an optional action element. When an{" "}
              <Text variant="mono" size="lg">href</Text> or{" "}
              <Text variant="mono" size="lg">onHeaderClick</Text> is provided, the header becomes
              clickable with a hover state and an arrow icon affordance.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              Other card blocks like <Text variant="mono" size="lg">DetailsCard</Text>,{" "}
              <Text variant="mono" size="lg">MetricsCard</Text>, and{" "}
              <Text variant="mono" size="lg">ListTableCard</Text> are built on top of{" "}
              <Text variant="mono" size="lg">OverviewCard</Text>. It also exposes compound
              components <Text variant="mono" size="lg">OverviewCard.Header</Text> and{" "}
              <Text variant="mono" size="lg">OverviewCard.Content</Text> for advanced layouts.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="p-6 rounded-lg">
            <OverviewCard title="Service Summary" href="#">
              <div className="p-4">
                <Text variant="secondary">This is an example card with a linked header.</Text>
              </div>
            </OverviewCard>
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">The simplest usage with a title and children:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- With href ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Linked Header</Text>
          <Text variant="secondary">
            Pass an <Text variant="mono" size="lg">href</Text> to make the header a clickable link
            with an arrow affordance:
          </Text>
          <CodeBlock lang="tsx" code={WITH_HREF} />
        </div>

        {/* ---- With Badge & Action ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Badge and Action</Text>
          <Text variant="secondary">
            Use <Text variant="mono" size="lg">badge</Text> and{" "}
            <Text variant="mono" size="lg">action</Text> to enrich the header:
          </Text>
          <CodeBlock lang="tsx" code={WITH_BADGE_AND_ACTION} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">OverviewCard</Text>:
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

        {/* ---- Recipes ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Recipes</Text>

          <Text variant="heading3">Header Click Handler</Text>
          <Text variant="secondary">
            Use <Text variant="mono" size="lg">onHeaderClick</Text> for in-app actions instead of
            navigation:
          </Text>
          <CodeBlock lang="tsx" code={WITH_HEADER_CLICK} />

          <Text variant="heading3">Compound Components</Text>
          <Text variant="secondary">
            Use <Text variant="mono" size="lg">OverviewCard.Header</Text> and{" "}
            <Text variant="mono" size="lg">OverviewCard.Content</Text> for fully custom layouts:
          </Text>
          <CodeBlock lang="tsx" code={COMPOUND_USAGE} />
        </div>
      </div>
    </ProductOverview>
  );
}
