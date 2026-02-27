import { useState, type ReactNode } from "react";
import { Badge, Breadcrumbs, Button, LayerCard, Link, LinkButton, Pagination, Table, Tabs, Text } from "@cloudflare/kumo";
import {
  ArrowsClockwiseIcon,
  BookOpenIcon,
  CloudArrowUpIcon,
  CopyIcon,
  GlobeSimpleIcon,
  LockIcon,
  NetworkIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  SubwayIcon
} from "@phosphor-icons/react";
import { useParams } from "react-router";
import { ArchitectureDiagram } from "~/components/blocks/ArchitectureDiagram";
import { DetailsCard, type DetailItem } from "~/components/blocks/DetailsCard";
import { ListTableCard, type ListTableColumn } from "~/components/blocks/ListTableCard";
import { MetricsCard, type MetricItemConfig } from "~/components/blocks/MetricsCard";
import { NextStepsCard, type NextStep } from "~/components/blocks/NextStepsCard";
import { OverviewCard } from "~/components/blocks/OverviewCard";
import { PageHeader } from "~/components/blocks/PageHeader";
import { ArchitectureTab } from "~/components/templates/ArchitectureTab";
import { ServiceOverview } from "~/components/templates/ServiceOverview";
import { TemplatePill } from "~/components/blocks/TemplatePill";
import { getTunnelByName, routesToBindings, type Tunnel, type TunnelReplica } from "~/data/tunnels";

// --- Route data ---

const routeTypeIconMap: Record<string, ReactNode> = {
  "Published application": <GlobeSimpleIcon size={16} />,
  "Private CIDR": <NetworkIcon size={16} />,
  "Private hostname": <LockIcon size={16} />,
  "VPC": <CloudArrowUpIcon size={16} />,
};

type TunnelBindings = ReturnType<typeof routesToBindings>;

