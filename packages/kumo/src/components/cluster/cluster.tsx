import { forwardRef } from "react";
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "../../utils/cn";

/** Cluster variant definitions mapping layout props to Tailwind classes. */
export const KUMO_CLUSTER_VARIANTS = {
  gap: {
    none: {
      classes: "gap-0",
      description: "No gap between cluster items",
    },
    xs: {
      classes: "gap-1",
      description: "Extra-small gap (4px) between cluster items",
    },
    sm: {
      classes: "gap-2",
      description: "Small gap (8px) between cluster items",
    },
    base: {
      classes: "gap-4",
      description: "Base gap (16px) between cluster items",
    },
    lg: {
      classes: "gap-6",
      description: "Large gap (24px) between cluster items",
    },
    xl: {
      classes: "gap-8",
      description: "Extra-large gap (32px) between cluster items",
    },
  },
  justify: {
    start: {
      classes: "justify-start",
      description: "Pack items to the start of the main axis",
    },
    center: {
      classes: "justify-center",
      description: "Center items on the main axis",
    },
    end: {
      classes: "justify-end",
      description: "Pack items to the end of the main axis",
    },
    between: {
      classes: "justify-between",
      description: "Distribute items evenly with first/last at edges",
    },
  },
  align: {
    start: {
      classes: "items-start",
      description: "Align items to the start of the cross axis",
    },
    center: {
      classes: "items-center",
      description: "Center items on the cross axis",
    },
    end: {
      classes: "items-end",
      description: "Align items to the end of the cross axis",
    },
    baseline: {
      classes: "items-baseline",
      description: "Align items along their baselines",
    },
    stretch: {
      classes: "items-stretch",
      description: "Stretch items to fill the cross axis",
    },
  },
  wrap: {
    wrap: {
      classes: "flex-wrap",
      description: "Allow items to wrap to new lines",
    },
    nowrap: {
      classes: "flex-nowrap",
      description: "Force items onto a single line",
    },
  },
} as const;

export const KUMO_CLUSTER_DEFAULT_VARIANTS = {
  gap: "base",
  justify: "start",
  align: "center",
  wrap: "wrap",
} as const;

export type KumoClusterGap = keyof typeof KUMO_CLUSTER_VARIANTS.gap;
export type KumoClusterJustify = keyof typeof KUMO_CLUSTER_VARIANTS.justify;
export type KumoClusterAlign = keyof typeof KUMO_CLUSTER_VARIANTS.align;
export type KumoClusterWrap = keyof typeof KUMO_CLUSTER_VARIANTS.wrap;

export function clusterVariants({
  gap = KUMO_CLUSTER_DEFAULT_VARIANTS.gap,
  justify = KUMO_CLUSTER_DEFAULT_VARIANTS.justify,
  align = KUMO_CLUSTER_DEFAULT_VARIANTS.align,
  wrap = KUMO_CLUSTER_DEFAULT_VARIANTS.wrap,
}: {
  gap?: KumoClusterGap;
  justify?: KumoClusterJustify;
  align?: KumoClusterAlign;
  wrap?: KumoClusterWrap;
} = {}) {
  return cn(
    "flex",
    KUMO_CLUSTER_VARIANTS.gap[gap].classes,
    KUMO_CLUSTER_VARIANTS.justify[justify].classes,
    KUMO_CLUSTER_VARIANTS.align[align].classes,
    KUMO_CLUSTER_VARIANTS.wrap[wrap].classes,
  );
}

/**
 * Cluster component props.
 *
 * @example
 * ```tsx
 * <Cluster gap="base" justify="between">
 *   <button>Cancel</button>
 *   <button>Submit</button>
 * </Cluster>
 * <Cluster render={<nav />} gap="sm" wrap="nowrap">
 *   <a href="/home">Home</a>
 *   <a href="/about">About</a>
 * </Cluster>
 * ```
 */
export type ClusterProps = useRender.ComponentProps<"div"> & {
  /**
   * Gap size between cluster items.
   * - `"none"` -- 0px
   * - `"xs"` -- 4px
   * - `"sm"` -- 8px
   * - `"base"` -- 16px
   * - `"lg"` -- 24px
   * - `"xl"` -- 32px
   * @default "base"
   */
  gap?: KumoClusterGap;
  /**
   * Main-axis distribution of cluster items.
   * - `"start"` -- Pack to start
   * - `"center"` -- Center
   * - `"end"` -- Pack to end
   * - `"between"` -- Space evenly
   * @default "start"
   */
  justify?: KumoClusterJustify;
  /**
   * Cross-axis alignment of cluster items.
   * - `"start"` -- Align to start
   * - `"center"` -- Center
   * - `"end"` -- Align to end
   * - `"baseline"` -- Align baselines
   * - `"stretch"` -- Fill cross axis
   * @default "center"
   */
  align?: KumoClusterAlign;
  /**
   * Whether items wrap to new lines or stay on one line.
   * - `"wrap"` -- Allow wrapping
   * - `"nowrap"` -- Force single line
   * @default "wrap"
   */
  wrap?: KumoClusterWrap;
};

/**
 * Horizontal flex layout primitive with constrained gap, justify, align, and wrap tokens.
 *
 * Uses `render` prop for element composition (renders `<div>` by default):
 * ```tsx
 * <Cluster gap="base" justify="between">
 *   <Button>Cancel</Button>
 *   <Button>Submit</Button>
 * </Cluster>
 *
 * <Cluster render={<nav />} gap="sm" wrap="nowrap">
 *   <a href="/home">Home</a>
 *   <a href="/about">About</a>
 * </Cluster>
 * ```
 */
export const Cluster = forwardRef<HTMLDivElement, ClusterProps>(
  function Cluster(
    {
      className,
      gap = KUMO_CLUSTER_DEFAULT_VARIANTS.gap,
      justify = KUMO_CLUSTER_DEFAULT_VARIANTS.justify,
      align = KUMO_CLUSTER_DEFAULT_VARIANTS.align,
      wrap = KUMO_CLUSTER_DEFAULT_VARIANTS.wrap,
      render,
      ...props
    },
    ref,
  ) {
    const defaultProps: useRender.ElementProps<"div"> = {
      className: clusterVariants({ gap, justify, align, wrap }),
    };

    return useRender({
      render: render ?? <div />,
      ref,
      props: mergeProps<"div">(defaultProps, props, { className }),
    });
  },
);

Cluster.displayName = "Cluster";
