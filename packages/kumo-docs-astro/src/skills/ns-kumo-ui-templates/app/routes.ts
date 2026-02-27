import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("page-header-doc", "routes/page-header-doc.tsx"),
  route("product-overview-example", "routes/product-overview-example.tsx"),
  route("product-overview-doc", "routes/product-overview-doc.tsx"),
  route("service-tabs-example", "routes/service-tabs-example.tsx"),
  route("service-detail-example/:tunnelName", "routes/service-detail-example.tsx"),
  route("documentation-card-doc", "routes/documentation-card-doc.tsx"),
  route("architecture-diagram-doc", "routes/architecture-diagram-doc.tsx"),
  route("details-card-doc", "routes/details-card-doc.tsx"),
  route("list-table-card-doc", "routes/list-table-card-doc.tsx"),
  route("metrics-card-doc", "routes/metrics-card-doc.tsx"),
  route("next-steps-card-doc", "routes/next-steps-card-doc.tsx"),
  route("overview-card-doc", "routes/overview-card-doc.tsx"),
  route("service-detail-doc", "routes/service-detail-doc.tsx"),
  route("service-tabs-doc", "routes/service-tabs-doc.tsx"),
] satisfies RouteConfig;