function parseUptimeDays(uptime: string): number {
  const match = uptime.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function getDisplayNameFromParam(tunnelName?: string): string {
  if (!tunnelName) {
    return "Tunnel";
  }

  try {
    return decodeURIComponent(tunnelName).replace(/-/g, " ");
  } catch {
    return tunnelName.replace(/-/g, " ");
  }
}

function getTunnelMetrics(tunnel: Tunnel): MetricItemConfig[] {
  const totalReplicas = tunnel.replicas.length;
  const totalRoutes = tunnel.routes.length;
  const longestUptime = tunnel.replicas.reduce(
    (maxDays, replica) => Math.max(maxDays, parseUptimeDays(replica.uptime)),
    0
  );

  return [
    { label: "Active replicas", value: String(totalReplicas), showInfo: true },
    { label: "Routes", value: String(totalRoutes), showInfo: true },
    { label: "Status", statusBadge: tunnel.status },
    { label: "Uptime", value: String(longestUptime), unit: "days" },
  ];
}

const replicaColumns: ListTableColumn<TunnelReplica>[] = [
  {
    header: "Replica ID",
    accessor: (r) => (
      <div className="flex items-center gap-1">
        <Text>{r.replicaId}...</Text>
        <button
          type="button"
          className="text-kumo-text-secondary hover:text-kumo-text-default cursor-pointer"
          aria-label={`Copy replica ID ${r.replicaId}`}
        >
          <CopyIcon size={14} />
        </button>
      </div>
    ),
  },
  { header: "Origin IP", accessor: (r) => r.originIp },
  { header: "Edge locations", accessor: (r) => r.edgeLocations.join(", ") },
  { header: "Version", accessor: (r) => r.version },
  { header: "Architecture", accessor: (r) => r.architecture },
  { header: "Uptime", accessor: (r) => r.uptime },
];


export default function TunnelDetailPage() {
  const { tunnelName } = useParams<{ tunnelName?: string }>();
  const [activeTab, setActiveTab] = useState("overview");

  const displayName = getDisplayNameFromParam(tunnelName);

  const tunnel = getTunnelByName(displayName);

  if (!tunnel) {
    return (
      <>
      <PageHeader breadcrumbs={
        <Breadcrumbs>
          <Breadcrumbs.Link 
              icon={<SubwayIcon size={18} />} 
              href="/product-overview-example">
              Tunnels
          </Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>{displayName}</Breadcrumbs.Current>
        </Breadcrumbs>
      }>
        <ServiceOverview
          leftContent={[
            <OverviewCard key="tunnel-not-found" title="Tunnel not found">
              <div className="p-4">
                <Text variant="secondary">
                  We could not find a tunnel named "{displayName}".
                </Text>
              </div>
            </OverviewCard>,
          ]}
        />
      </PageHeader>

      {/* ---- DOCUMENTATION ONLY — DO NOT COPY TO PRODUCTION CODE ---- */}
      <TemplatePill templateName="Service Detail" templateHref="/service-detail-doc" />
      </>
    );
  }

  const tunnelBindings = routesToBindings(tunnel.routes);

  return (
    <>
    <PageHeader
      breadcrumbs={
        <Breadcrumbs>
          <Breadcrumbs.Link 
              icon={<SubwayIcon size={18} />} 
              href="/product-overview-example">
              Tunnels
          </Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>{displayName}</Breadcrumbs.Current>
        </Breadcrumbs>
      }
      tabs={
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v)}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "routes", label: "Routes" },
          ]}
        />
      }
    >
      {activeTab === "overview" && (
        <ServiceOverview
          leftContent={[
            <MetricsCard key="metrics" metrics={getTunnelMetrics(tunnel)} />,
            <ListTableCard<TunnelReplica>
              key="replicas"
              title="Replicas"
              badge={<Badge variant="outline"><BookOpenIcon size={14} className="text-kumo-strong" /></Badge>}
              columns={replicaColumns}
              data={tunnel.replicas}
              rowKey={(r) => r.replicaId}
              action={
                <Button variant="secondary" size="sm" icon={PlusIcon}>
                  Add a replica
                </Button>
              }
            />,
            <OverviewCard key="routes" title="Routes" onHeaderClick={() => setActiveTab("routes")}>
              <ArchitectureDiagram
                className="rounded-lg h-[350px]"
                workerName={tunnel.name}
                bindings={tunnelBindings}
                canUpdate
              />
            </OverviewCard>,
          ]}
          rightContent={[
            <DetailsCard
              key="details"
              title="Tunnel details"
              items={[
                {
                  title: "Name",
                  value: tunnel.name,
                  actionIcon: PencilSimpleIcon,
                  actionLabel: "Edit name",
                },
                {
                  title: "Tunnel ID",
                  value: tunnel.tunnelId,
                  actionIcon: CopyIcon,
                  actionLabel: "Copy tunnel ID",
                },
                {
                  title: "Type",
                  value: tunnel.tunnelType,
                },
              ] satisfies DetailItem[]}
            />,
            <OverviewCard key="token" title="Refresh token">
              <div className="p-4 grid gap-2">
                <Text variant="secondary">
                  Refresh the tunnel token to invalidate the current token and generate
                  a new one. This will require updating all replica instances with the
                  new token.
                </Text>
                <LinkButton variant="secondary" size="sm" href="#">
                  <ArrowsClockwiseIcon size={14} />
                  Rotate token
                </LinkButton>
              </div>
            </OverviewCard>,
            <NextStepsCard
              key="next-steps"
              steps={[
                {
                  id: "configure-alerts",
                  title: "Configure alerts",
                  description:
                    "Set up alerts to monitor your tunnel's health changes.",
                  href: "#",
                },
              ] satisfies NextStep[]}
            />,
          ]}
        />
      )}
      {activeTab === "routes" && (
        <ArchitectureTab
          title="Routes"
          description="Routes connect your tunnel to public hostnames, private networks, and other services."
          actions={
            <>
              <LinkButton
                variant="secondary"
                href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/"
                external
              >
                Documentation
              </LinkButton>
              <Button variant="primary">Add a route</Button>
            </>
          }
          diagramTitle="Connected routes"
          workerName={tunnel.name}
          bindings={tunnelBindings}
          canUpdate
        >
          <div className="flex flex-col gap-4">
            <LayerCard>
              <LayerCard.Primary className="p-0">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Type</Table.Head>
                      <Table.Head>Destination</Table.Head>
                      <Table.Head>Service</Table.Head>
                      <Table.Head>Description</Table.Head>
                      <Table.Head></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {tunnel.routes.map((route, i) => (
                      <Table.Row key={i}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <span className="text-kumo-text-secondary">
                              {routeTypeIconMap[route.routeType] ?? <GlobeSimpleIcon size={16} />}
                            </span>
                            {route.routeType}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {route.destinationHref ? (
                            <Link href={route.destinationHref}>
                              {route.destination}
                            </Link>
                          ) : (
                            route.destination
                          )}
                        </Table.Cell>
                        <Table.Cell>{route.service}</Table.Cell>
                        <Table.Cell>{route.description}</Table.Cell>
                        <Table.Cell style={{ width: 72 }}>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" shape="square" aria-label="Edit">
                              <PencilSimpleIcon size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" shape="square" aria-label="Delete">
                              <TrashIcon size={16} className="text-kumo-danger" />
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </LayerCard.Primary>
            </LayerCard>
            <Pagination
              page={1}
              setPage={() => {}}
              perPage={10}
              totalCount={tunnel.routes.length}
            />
          </div>
        </ArchitectureTab>
      )}
    </PageHeader>

    {/* ---- DOCUMENTATION ONLY — DO NOT COPY TO PRODUCTION CODE ---- */}
    <TemplatePill templateName="Service Detail" templateHref="/service-detail-doc" />
    </>
  );
}
