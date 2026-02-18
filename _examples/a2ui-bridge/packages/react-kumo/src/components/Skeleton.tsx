/**
 * @a2ui-bridge/react-kumo - Skeleton adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function Skeleton(
  _props: A2UIComponentProps<AnyComponentNode>,
): JSX.Element {
  return (
    <div className="animate-pulse rounded-md bg-kumo-recessed h-5 w-full" />
  );
}
