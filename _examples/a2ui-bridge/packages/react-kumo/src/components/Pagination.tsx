/**
 * @a2ui-bridge/react-kumo - Pagination adapter
 */

import { useState, type JSX } from "react";
import type { AnyComponentNode } from "@a2ui-bridge/core";
import type { A2UIComponentProps } from "@a2ui-bridge/react";
import { Button as KumoButton } from "@cloudflare/kumo";

export function Pagination({
  node,
  onAction,
}: A2UIComponentProps<AnyComponentNode>): JSX.Element {
  const properties = node.properties as any;
  const totalPages = properties.totalPages ?? properties.total ?? 5;
  const [currentPage, setCurrentPage] = useState(properties.currentPage ?? 1);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (properties.action?.name) {
      onAction({
        actionName: properties.action.name,
        sourceComponentId: node.id,
        timestamp: new Date().toISOString(),
        context: { page },
      });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <KumoButton
        variant="ghost"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => handlePageChange(currentPage - 1)}
      >
        Prev
      </KumoButton>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <KumoButton
          key={page}
          variant={page === currentPage ? "primary" : "ghost"}
          size="sm"
          onClick={() => handlePageChange(page)}
        >
          {page}
        </KumoButton>
      ))}
      <KumoButton
        variant="ghost"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
      >
        Next
      </KumoButton>
    </div>
  );
}
