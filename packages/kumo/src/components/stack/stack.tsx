import { forwardRef } from "react";
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "../../utils/cn";

/** Stack variant definitions mapping layout props to Tailwind classes. */
export const KUMO_STACK_VARIANTS = {
  gap: {
    none: {
      classes: "gap-0",
      description: "No gap between stack items",
    },
    xs: {
      classes: "gap-1",
      description: "Extra-small gap (4px) between stack items",
    },
    sm: {
      classes: "gap-2",
      description: "Small gap (8px) between stack items",
    },
    base: {
      classes: "gap-4",
      description: "Base gap (16px) between stack items",
    },
    lg: {
      classes: "gap-6",
      description: "Large gap (24px) between stack items",
    },
    xl: {
      classes: "gap-8",
      description: "Extra-large gap (32px) between stack items",
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
    stretch: {
      classes: "items-stretch",
      description: "Stretch items to fill the cross axis",
    },
  },
} as const;

export const KUMO_STACK_DEFAULT_VARIANTS = {
  gap: "base",
  align: "stretch",
} as const;

export type KumoStackGap = keyof typeof KUMO_STACK_VARIANTS.gap;
export type KumoStackAlign = keyof typeof KUMO_STACK_VARIANTS.align;

export function stackVariants({
  gap = KUMO_STACK_DEFAULT_VARIANTS.gap,
  align = KUMO_STACK_DEFAULT_VARIANTS.align,
}: {
  gap?: KumoStackGap;
  align?: KumoStackAlign;
} = {}) {
  return cn(
    "flex flex-col",
    KUMO_STACK_VARIANTS.gap[gap].classes,
    KUMO_STACK_VARIANTS.align[align].classes,
  );
}

/**
 * Stack component props.
 *
 * @example
 * ```tsx
 * <Stack gap="base" align="start">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 * <Stack render={<section />} gap="lg">
 *   <p>Renders as a section element</p>
 * </Stack>
 * ```
 */
export type StackProps = useRender.ComponentProps<"div"> & {
  /**
   * Gap size between stack items.
   * - `"none"` -- 0px
   * - `"xs"` -- 4px
   * - `"sm"` -- 8px
   * - `"base"` -- 16px
   * - `"lg"` -- 24px
   * - `"xl"` -- 32px
   * @default "base"
   */
  gap?: KumoStackGap;
  /**
   * Cross-axis alignment of stack items.
   * - `"start"` -- Align to start
   * - `"center"` -- Center
   * - `"end"` -- Align to end
   * - `"stretch"` -- Fill cross axis
   * @default "stretch"
   */
  align?: KumoStackAlign;
};

/**
 * Vertical flex layout primitive with constrained gap and alignment tokens.
 *
 * Uses `render` prop for element composition (renders `<div>` by default):
 * ```tsx
 * <Stack gap="base">
 *   <Surface className="p-4">First</Surface>
 *   <Surface className="p-4">Second</Surface>
 * </Stack>
 *
 * <Stack render={<nav />} gap="sm">
 *   <a href="/home">Home</a>
 *   <a href="/about">About</a>
 * </Stack>
 * ```
 */
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  {
    className,
    gap = KUMO_STACK_DEFAULT_VARIANTS.gap,
    align = KUMO_STACK_DEFAULT_VARIANTS.align,
    render,
    ...props
  },
  ref,
) {
  const defaultProps: useRender.ElementProps<"div"> = {
    className: stackVariants({ gap, align }),
  };

  return useRender({
    render: render ?? <div />,
    ref,
    props: mergeProps<"div">(defaultProps, props, { className }),
  });
});

Stack.displayName = "Stack";
