import { SquaresFourIcon, CodeIcon } from "@phosphor-icons/react";
import {
  Surface,
  Code,
  Text,
  CodeBlock,
  Table,
  LayerCard,
  LinkButton,
} from "@cloudflare/kumo";
import { ProductOverview } from "~/components/templates/ProductOverview";
import { PageHeader } from "~/components/blocks/PageHeader";

export const PAGE_DESCRIPTION =
  "A compound layout block that renders a title area with optional description, breadcrumbs, tabs, and action buttons.";

const BASIC_USAGE = `import { PageHeader } from "~/components/blocks/PageHeader";

export default function MyPage() {
  return (
    <PageHeader
      title="Page Title"
      description="A short description of the page."
    >
      <p>Your main content goes here.</p>
    </PageHeader>
  );
}`;

const FULL_USAGE = `import { Breadcrumbs, Button, Tabs } from "@cloudflare/kumo";
import { PageHeader } from "~/components/blocks/PageHeader";

export default function FullExamplePage() {
  return (
    <PageHeader
      breadcrumbs={
        <Breadcrumbs>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Link href="/products">Products</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>Detail</Breadcrumbs.Current>
        </Breadcrumbs>
      }
      title="Workers"
      description="Deploy serverless functions at the edge."
      tabs={
        <Tabs variant="underline" defaultValue="overview">
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      }
      actions={
        <div className="flex gap-2">
          <Button variant="outline">Documentation</Button>
          <Button variant="primary">Create Worker</Button>
        </div>
      }
    >
      {/* Main content area */}
    </PageHeader>
  );
}`;

const WITH_BREADCRUMBS = `<PageHeader
  breadcrumbs={
    <Breadcrumbs>
      <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
      <Breadcrumbs.Separator />
      <Breadcrumbs.Link href="/products">Products</Breadcrumbs.Link>
      <Breadcrumbs.Separator />
      <Breadcrumbs.Current>Detail</Breadcrumbs.Current>
    </Breadcrumbs>
  }
  title="Product Detail"
  description="View and manage this product."
>
  {/* content */}
</PageHeader>`;

const WITH_TABS_AND_ACTIONS = `<PageHeader
  title="Analytics"
  description="View traffic and performance data."
  tabs={
    <Tabs variant="underline" defaultValue="traffic">
      <Tabs.List>
        <Tabs.Trigger value="traffic">Traffic</Tabs.Trigger>
        <Tabs.Trigger value="performance">Performance</Tabs.Trigger>
        <Tabs.Trigger value="errors">Errors</Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  }
  actions={<Button variant="primary">Export</Button>}
>
  {/* content */}
</PageHeader>`;

const WITH_HEADER_SLOT = `<PageHeader
  header={
    <div className="flex items-center gap-4 p-4">
      <img src="/logo.svg" alt="Logo" className="h-8" />
      <span className="text-lg font-semibold">Custom Header</span>
    </div>
  }
  tabs={
    <Tabs variant="underline" defaultValue="overview">
      <Tabs.List>
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  }
>
  {/* content — title/description are skipped when header is used */}
</PageHeader>`;

const PORTAL_CONTEXT = `// breadcrumb-portal.tsx — shared context
const BreadcrumbPortalContext = createContext<{
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
}>({ target: null, setTarget: () => {} });`;

const PORTAL_PROVIDER = `// root.tsx — wrap the app
<BreadcrumbPortalProvider>
  <TooltipProvider>
    <AppHeader />
    <main><Outlet /></main>
  </TooltipProvider>
</BreadcrumbPortalProvider>`;

const PORTAL_TARGET = `// AppHeader.tsx — register the target
const registerTarget = useRegisterBreadcrumbPortalTarget();

<header>
  {/* portal target — breadcrumbs land here */}
  <div ref={registerTarget} className="flex items-center" />
  <ThemeToggle />
</header>`;

const PORTAL_USAGE = `// PageHeader.tsx — portal breadcrumbs out
import { BreadcrumbPortal } from "~/components/layout/breadcrumb-portal";

{resolvedBreadcrumbs && (
  <BreadcrumbPortal>{resolvedBreadcrumbs}</BreadcrumbPortal>
)}`;

