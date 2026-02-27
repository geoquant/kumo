import { SquaresFourIcon, GlobeIcon, ShieldCheckIcon, DatabaseIcon, CodeIcon, InfoIcon } from "@phosphor-icons/react";
import { Surface, Text, CodeBlock, Table, LayerCard, LinkButton, Banner } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { ArchitectureDiagram } from "~/components/blocks/ArchitectureDiagram";
import type { BindingItem } from "~/components/blocks/ArchitectureDiagram";

export const PAGE_DESCRIPTION = "A visual diagram block that renders service bindings as pills connected to a central destination node via SVG connector lines.";

const BASIC_USAGE = `import { ArchitectureDiagram } from "~/components/blocks/ArchitectureDiagram";
import { GlobeIcon } from "@phosphor-icons/react";

export default function MyPage() {
  return (
    <ArchitectureDiagram
      workerName="My Service"
      bindings={[
        { name: "example.com/*", type: "HTTP", icon: <GlobeIcon size={14} /> },
      ]}
    />
  );
}`;

const MULTIPLE_BINDINGS = `import { ArchitectureDiagram } from "~/components/blocks/ArchitectureDiagram";
import { GlobeIcon, ShieldCheckIcon, DatabaseIcon } from "@phosphor-icons/react";

export default function MyPage() {
  return (
    <ArchitectureDiagram
      workerName="Edge Worker"
      bindings={[
        { name: "api.example.com/*", type: "HTTP", icon: <GlobeIcon size={14} /> },
        { name: "auth.example.com", type: "Auth", icon: <ShieldCheckIcon size={14} />, isExternal: true },
        { name: "cache-store", type: "KV", icon: <DatabaseIcon size={14} /> },
      ]}
    />
  );
}`;

const WITHOUT_ADD_ROUTE = `<ArchitectureDiagram
  workerName="Read-Only Service"
  bindings={bindings}
  canUpdate={false}
/>`;

const PROPS_DATA = [
  { name: "className", type: "string", default: "—", required: "No", description: "Additional CSS class names for the outer container" },
  { name: "bindings", type: "BindingItem[]", default: "—", required: "Yes", description: "Array of binding items rendered as route pills on the left" },
  { name: "canUpdate", type: "boolean", default: "true", required: "No", description: "Whether to show the \"+ Route\" button at the bottom of the binding list" },
  { name: "workerName", type: "string", default: '"Service"', required: "No", description: "Label displayed inside the destination node on the right" },
];

const BINDING_ITEM_PROPS = [
  { name: "name", type: "string", default: "—", required: "Yes", description: "Text displayed in the name pill" },
  { name: "type", type: "string", default: "—", required: "Yes", description: "Label displayed in the blue type badge" },
  { name: "icon", type: "ReactNode", default: "—", required: "Yes", description: "Icon rendered inside the type badge" },
  { name: "isExternal", type: "boolean", default: "false", required: "No", description: "Shows an arrow-out icon next to the name to indicate an external link" },
];

const SAMPLE_BINDINGS: BindingItem[] = [
  { name: "api.example.com/*", type: "HTTP", icon: <GlobeIcon size={14} /> },
  { name: "auth.example.com", type: "Auth", icon: <ShieldCheckIcon size={14} />, isExternal: true },
  { name: "cache-store", type: "KV", icon: <DatabaseIcon size={14} /> },
];

export default function ArchitectureDiagramDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Architecture Diagram"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/ArchitectureDiagram.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Info Banner ---- */}
        <Banner>
          Kumo UI is introducing a new <a href="https://kumo-ui.com/components/flow/" className="underline font-medium" target="_blank" rel="noopener noreferrer">Flow component</a> for node and connector diagrams. The current Architecture Diagram implementations are to be converted to the new Flow components.
        </Banner>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">ArchitectureDiagram</Text> block renders a visual
              representation of service bindings connected to a central destination node. Each binding
              is displayed as a pill containing a name and a colour-coded type badge.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              SVG cubic-bezier connector lines fan out from each binding row and converge on the
              destination node. The diagram includes a dotted background pattern and automatically
              recalculates connector positions on resize.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              When <Text variant="mono" size="lg">canUpdate</Text> is true an{" "}
              <Text variant="mono" size="lg">+ Route</Text> button is appended after the last
              binding row.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="rounded-lg overflow-hidden">
            <ArchitectureDiagram
              workerName="Edge Worker"
              bindings={SAMPLE_BINDINGS}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">A minimal example with a single binding:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- Multiple Bindings ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Multiple Bindings</Text>
          <Text variant="secondary">Pass several bindings to render multiple route pills with connector lines:</Text>
          <CodeBlock lang="tsx" code={MULTIPLE_BINDINGS} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">ArchitectureDiagram</Text>:
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

        {/* ---- BindingItem Type ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">BindingItem Type</Text>
          <Text variant="secondary">
            Each item in the <Text variant="mono" size="lg">bindings</Text> array conforms to the{" "}
            <Text variant="mono" size="lg">BindingItem</Text> interface:
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
                  {BINDING_ITEM_PROPS.map((prop) => (
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

          <Text variant="heading3">Hide the Add Route Button</Text>
          <Text variant="secondary">
            Set <Text variant="mono" size="lg">canUpdate</Text> to{" "}
            <Text variant="mono" size="lg">false</Text> to render a read-only diagram:
          </Text>
          <CodeBlock lang="tsx" code={WITHOUT_ADD_ROUTE} />
        </div>
      </div>
    </ProductOverview>
  );
}
