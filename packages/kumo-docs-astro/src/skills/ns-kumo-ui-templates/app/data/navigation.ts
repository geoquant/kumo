import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  TableIcon,
  LayoutIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { PAGE_DESCRIPTION as PAGE_HEADER_DESCRIPTION } from "~/routes/page-header-doc";
import { PAGE_DESCRIPTION as PRODUCT_OVERVIEW_DESCRIPTION } from "~/routes/product-overview-example";
import { PAGE_DESCRIPTION as PRODUCT_OVERVIEW_DOC_DESCRIPTION } from "~/routes/product-overview-doc";
import { PAGE_DESCRIPTION as ROUTES_EXAMPLE_DESCRIPTION } from "~/routes/service-tabs-example";
import { PAGE_DESCRIPTION as DOCUMENTATION_CARD_DESCRIPTION } from "~/routes/documentation-card-doc";
import { PAGE_DESCRIPTION as ARCHITECTURE_DIAGRAM_DESCRIPTION } from "~/routes/architecture-diagram-doc";
import { PAGE_DESCRIPTION as DETAILS_CARD_DESCRIPTION } from "~/routes/details-card-doc";
import { PAGE_DESCRIPTION as LIST_TABLE_CARD_DESCRIPTION } from "~/routes/list-table-card-doc";
import { PAGE_DESCRIPTION as METRICS_CARD_DESCRIPTION } from "~/routes/metrics-card-doc";
import { PAGE_DESCRIPTION as NEXT_STEPS_CARD_DESCRIPTION } from "~/routes/next-steps-card-doc";
import { PAGE_DESCRIPTION as OVERVIEW_CARD_DESCRIPTION } from "~/routes/overview-card-doc";
import { PAGE_DESCRIPTION as SERVICE_DETAIL_DOC_DESCRIPTION } from "~/routes/service-detail-doc";
import { PAGE_DESCRIPTION as SERVICE_TABS_DOC_DESCRIPTION } from "~/routes/service-tabs-doc";

export interface NavLink {
  to: string;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
}

export interface NavSection {
  label: string;
  links: NavLink[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Examples",
    links: [
      {
        to: "/product-overview-example",
        label: "Tunnels",
        description: PRODUCT_OVERVIEW_DESCRIPTION,
        icon: TableIcon,
      },
      {
        to: "/service-tabs-example",
        label: "Routes",
        description: ROUTES_EXAMPLE_DESCRIPTION,
        icon: TableIcon,
      },
    ],
  },
  {
    label: "Templates",
    links: [
      {
        to: "/product-overview-doc",
        label: "Product Overview",
        description: PRODUCT_OVERVIEW_DOC_DESCRIPTION,
        icon: LayoutIcon,
      },
      {
        to: "/service-detail-doc",
        label: "Service Details",
        description: SERVICE_DETAIL_DOC_DESCRIPTION,
        icon: LayoutIcon,
      },
      {
        to: "/service-tabs-doc",
        label: "Service Tabs",
        description: SERVICE_TABS_DOC_DESCRIPTION,
        icon: LayoutIcon,
      },
    ],
  },
  {
    label: "Blocks",
    links: [
      {
        to: "/page-header-doc",
        label: "Page Header",
        description: PAGE_HEADER_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/documentation-card-doc",
        label: "Documentation Card",
        description: DOCUMENTATION_CARD_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/architecture-diagram-doc",
        label: "Architecture Diagram",
        description: ARCHITECTURE_DIAGRAM_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/details-card-doc",
        label: "Details Card",
        description: DETAILS_CARD_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/list-table-card-doc",
        label: "List Table Card",
        description: LIST_TABLE_CARD_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/metrics-card-doc",
        label: "Metrics Card",
        description: METRICS_CARD_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/next-steps-card-doc",
        label: "Next Steps Card",
        description: NEXT_STEPS_CARD_DESCRIPTION,
        icon: SquaresFourIcon,
      },
      {
        to: "/overview-card-doc",
        label: "Overview Card",
        description: OVERVIEW_CARD_DESCRIPTION,
        icon: SquaresFourIcon,
      },
    ],
  },
];
