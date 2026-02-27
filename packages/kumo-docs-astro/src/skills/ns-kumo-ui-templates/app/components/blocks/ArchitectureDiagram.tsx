import { useId, useRef, useEffect, useState, type ReactNode } from "react";
import { cn } from "@cloudflare/kumo";
import {
  PlusIcon,
  ArrowSquareOutIcon,
  SubwayIcon,
} from "@phosphor-icons/react";

// --- Binding type (generic — populated by the caller) ---

export interface BindingItem {
  name: string;
  type: string;
  icon: ReactNode;
  /** Whether the name is an external link (shows arrow-out icon) */
  isExternal?: boolean;
}

// --- Constants ---

const ROW_HEIGHT = 32;
const ROW_GAP = 10;
const CONNECTOR_WIDTH = 168;
const DESTINATION_PILL_HEIGHT = 42;

// --- Sub-components ---

function BackgroundDots({ size = 12 }: { size?: number }) {
  const id = useId();
  return (
    <svg width="100%" height="100%">
      <defs>
        <pattern
          id={id}
          viewBox={`-${size / 2} -${size / 2} ${size} ${size}`}
          patternUnits="userSpaceOnUse"
          width={size}
          height={size}
        >
          <circle cx="0" cy="0" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function NamePill({
  name,
  isExternal,
}: {
  name: string;
  isExternal?: boolean;
}) {
  return (
    <div className="flex items-center px-3 gap-1.5 h-full">
      <p className="font-mono text-sm whitespace-nowrap">{name}</p>
      {isExternal && (
        <ArrowSquareOutIcon
          size={14}
          className="text-neutral-500 shrink-0"
        />
      )}
    </div>
  );
}

function TypeBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="-ml-px -mr-px flex items-center rounded-full bg-blue-50 dark:bg-blue-900 dark:text-blue-200 ring ring-blue-300 dark:ring-blue-500 text-blue-700 px-2.5 gap-1 h-[32px]">
      {icon}
      <p className="text-xs font-medium whitespace-nowrap">{label}</p>
    </div>
  );
}

function AddRouteBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="flex items-center rounded-full bg-blue-50 dark:bg-blue-900 dark:text-blue-200 ring ring-blue-300 dark:ring-blue-500 text-blue-700 px-2.5 gap-1 h-[32px] cursor-pointer"
      onClick={onClick}
      type="button"
    >
      <PlusIcon size={14} weight="bold" />
      <p className="text-xs font-medium whitespace-nowrap">Route</p>
    </button>
  );
}

function DestinationNode({
  label,
  icon,
}: {
  label: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="flex items-center rounded-full ring ring-neutral-950/10 dark:ring-neutral-800 bg-kumo-base dark:bg-neutral-900 shadow px-3.5 gap-2"
      style={{ height: `${DESTINATION_PILL_HEIGHT}px` }}
    >
      {icon}
      <p className="font-medium text-sm whitespace-nowrap">{label}</p>
    </div>
  );
}

// --- Connector lines SVG ---

function ConnectorLines({
  rowCount,
  svgHeight,
  destinationY,
}: {
  rowCount: number;
  svgHeight: number;
  destinationY: number;
}) {
  return (
    <svg
      width={CONNECTOR_WIDTH}
      height={svgHeight}
      fill="none"
      className="stroke-neutral-300 dark:stroke-neutral-700 shrink-0"
      strokeWidth="1.5"
    >
      {Array.from({ length: rowCount }).map((_, i) => {
        const sourceY = i * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
        return (
          <path
            key={i}
            d={`M 0 ${sourceY} C ${CONNECTOR_WIDTH * 0.5} ${sourceY} ${CONNECTOR_WIDTH * 0.5} ${destinationY} ${CONNECTOR_WIDTH} ${destinationY}`}
          />
        );
      })}
    </svg>
  );
}

// --- Main exported component ---

export function ArchitectureDiagram({
  className,
  bindings,
  canUpdate = true,
  workerName = "Service",
}: {
  className?: string;
  bindings: BindingItem[];
  canUpdate?: boolean;
  workerName?: string;
}) {
  const totalRows = bindings.length + (canUpdate ? 1 : 0);
  const leftColumnHeight =
    totalRows * ROW_HEIGHT + (totalRows - 1) * ROW_GAP;

  const destinationRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [destinationY, setDestinationY] = useState(0);

  useEffect(() => {
    const updateDestinationY = () => {
      if (destinationRef.current && leftColumnRef.current) {
        const leftTop = leftColumnRef.current.getBoundingClientRect().top;
        const destRect = destinationRef.current.getBoundingClientRect();
        setDestinationY(destRect.top - leftTop + destRect.height / 2);
      }
    };

    const rafId = requestAnimationFrame(updateDestinationY);
    window.addEventListener("resize", updateDestinationY);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateDestinationY);
    };
  }, [bindings.length, canUpdate]);

  const handleAddRoute = () => {
    // Placeholder — no modal in template mode
    console.log("Add route clicked");
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Background dots */}
      <div className="absolute inset-0 text-neutral-200 dark:text-neutral-800 pointer-events-none">
        <BackgroundDots />
      </div>

      {/* Content */}
      <div className="relative flex items-center justify-center h-full px-6 py-8 sm:px-10">
        <div className="flex items-start">
          {/* Left column: rows of name pill + type badge */}
          <div
            ref={leftColumnRef}
            className="flex flex-col items-end"
            style={{ gap: `${ROW_GAP}px` }}
          >
            {bindings.map((binding) => (
              <div
                key={binding.name}
                className="flex items-center justify-end rounded-full ring ring-neutral-950/10 dark:ring-neutral-800 bg-kumo-base dark:bg-neutral-900 shadow"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                <NamePill name={binding.name} isExternal={binding.isExternal} />
                <TypeBadge icon={binding.icon} label={binding.type} />
              </div>
            ))}
            {canUpdate && (
              <div
                className="flex items-center justify-end"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                <AddRouteBadge onClick={handleAddRoute} />
              </div>
            )}
          </div>

          {/* Connector lines */}
          {totalRows > 0 && (
            <ConnectorLines
              rowCount={totalRows}
              svgHeight={leftColumnHeight}
              destinationY={destinationY || ROW_HEIGHT / 2}
            />
          )}

          {/* Right column: destination node */}
          <div
            ref={destinationRef}
            className="flex items-center"
            style={{
              marginTop: `${(ROW_HEIGHT - DESTINATION_PILL_HEIGHT) / 2}px`,
            }}
          >
            <DestinationNode
              label={workerName}
              icon={<SubwayIcon size={18} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
