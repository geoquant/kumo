import { useState } from "react";
import { Badge, Button, Combobox, InputGroup, LayerCard, Pagination, Table, Link, Text } from "@cloudflare/kumo";
import {
  MagnifyingGlassIcon,
  SubwayIcon,
  ArrowsClockwiseIcon,
  DotsThreeIcon,
  GlobeSimpleIcon,
  NetworkIcon,
  LockIcon,
  CloudArrowUpIcon,
  PlusIcon,
  PlayCircleIcon,
} from "@phosphor-icons/react";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { DocumentationCard } from "~/components/blocks/DocumentationCard";
import { TemplatePill } from "~/components/blocks/TemplatePill";
import { tunnels, type TunnelRoute } from "~/data/tunnels";

const routeTypeConfig: Record<string, { icon: React.ComponentType<any>; label: string }> = {
  "Published application": { icon: GlobeSimpleIcon, label: "app" },
  "Private CIDR": { icon: NetworkIcon, label: "CIDR" },
  "Private hostname": { icon: LockIcon, label: "hostname" },
  "VPC": { icon: CloudArrowUpIcon, label: "VPC" },
};

function getRouteCounts(routes: TunnelRoute[]) {
  const counts: Record<string, number> = {};
  for (const r of routes) {
    counts[r.routeType] = (counts[r.routeType] || 0) + 1;
  }
  return Object.entries(counts).map(([type, count]) => ({
    type,
    count,
    ...routeTypeConfig[type],
  }));
}

export const PAGE_DESCRIPTION = "A product overview page example using the Product Overview template. Clicking on individual tunnels will navigate to a Service Detail example page.";

const statuses = ["All statuses", "Healthy", "Degraded", "Down"];

export default function ProductOverviewExamplePage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("All statuses");

  return (
    <>
    <ProductOverview
      titleIcon={<SubwayIcon weight="duotone" className="text-kumo-strong" size={28} />}
      title="Tunnels"
      subtitle="Create secure, outbound-only connections from your infrastructure to Cloudflare without opening inbound ports."
      actions={[
        <Button key="video" variant="secondary" icon={<PlayCircleIcon size={16} />}>
          Video guide
        </Button>,
        <Button key="docs" variant="secondary">Documentation</Button>,
        <Button key="create" variant="primary" icon={<PlusIcon size={16} />}>
          Create tunnel
        </Button>
      ]}
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Text variant="heading2">Common use cases</Text>
            <Text variant="secondary">Learn how to use Cloudflare Tunnel for different scenarios.</Text>
          </div>
          <DocumentationCard
            title="Publish web apps and APIs to the Internet"
            description="Learn how to expose your HTTP applications to the public Internet through Cloudflare."
            href="https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/#2a-publish-an-application"
          />
          <DocumentationCard
            title="Deploy highly available replicas"
            description="Set up multiple replicas for production-grade reliability and failover."
            href="https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/"
          />
          <DocumentationCard
            title="Connect Workers to private services"
            description="Enable Workers to communicate with services in your VPC using Cloudflare Tunnel."
            href="https://developers.cloudflare.com/workers-vpc/configuration/tunnel/"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <InputGroup className="bg-kumo-base flex-1">
            <InputGroup.Label>
              <MagnifyingGlassIcon size={16} />
            </InputGroup.Label>
            <InputGroup.Input
              name="search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <Combobox value={status} onValueChange={(v) => setStatus(v ?? "All statuses")}>
            <Combobox.TriggerValue />
            <Combobox.Content>
              <Combobox.List>
                {statuses.map((s) => (
                  <Combobox.Item key={s} value={s}>
                    {s}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Content>
          </Combobox>
          <Button variant="secondary">
            Edit columns
          </Button>
          <Button variant="secondary" shape="square" icon={ArrowsClockwiseIcon} aria-label="Refresh" />
        </div>

        {/* Table */}
        <LayerCard>
          <LayerCard.Primary className="p-0">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Name</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Replicas</Table.Head>
                  <Table.Head>Routes</Table.Head>
                  <Table.Head></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tunnels.map((tunnel) => (
                  <Table.Row key={tunnel.tunnelId}>
                    <Table.Cell>
                      <Link href={`/service-detail-example/${encodeURIComponent(tunnel.name.replace(/ /g, "-"))}`}>{tunnel.name}</Link>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="secondary">{tunnel.status}</Badge>
                    </Table.Cell>
                    <Table.Cell>{tunnel.replicas.length}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {getRouteCounts(tunnel.routes).map(({ type, count, icon: Icon, label }) => (
                          <Badge key={type} variant="outline">
                            <span className="flex items-center gap-1">
                              <Icon size={14} /> {count} {label}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right" style={{ width: "30px" }}>
                      <Button variant="ghost" size="sm" shape="square" aria-label="More actions">
                        <DotsThreeIcon weight="bold" size={16} />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </LayerCard.Primary>
        </LayerCard>
        {/* Pagination */}
        <Pagination
          page={page}
          setPage={setPage}
          perPage={10}
          totalCount={tunnels.length}
        />
      </div>
    </ProductOverview>

    {/* ---- DOCUMENTATION ONLY — DO NOT COPY TO PRODUCTION CODE ---- */}
    <TemplatePill templateName="Product Overview" templateHref="/product-overview-doc" />
    </>
  );
}
