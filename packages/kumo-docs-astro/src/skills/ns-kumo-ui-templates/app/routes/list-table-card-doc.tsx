import { SquaresFourIcon, CodeIcon } from "@phosphor-icons/react";
import { Surface, Text, CodeBlock, Table, LayerCard, Badge, LinkButton } from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { ListTableCard } from "~/components/blocks/ListTableCard";

export const PAGE_DESCRIPTION = "A generic table card block built on OverviewCard — renders columnar data with a typed accessor pattern.";

const BASIC_USAGE = `import { ListTableCard } from "~/components/blocks/ListTableCard";

interface Route {
  hostname: string;
  path: string;
  status: string;
}

const columns = [
  { header: "Hostname", accessor: (row: Route) => row.hostname },
  { header: "Path", accessor: (row: Route) => row.path },
  { header: "Status", accessor: (row: Route) => row.status },
];

const data: Route[] = [
  { hostname: "example.com", path: "/*", status: "Active" },
  { hostname: "api.example.com", path: "/v1/*", status: "Active" },
];

export default function MyPage() {
  return (
    <ListTableCard
      title="Routes"
      columns={columns}
      data={data}
      rowKey={(row) => row.hostname + row.path}
    />
  );
}`;

const WITH_BADGE_AND_ACTION = `import { ListTableCard } from "~/components/blocks/ListTableCard";
import { Badge, Button } from "@cloudflare/kumo";

<ListTableCard
  title="Endpoints"
  badge={<Badge variant="secondary">3 active</Badge>}
  action={<Button variant="ghost" size="sm">View all</Button>}
  columns={columns}
  data={data}
  rowKey={(row, i) => String(i)}
/>`;

const CUSTOM_ACCESSOR = `const columns = [
  { header: "Name", accessor: (row: Route) => row.hostname },
  {
    header: "Status",
    accessor: (row: Route) => (
      <Badge variant={row.status === "Active" ? "primary" : "outline"}>
        {row.status}
      </Badge>
    ),
  },
];`;

interface SampleRoute {
  hostname: string;
  path: string;
  status: string;
}

const SAMPLE_DATA: SampleRoute[] = [
  { hostname: "example.com", path: "/*", status: "Active" },
  { hostname: "api.example.com", path: "/v1/*", status: "Active" },
  { hostname: "staging.example.com", path: "/*", status: "Inactive" },
];

const SAMPLE_COLUMNS = [
  { header: "Hostname", accessor: (row: SampleRoute) => row.hostname },
  { header: "Path", accessor: (row: SampleRoute) => row.path },
  {
    header: "Status",
    accessor: (row: SampleRoute) => (
      <Badge variant={row.status === "Active" ? "primary" : "outline"}>{row.status}</Badge>
    ),
  },
];

const PROPS_DATA = [
  { name: "title", type: "string", default: "—", required: "Yes", description: "Heading text displayed in the card header" },
  { name: "badge", type: "ReactNode", default: "—", required: "No", description: "Optional badge rendered next to the title" },
  { name: "action", type: "ReactNode", default: "—", required: "No", description: "Optional action element rendered on the right side of the header" },
  { name: "columns", type: "ListTableColumn<T>[]", default: "—", required: "Yes", description: "Column definitions with header labels and accessor functions" },
  { name: "data", type: "T[]", default: "—", required: "Yes", description: "Array of row data objects" },
  { name: "rowKey", type: "(row: T, index: number) => string", default: "—", required: "Yes", description: "Function that returns a unique key for each row" },
];

const COLUMN_PROPS = [
  { name: "header", type: "string", default: "—", required: "Yes", description: "Text displayed in the column header" },
  { name: "accessor", type: "(row: T) => ReactNode", default: "—", required: "Yes", description: "Function that extracts or renders cell content from a row" },
];

export default function ListTableCardDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="List Table Card"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton key="code" variant="secondary" href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/ListTableCard.tsx" target="_blank">
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The <Text variant="mono" size="lg">ListTableCard</Text> block renders a typed data
              table inside an <Text variant="mono" size="lg">OverviewCard</Text>. It accepts generic
              column definitions with accessor functions, making it easy to display any data shape.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              String values returned by accessors are automatically wrapped in a{" "}
              <Text variant="mono" size="lg">Text</Text> component. Non-string ReactNode values are
              rendered as-is, allowing custom cell content like badges or icons.
            </span>
          </Text>
        </div>

        {/* ---- Live Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Live Example</Text>
          <Surface className="p-6 rounded-lg">
            <ListTableCard
              title="Routes"
              badge={<Badge variant="secondary">{SAMPLE_DATA.length} routes</Badge>}
              columns={SAMPLE_COLUMNS}
              data={SAMPLE_DATA}
              rowKey={(row) => row.hostname + row.path}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">Define columns with accessors and pass your data array:</Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- With Badge & Action ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">With Badge and Action</Text>
          <Text variant="secondary">
            Use <Text variant="mono" size="lg">badge</Text> and{" "}
            <Text variant="mono" size="lg">action</Text> to enrich the card header:
          </Text>
          <CodeBlock lang="tsx" code={WITH_BADGE_AND_ACTION} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for <Text variant="mono" size="lg">ListTableCard</Text>:
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

        {/* ---- ListTableColumn Type ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">ListTableColumn Type</Text>
          <Text variant="secondary">
            Each item in the <Text variant="mono" size="lg">columns</Text> array conforms to the{" "}
            <Text variant="mono" size="lg">ListTableColumn</Text> interface:
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
                  {COLUMN_PROPS.map((prop) => (
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

          <Text variant="heading3">Custom Cell Content</Text>
          <Text variant="secondary">
            Return JSX from an accessor to render rich cell content such as badges:
          </Text>
          <CodeBlock lang="tsx" code={CUSTOM_ACCESSOR} />
        </div>
      </div>
    </ProductOverview>
  );
}
