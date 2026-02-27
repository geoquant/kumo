import type { ReactNode } from "react";
import { Text, Table } from "@cloudflare/kumo";
import { OverviewCard } from "./OverviewCard";

export interface ListTableColumn<T> {
  header: string;
  accessor: (row: T) => ReactNode;
}

export interface ListTableCardProps<T> {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  columns: ListTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
}

export function ListTableCard<T>({
  title,
  badge,
  action,
  columns,
  data,
  rowKey,
}: ListTableCardProps<T>) {
  return (
    <OverviewCard title={title} badge={badge} action={action}>
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              {columns.map((col) => (
                <Table.Head key={col.header}>{col.header}</Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.map((row, index) => (
              <Table.Row key={rowKey(row, index)}>
                {columns.map((col) => (
                  <Table.Cell key={col.header}>
                    {typeof col.accessor(row) === "string" ? (
                      <Text>{col.accessor(row)}</Text>
                    ) : (
                      col.accessor(row)
                    )}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </OverviewCard>
  );
}
