/**
 * ---------------------------------------------------------------
 * DOCUMENTATION ONLY — DO NOT COPY TO PRODUCTION CODE
 * This floating pill is used solely in example pages to link back
 * to the corresponding template documentation route.
 * ---------------------------------------------------------------
 */
import { useState, useEffect } from "react";
import { Link } from "@cloudflare/kumo";
import { X } from "@phosphor-icons/react";

interface TemplatePillProps {
  /** Human-readable template name, e.g. "Product Overview" */
  templateName: string;
  /** Route path to the -doc.tsx page, e.g. "/product-overview-doc" */
  templateHref: string;
}

export function TemplatePill({ templateName, templateHref }: TemplatePillProps) {
  const [dismissed, setDismissed] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger the bounce animation on mount
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (dismissed) return null;

  return (
    /* ---- DOCUMENTATION ONLY — not for production ---- */
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`flex items-center rounded-full ring ring-neutral-950/10 dark:ring-neutral-800 bg-kumo-base dark:bg-neutral-900 shadow px-3.5 gap-2 ${
          animate ? "animate-bounce-once" : "opacity-0"
        }`}
        style={{ height: "42px" }}
      >
        <p className="font-medium text-sm whitespace-nowrap">
          This page uses the{" "}
          <span className="font-semibold">{templateName}</span> template.{" "}
          <Link href={templateHref}>View template</Link>
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-kumo-text-secondary hover:text-kumo-text-default cursor-pointer shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
