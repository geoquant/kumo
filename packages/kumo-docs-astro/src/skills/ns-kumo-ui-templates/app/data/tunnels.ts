import React from "react";
import {
  GlobeSimpleIcon,
  NetworkIcon,
  LockIcon,
  CloudArrowUpIcon,
} from "@phosphor-icons/react";
import type { BindingItem } from "~/components/blocks/ArchitectureDiagram";
import tunnelsData from "./tunnels.json";

export interface TunnelReplica {
  replicaId: string;
  originIp: string;
  edgeLocations: string[];
  version: string;
  architecture: string;
  uptime: string;
}

export interface TunnelRoute {
  routeType: string;
  destination: string;
  destinationHref?: string;
  service: string;
  description: string;
}

export interface Tunnel {
  name: string;
  tunnelId: string;
  tunnelType: string;
  status: string;
  replicas: TunnelReplica[];
  routes: TunnelRoute[];
}

export const tunnels: Tunnel[] = tunnelsData.tunnels as Tunnel[];

export function getTunnelByName(name: string): Tunnel | undefined {
  return tunnels.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
}

const routeTypeIconMap: Record<string, { icon: React.ReactElement; isExternal?: boolean }> = {
  "Published application": { icon: React.createElement(GlobeSimpleIcon, { weight: "bold", size: 14 }), isExternal: true },
  "Private CIDR": { icon: React.createElement(NetworkIcon, { weight: "bold", size: 14 }) },
  "Private hostname": { icon: React.createElement(LockIcon, { weight: "bold", size: 14 }), isExternal: true },
  "VPC": { icon: React.createElement(CloudArrowUpIcon, { weight: "bold", size: 14 }) },
};

export function routesToBindings(routes: TunnelRoute[]): BindingItem[] {
  return routes.map((route) => {
    const mapping = routeTypeIconMap[route.routeType] ?? {
      icon: React.createElement(GlobeSimpleIcon, { weight: "bold", size: 14 }),
    };
    return {
      name: route.destination,
      type: route.routeType,
      icon: mapping.icon,
      isExternal: mapping.isExternal,
    };
  });
}
