import { SquaresFourIcon, BookOpenIcon, CodeIcon } from "@phosphor-icons/react";
import { Surface, Code, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { DocumentationCard } from "~/components/blocks/DocumentationCard";

export const PAGE_DESCRIPTION = "A clickable card block that displays a title, description, and optional tags — used for linking to documentation or external resources.";

const BASIC_USAGE = `import { DocumentationCard } from "~/components/blocks/DocumentationCard";

export default function MyPage() {
  return (
    <DocumentationCard
      title="Getting Started"
      description="Learn how to set up your first Worker."
      href="https://developers.cloudflare.com/workers/"
    />
  );
}`;

const WITH_ONCLICK = `import { DocumentationCard } from "~/components/blocks/DocumentationCard";

export default function MyPage() {
  return (
    <DocumentationCard
      title="Quick Action"
      description="Click to trigger an in-app action."
      onClick={() => console.log("clicked")}
    />
  );
}`;

const WITH_TAGS = `import { DocumentationCard } from "~/components/blocks/DocumentationCard";
import { BookOpenIcon, CodeIcon } from "@phosphor-icons/react";

export default function MyPage() {
  return (
    <DocumentationCard
      title="API Reference"
      description="Full REST API documentation for the Workers platform."
      href="https://developers.cloudflare.com/api/"
      tags={[
        { label: "REST", icon: CodeIcon },
        { label: "Guide", icon: BookOpenIcon },
      ]}
    />
  );
}`;

const SAME_TAB = `<DocumentationCard
  title="Internal Docs"
  description="Opens in the same tab instead of a new one."
  href="/internal/docs"
  openInNewTab={false}
/>`;

const PROPS_DATA = [
  { name: "title", type: "string", default: "—", required: "Yes", description: "Card heading text" },
  { name: "description", type: "string", default: "—", required: "Yes", description: "Body text displayed below the title" },
  { name: "onClick", type: "() => void", default: "—", required: "No", description: "Click handler — used when no href is provided" },
  { name: "href", type: "string", default: "—", required: "No", description: "URL to open when the card is clicked (takes precedence over onClick)" },
  { name: "openInNewTab", type: "boolean", default: "true", required: "No", description: "Whether href opens in a new tab (_blank) or the same tab (_self)" },
  { name: "tags", type: "ButtonTag[]", default: "—", required: "No", description: "Array of badge tags rendered at the bottom of the card" },
];

const BUTTON_TAG_PROPS = [
  { name: "label", type: "string", default: "—", required: "Yes", description: "Text displayed inside the badge" },
  { name: "icon", type: "Icon", default: "—", required: "No", description: "Optional Phosphor icon type (not currently rendered, reserved for future use)" },
];

export default function DocumentationCardDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Documentation Card"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/DocumentationCard.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">DocumentationCard</Text> block renders a clickable
              card with a title, description, an arrow affordance, and optional tags. It is designed
              for linking users to documentation pages or external resources.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              When an <Text variant="mono" size="lg">href</Text> is provided the card opens the URL
              (in a new tab by default). Otherwise it falls back to the{" "}
              <Text variant="mono" size="lg">onClick</Text> handler. The card includes a subtle
              hover animation that lifts it upward with a shadow for clear interactive feedback.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              Tags are rendered as <Text variant="mono" size="lg">Badge</Text> components from{" "}
              <Text variant="mono" size="lg">@cloudflare/kumo</Text> with the{" "}
              <Text variant="mono" size="lg">outline</Text> variant. They appear in a flex-wrap row
              at the bottom of the card.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="p-6 rounded-lg">
            <DocumentationCard
              title="API Reference"
              description="Full REST API documentation for the Workers platform."
              href="https://developers.cloudflare.com/api/"
              tags={[
                { label: "REST", icon: CodeIcon },
                { label: "Guide", icon: BookOpenIcon },
              ]}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">The simplest usage with a title, description, and an external link:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- With onClick ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With onClick Handler</Text>
          <Text variant="secondary">
            Use <Text variant="mono" size="lg">onClick</Text> instead of{" "}
            <Text variant="mono" size="lg">href</Text> for in-app actions:
          </Text>
          <CodeBlock lang="tsx" code={WITH_ONCLICK} />
        </div>

        {/* ---- With Tags ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Tags</Text>
          <Text variant="secondary">
            Pass an array of <Text variant="mono" size="lg">ButtonTag</Text> objects to render
            badge labels at the bottom of the card:
          </Text>
          <CodeBlock lang="tsx" code={WITH_TAGS} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">DocumentationCard</Text>:
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

        {/* ---- ButtonTag Type ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">ButtonTag Type</Text>
          <Text variant="secondary">
            Each item in the <Text variant="mono" size="lg">tags</Text> array conforms to the{" "}
            <Text variant="mono" size="lg">ButtonTag</Text> type:
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
                  {BUTTON_TAG_PROPS.map((prop) => (
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

          <Text variant="heading3">Open in Same Tab</Text>
          <Text variant="secondary">
            Set <Text variant="mono" size="lg">openInNewTab</Text> to{" "}
            <Text variant="mono" size="lg">false</Text> to navigate in the current window:
          </Text>
          <CodeBlock lang="tsx" code={SAME_TAB} />
        </div>
      </div>
    </ProductOverview>
  );
}
