import React, { forwardRef, useEffect, type SVGAttributes } from "react";
import spriteMarkup from "../../icons/generated/sprite.svg?raw";
import {
  cloudflareIconViewBoxes,
  type CloudflareIconName,
} from "../../icons/generated/names";
import { cn } from "../../utils/cn";

const SPRITE_CONTAINER_ID = "kumo-cloudflare-icon-sprite";

function ensureSpriteMounted() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(SPRITE_CONTAINER_ID)) {
    return;
  }

  const container = document.createElement("div");
  container.id = SPRITE_CONTAINER_ID;
  container.setAttribute("aria-hidden", "true");
  container.style.position = "absolute";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  container.innerHTML = spriteMarkup;
  document.body.prepend(container);
}

export const KUMO_CLOUDFLARE_ICON_VARIANTS = {
  size: {
    xs: {
      classes: "size-3",
      description: "Extra-small icon size",
    },
    sm: {
      classes: "size-4",
      description: "Small icon size",
    },
    base: {
      classes: "size-5",
      description: "Default icon size",
    },
    lg: {
      classes: "size-6",
      description: "Large icon size",
    },
  },
} as const;

export const KUMO_CLOUDFLARE_ICON_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type CloudflareIconSize =
  keyof typeof KUMO_CLOUDFLARE_ICON_VARIANTS.size;

export interface CloudflareIconProps
  extends Omit<SVGAttributes<SVGSVGElement>, "children"> {
  /** Repo-owned Cloudflare glyph name from generated assets. */
  glyph: CloudflareIconName;
  /** Icon size variant. */
  size?: CloudflareIconSize;
  /** Accessible label for a non-decorative icon. */
  title?: string;
}

/**
 * Minimal Cloudflare icon component backed by the generated Kumo sprite.
 */
export const CloudflareIcon = forwardRef<SVGSVGElement, CloudflareIconProps>(
  (
    {
      glyph,
      size = KUMO_CLOUDFLARE_ICON_DEFAULT_VARIANTS.size,
      title,
      className,
      focusable,
      ...props
    },
    ref,
  ) => {
    const titleId = React.useId();
    const href = `#${glyph}`;
    const viewBox = cloudflareIconViewBoxes[glyph];
    const labelled = Boolean(title);

    useEffect(() => {
      ensureSpriteMounted();
    }, []);

    return (
      <svg
        ref={ref}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role={labelled ? "img" : undefined}
        aria-hidden={labelled ? undefined : true}
        aria-labelledby={labelled ? titleId : undefined}
        focusable={focusable ?? false}
        className={cn(
          "inline-block shrink-0 fill-current text-kumo-default",
          KUMO_CLOUDFLARE_ICON_VARIANTS.size[size].classes,
          className,
        )}
        {...props}
      >
        {labelled && <title id={titleId}>{title}</title>}
        <use href={href} />
      </svg>
    );
  },
);

CloudflareIcon.displayName = "CloudflareIcon";