const PROPS_DATA = [
  {
    name: "breadcrumbs",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Portaled into AppHeader via createPortal (alias: breadcrumb)",
  },
  {
    name: "breadcrumb",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Alias for breadcrumbs — either prop is accepted",
  },
  {
    name: "title",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Page heading rendered as an h1",
  },
  {
    name: "description",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Subtitle text below the heading",
  },
  {
    name: "header",
    type: "ReactNode",
    default: "—",
    required: "No",
    description:
      "Custom header slot — replaces title/description when provided",
  },
  {
    name: "tabs",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Tab bar rendered in the sticky sub-header",
  },
  {
    name: "actions",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Action buttons rendered on the right side of the tab bar",
  },
  {
    name: "tabsActionsClassName",
    type: "string",
    default: "—",
    required: "No",
    description: "Extra CSS classes on the sticky tabs/actions bar",
  },
  {
    name: "className",
    type: "string",
    default: "—",
    required: "No",
    description: "Extra CSS classes on the outer PageSurface wrapper",
  },
  {
    name: "children",
    type: "ReactNode",
    default: "—",
    required: "No",
    description: "Main content rendered below the header and tab bar",
  },
];

export default function PageHeaderDocPage() {
  return (
    <ProductOverview
      titleIcon={<SquaresFourIcon size={28} className="text-kumo-strong" />}
      title="Page Header"
      subtitle={PAGE_DESCRIPTION}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 mb-4">
          <LinkButton
            key="code"
            variant="secondary"
            href="https://gitlab.cfdata.org/yelena/ns-kumo-ui-templates/-/tree/main/app/components/blocks/PageHeader.tsx"
            target="_blank"
          >
            <CodeIcon size={16} />
            View Code
          </LinkButton>
        </div>

        {/* ---- Overview ---- */}
        <div className="flex flex-col max-w-prose gap-4">
          <Text variant="heading2">Overview</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The{" "}
              <Text variant="mono" size="lg">
                PageHeader
              </Text>{" "}
              block provides a consistent page-level header used across Network
              Services pages. It accepts breadcrumbs, a title, a description, a
              custom header slot, a tab bar, and action buttons.
            </span>
          </Text>

          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              Breadcrumbs passed to{" "}
              <Text variant="mono" size="lg">
                PageHeader
              </Text>{" "}
              are not rendered inline. Instead they are teleported via React's{" "}
              <Text variant="mono" size="lg">
                createPortal
              </Text>{" "}
              into the sticky{" "}
              <Text variant="mono" size="lg">
                AppHeader
              </Text>{" "}
              bar at the top of the viewport. This mirrors the portal-based
              breadcrumb relocation pattern used in the Cloudflare dashboard's
              CollapsedHeader.
            </span>
          </Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              All props are optional. The component hides sections that have no
              content — e.g. if no{" "}
              <Text variant="mono" size="lg">
                tabs
              </Text>{" "}
              are provided, the sticky sub-header is omitted entirely.
            </span>
          </Text>
        </div>

        {/* ---- Visual Layout ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Visual Layout</Text>
          <Text variant="secondary">
            The component renders the following structure. Sections marked with{" "}
            <Text variant="mono" size="lg">
              ?
            </Text>{" "}
            are only rendered when their corresponding prop is provided.
          </Text>
          <Surface className="p-6 rounded-lg">
            <Code
              lang="bash"
              code={`┌─ AppHeader (sticky) ─────────────────────────────────────────────┐
│ [portal target ← breadcrumbs land HERE when scrolled]              │
└───────────────────────────────────────────────────────────────────┘

┌─ PageHeader (PageSurface) ──────────────────────────────────────┐
│  [header? — OR — title? + description?]                           │
│ ┌─ sticky sub-header (tabs/actions) ────────────────────────────┐│
│ │  [tabs?]                                          [actions?]   ││
│ └────────────────────────────────────────────────────────────────┘│
│  [children — main content area]                                   │
└──────────────────────────────────────────────────────────────────┘`}
            />
          </Surface>
        </div>

        {/* ---- Basic Usage ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Basic Usage</Text>
          <Text variant="secondary">
            The simplest usage with just a title, description, and content:
          </Text>
          <CodeBlock lang="tsx" code={BASIC_USAGE} />
        </div>

        {/* ---- Full Example ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Full Example</Text>
          <Text variant="secondary">
            Using all available props — breadcrumbs, title, description, tabs,
            and actions:
          </Text>
          <CodeBlock lang="tsx" code={FULL_USAGE} />
        </div>

        {/* ---- Props Reference ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading3">Props Reference</Text>
          <Text variant="secondary">
            The full props interface for{" "}
            <Text variant="mono" size="lg">
              PageHeader
            </Text>
            :
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
                      <Table.Cell>
                        <Text variant="mono">{prop.name}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text variant="mono">{prop.type}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text variant="mono">{prop.default}</Text>
                      </Table.Cell>
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

          <Text variant="heading3">With Breadcrumbs</Text>
          <Text variant="secondary">
            Breadcrumbs are portaled into the sticky AppHeader. Pass either{" "}
            <Text variant="mono" size="lg">
              breadcrumbs
            </Text>{" "}
            or{" "}
            <Text variant="mono" size="lg">
              breadcrumb
            </Text>{" "}
            — both are accepted.
          </Text>
          <CodeBlock lang="tsx" code={WITH_BREADCRUMBS} />

          <Text variant="heading3">With Tabs and Actions</Text>
          <Text variant="secondary">
            Pass any{" "}
            <Text variant="mono" size="lg">
              ReactNode
            </Text>{" "}
            as{" "}
            <Text variant="mono" size="lg">
              tabs
            </Text>{" "}
            and{" "}
            <Text variant="mono" size="lg">
              actions
            </Text>
            . They render in a sticky sub-header that pins to the top of the
            viewport on scroll.
          </Text>
          <CodeBlock lang="tsx" code={WITH_TABS_AND_ACTIONS} />

          <Text variant="heading3">Custom Header Slot</Text>
          <Text variant="secondary">
            Use the{" "}
            <Text variant="mono" size="lg">
              header
            </Text>{" "}
            prop to replace the default title/description area with fully custom
            content. When{" "}
            <Text variant="mono" size="lg">
              header
            </Text>{" "}
            is provided and neither{" "}
            <Text variant="mono" size="lg">
              title
            </Text>{" "}
            nor{" "}
            <Text variant="mono" size="lg">
              description
            </Text>{" "}
            is set, the header slot renders instead.
          </Text>
          <CodeBlock lang="tsx" code={WITH_HEADER_SLOT} />
        </div>

        {/* ---- Breadcrumb Portal Strategy ---- */}
        <div className="flex flex-col max-w-prose gap-4 my-4">
          <Text variant="heading2">Breadcrumb Portal Strategy</Text>
          <Text variant="secondary" size="lg">
            <span className="leading-relaxed">
              The breadcrumb relocation uses a three-part pattern so that each
              page can declare its own breadcrumbs while they always render in
              the top-level sticky header.
            </span>
          </Text>

          <Text variant="heading3">1. Context &amp; Provider</Text>
          <Text variant="secondary">
            <span className="leading-relaxed">
              A{" "}
              <Text variant="mono" size="lg">
                BreadcrumbPortalContext
              </Text>{" "}
              holds a reference to the target DOM node. The provider wraps the
              entire app in{" "}
              <Text variant="mono" size="lg">
                root.tsx
              </Text>{" "}
              so both the header and any page component share the same state.
            </span>
          </Text>
          <CodeBlock lang="tsx" code={PORTAL_CONTEXT} />

          <Text variant="heading3">2. Provider in root.tsx</Text>
          <Text variant="secondary">
            <span className="leading-relaxed">
              The provider sits outside{" "}
              <Text variant="mono" size="lg">
                TooltipProvider
              </Text>{" "}
              so it is available to every descendant.
            </span>
          </Text>
          <CodeBlock lang="tsx" code={PORTAL_PROVIDER} />

          <Text variant="heading3">3. Register the target in AppHeader</Text>
          <Text variant="secondary">
            <span className="leading-relaxed">
              <Text variant="mono" size="lg">
                useRegisterBreadcrumbPortalTarget()
              </Text>{" "}
              returns a ref callback. The empty{" "}
              <Text variant="mono" size="lg">
                div
              </Text>{" "}
              in the header registers itself as the portal destination.
            </span>
          </Text>
          <CodeBlock lang="tsx" code={PORTAL_TARGET} />

          <Text variant="heading3">4. Portal from PageHeader</Text>
          <Text variant="secondary">
            <span className="leading-relaxed">
              When{" "}
              <Text variant="mono" size="lg">
                breadcrumbs
              </Text>{" "}
              are provided,{" "}
              <Text variant="mono" size="lg">
                BreadcrumbPortal
              </Text>{" "}
              calls{" "}
              <Text variant="mono" size="lg">
                createPortal(children, target)
              </Text>{" "}
              to render them inside the AppHeader's registered div. The
              PageHeader itself renders nothing for breadcrumbs — they exist
              only once in the DOM, inside the sticky top bar.
            </span>
          </Text>
          <CodeBlock lang="tsx" code={PORTAL_USAGE} />
        </div>
      </div>
    </ProductOverview>
  );
}
