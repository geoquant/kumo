import { useState } from "react";
import {
  Badge,
  Button,
  Combobox,
  Input,
  InputGroup,
  Label,
  LayerCard,
  Link,
  Pagination,
  Surface,
  Table,
  Tabs,
  Text,
  Tooltip,
  Breadcrumbs,
  LinkButton,
} from "@cloudflare/kumo";
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  ArrowsClockwiseIcon,
  DotsThreeIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "~/components/blocks/PageHeader";
import { TemplatePill } from "~/components/blocks/TemplatePill";
import { ServiceDetail } from "~/components/templates/ServiceDetail";
import { ServiceSettings } from "~/components/templates/ServiceSettings";
import ipPrefixData from "~/data/ip-prefixes.json";
import wanRouteData from "~/data/wan-routes.json";

export const PAGE_DESCRIPTION =
  "Routes section page for Service Tabs template example. Displays three tabs (IP prefixes, Routes, WAN configuration) using the Service Details and Service Settings layouts.";

// --- Types ---

interface RouteResource {
  id: number;
  name: string;
  status: "Healthy";
  attribute1: string;
  attribute2: string;
  attribute3: string;
}

const ipPrefixes: RouteResource[] = ipPrefixData as RouteResource[];
const wanRoutes: RouteResource[] = wanRouteData as RouteResource[];

const statuses = ["All statuses", "Healthy", "Degraded", "Down"];

// --- Main page ---

