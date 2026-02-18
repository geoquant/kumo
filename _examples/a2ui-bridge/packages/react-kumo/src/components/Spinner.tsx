/**
 * @a2ui-bridge/react-kumo - Spinner/Loader adapter
 * Maps A2UI Spinner nodes to @cloudflare/kumo Loader
 */

import type { JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Loader } from "@cloudflare/kumo";

export function Spinner(
  _props: A2UIComponentProps<AnyComponentNode>,
): JSX.Element {
  return <Loader />;
}
