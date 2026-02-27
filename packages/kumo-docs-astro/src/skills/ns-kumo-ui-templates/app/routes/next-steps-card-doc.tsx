import { SquaresFourIcon, BookOpenIcon, RocketIcon, GearIcon, CodeIcon } from "@phosphor-icons/react";
import { Surface, Text, CodeBlock, Table, LayerCard, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { NextStepsCard } from "~/components/blocks/NextStepsCard";

export const PAGE_DESCRIPTION = "A clickable step-list card block built on OverviewCard — displays a vertical list of actionable next steps with titles, descriptions, and arrow affordances.";

const BASIC_USAGE = `import { NextStepsCard } from "~/components/blocks/NextStepsCard";

export default function MyPage() {
  return (
    <NextStepsCard
      steps={[
        {
          title: "Configure DNS",
          description: "Point your domain to Cloudflare.",
          href: "/dns/settings",
        },
        {
          title: "Enable firewall",
          description: "Set up WAF rules for your zone.",
          href: "/security/waf",
        },
      ]}
    />
  );
}`;

const WITH_ICONS = `import { NextStepsCard } from "~/components/blocks/NextStepsCard";
import { RocketIcon, GearIcon, BookOpenIcon } from "@phosphor-icons/react";

export default function MyPage() {
  return (
    <NextStepsCard
      steps={[
        {
          title: "Quick start",
          description: "Deploy your first Worker in minutes.",
          icon: <RocketIcon size={16} />,
          href: "/workers/quick-start",
        },
        {
          title: "Configuration",
          description: "Adjust runtime settings and bindings.",
          icon: <GearIcon size={16} />,
          href: "/workers/settings",
        },
        {
          title: "Documentation",
          description: "Read the full platform reference.",
          icon: <BookOpenIcon size={16} />,
          href: "https://developers.cloudflare.com/workers/",
        },
      ]}
    />
  );
}`;

const WITH_ID = `<NextStepsCard
  steps={[
    {
      id: "step-dns",
      title: "Configure DNS",
      description: "Point your domain to Cloudflare.",
      href: "/dns/settings",
    },
  ]}
/>`;

const PROPS_DATA = [
  { name: "steps", type: "NextStep[]", default: "—", required: "Yes", description: "Array of step items rendered as clickable rows inside the card" },
];

const NEXT_STEP_PROPS = [
  { name: "id", type: "string", default: "—", required: "No", description: "Unique key for the step row (used as the React key)" },
  { name: "icon", type: "ReactNode", default: "—", required: "No", description: "Optional icon rendered before the title" },
  { name: "title", type: "string", default: "—", required: "Yes", description: "Bold heading text for the step" },
  { name: "description", type: "string", default: "—", required: "Yes", description: "Body text displayed below the title" },
  { name: "href", type: "string", default: "—", required: "No", description: "URL the step row links to" },
];

export default function NextStepsCardDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Next Steps Card"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/NextStepsCard.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">NextStepsCard</Text> block renders a vertical list
              of actionable steps inside an <Text variant="mono" size="lg">OverviewCard</Text> with
              a fixed "Next steps" title. Each step is a clickable row with a title, description, and
              an arrow affordance.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              Steps are separated by divider lines. Each row links to the URL provided in its{" "}
              <Text variant="mono" size="lg">href</Text> prop. An optional icon can be rendered
              before the title for additional visual context.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The card is designed for onboarding flows and service detail pages where users need
              guided actions to complete setup or configuration tasks.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="p-6 rounded-lg">
            <NextStepsCard
              steps={[
                {
                  title: "Quick start",
                  description: "Deploy your first Worker in minutes.",
                  icon: <RocketIcon size={16} />,
                  href: "/workers/quick-start",
                },
                {
                  title: "Configuration",
                  description: "Adjust runtime settings and bindings.",
                  icon: <GearIcon size={16} />,
                  href: "/workers/settings",
                },
                {
                  title: "Documentation",
                  description: "Read the full platform reference.",
                  icon: <BookOpenIcon size={16} />,
                  href: "https://developers.cloudflare.com/workers/",
                },
              ]}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">The simplest usage with step titles, descriptions, and links:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- With Icons ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Icons</Text>
          <Text variant="secondary">
            Pass an <Text variant="mono" size="lg">icon</Text> ReactNode to render a visual
            indicator before each step title:
          </Text>
          <CodeBlock lang="tsx" code={WITH_ICONS} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">NextStepsCard</Text>:
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

        {/* ---- NextStep Type ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">NextStep Type</Text>
          <Text variant="secondary">
            Each item in the <Text variant="mono" size="lg">steps</Text> array conforms to the{" "}
            <Text variant="mono" size="lg">NextStep</Text> interface:
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
                  {NEXT_STEP_PROPS.map((prop) => (
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

          <Text variant="heading3">Explicit Row Keys</Text>
          <Text variant="secondary">
            Provide an <Text variant="mono" size="lg">id</Text> on each step to use as the React
            key instead of relying on array index:
          </Text>
          <CodeBlock lang="tsx" code={WITH_ID} />
        </div>
      </div>
    </ProductOverview>
  );
}