export default function RoutesExamplePage() {
  const [activeTab, setActiveTab] = useState("ip-prefixes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("All statuses");
  const [asn, setAsn] = useState("13335");
  const [prefixes, setPrefixes] = useState([
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "100.64.0.0/10",
  ]);

  const resources = activeTab === "ip-prefixes" ? ipPrefixes : wanRoutes;
  const filtered = resources.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All statuses" || r.status === status;
    return matchesSearch && matchesStatus;
  });

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setSearch("");
    setPage(1);
    setStatus("All statuses");
  }

  const resourceTable = (
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
        <Button variant="outline">Edit columns</Button>
        <Button variant="outline" shape="square" icon={ArrowsClockwiseIcon} aria-label="Refresh" />
      </div>

      {/* Table */}
      <LayerCard>
        <LayerCard.Primary className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Attribute</Table.Head>
                <Table.Head>Attribute</Table.Head>
                <Table.Head>Attribute</Table.Head>
                <Table.Head></Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((resource) => (
                <Table.Row key={resource.id}>
                  <Table.Cell>
                    <Link href="#">{resource.name}</Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="secondary">{resource.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>{resource.attribute1}</Table.Cell>
                  <Table.Cell>
                    <Badge variant="outline">{resource.attribute2}</Badge>
                  </Table.Cell>
                  <Table.Cell>{resource.attribute3}</Table.Cell>
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
        totalCount={filtered.length}
      />
    </div>
  );

  const emptyState = (
    <div className="rounded-lg bg-kumo-base border border-kumo-line h-[300px] flex items-center justify-center">
      <p className="text-neutral-600 dark:text-neutral-400">
        No routes found
      </p>
    </div>
  );

  return (
    <>
    <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Current>Routes</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        tabs={
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            tabs={[
              { value: "ip-prefixes", label: "IP prefixes" },
              { value: "wan-routes", label: "Routes" },
              { value: "wan-configuration", label: "WAN configuration" },
            ]}
          />
        }
      >
        {activeTab === "ip-prefixes" && (
          <ServiceDetail
            title="IP prefixes"
            description="The Magic Transit prefix count is measured based on the number of prefixes a customer announces through Cloudflare. Prefixes must support at least 256 hosts or /24 in CIDR notation."
            docsHref="https://developers.cloudflare.com/"
            actions={<Button variant="primary">Advertise new prefix</Button>}
            emptyState={emptyState}
          >
            {ipPrefixes.length ? resourceTable : null}
          </ServiceDetail>
        )}

        {activeTab === "wan-routes" && (
          <ServiceDetail
            title="WAN routes"
            description="Review the routing table used to steer traffic from Cloudflare to your WAN network. You can add new static routes or they can be dynamically learned through BGP peering. When static routes have equal priority value, Cloudflare uses equal-cost multi-path (ECMP) packet forwarding to route traffic. Note: WAN routes cannot overlap with Cloudflare Tunnel (CIDR) routes."
            docsHref="https://developers.cloudflare.com/"
            actions={<Button variant="primary">Create static route</Button>}
            emptyState={emptyState}
          >
            {wanRoutes.length ? resourceTable : null}
          </ServiceDetail>
        )}

        {activeTab === "wan-configuration" && (
          <ServiceSettings
            title="WAN configuration"
            description="Set configurations that determine how Cloudflare connects with your resources and infrastructure."
          >
            <div className="flex flex-col gap-6">
              {/* Card 1: Account-level virtual network overlay */}
              <div id="virtual-network-overlay">
              <Surface className="rounded-lg p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Text variant="heading3">Account-level virtual network overlay</Text>
                      <Badge variant="outline"><BookOpenIcon size={14} className="text-kumo-strong" /></Badge>
                    </div>
                    <Text variant="secondary">
                      Set a default ASN for your account-level virtual network overlay. This ASN will be used as the Cloudflare BGP speaker ASN for all BGP peering sessions over CNI, IPsec, or GRE
                    </Text>
                    <div className="flex flex-col gap-1 w-[400px]">
                      <div className="flex items-center gap-1">
                        <Label>CF Account ASN</Label>
                        <Text variant="secondary" size="sm">(required)</Text>
                        <Tooltip content="The ASN used for BGP peering">
                          <InfoIcon size={14} className="text-kumo-text-secondary cursor-help" />
                        </Tooltip>
                      </div>
                      <Input
                        value={asn}
                        onChange={(e) => setAsn(e.target.value)}
                      />
                    </div>
                    <div>
                      <Button variant="primary">Update</Button>
                    </div>
                  </div>
              </Surface>
              </div>

              {/* Card 2: Propagated routes to cloud networks */}
              <div id="cloud-network-routes">
              <Surface className="rounded-lg p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Text variant="heading3">Propagated routes to cloud networks</Text>
                      <Badge variant="outline"><BookOpenIcon size={14} className="text-kumo-strong" /></Badge>
                    </div>
                    <Text variant="secondary">
                      Manage the CIDR prefixes Cloudflare will install to your cloud network route table to direct traffic. Cloudflare will only install these prefixes for cloud on-ramps with route propagation turned on.
                    </Text>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Label>CIDR prefixes</Label>
                        <Text variant="secondary" size="sm">(required)</Text>
                      </div>
                      <div className="flex flex-col gap-2">
                        {prefixes.map((prefix, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              className="w-[400px]"
                              value={prefix}
                              onChange={(e) => setPrefixes((prev) => prev.map((p, i) => (i === index ? e.target.value : p)))}
                            />
                            <Button
                              variant="ghost"
                              shape="square"
                              aria-label="Remove prefix"
                              onClick={() => setPrefixes((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <TrashIcon size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <LinkButton
                        variant="secondary"
                        size="sm"
                        href="#"
                        onClick={(e) => { e.preventDefault(); setPrefixes((prev) => [...prev, ""]); }}>
                        <PlusIcon size={14} />
                        Add another prefix
                      </LinkButton>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary">Save changes</Button>
                      <Button variant="secondary">Restore default values</Button>
                    </div>
                  </div>
              </Surface>
              </div>
            </div>
          </ServiceSettings>
        )}
      </PageHeader>

    {/* ---- DOCUMENTATION ONLY — DO NOT COPY TO PRODUCTION CODE ---- */}
    <TemplatePill templateName="Service Tabs" templateHref="/service-tabs-doc" />
    </>
  );
}
