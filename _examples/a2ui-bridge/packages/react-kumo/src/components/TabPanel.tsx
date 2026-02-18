/**
 * @a2ui-bridge/react-kumo - TabPanel adapter
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";

export function TabPanel({
  children,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  return (
    <div role="tabpanel" className="mt-2">
      {children}
    </div>
  );
}
