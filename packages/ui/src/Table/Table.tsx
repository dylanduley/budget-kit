import { useId, type ReactElement, type ReactNode } from 'react';
import styles from './Table.module.css';

export interface TableColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  rowHeader?: boolean;
}

export interface TableProps<Row> {
  caption: string;
  captionHidden?: boolean;
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  emptyState?: ReactNode;
  className?: string;
}

export function Table<Row>({
  caption,
  captionHidden = false,
  columns,
  rows,
  getRowKey,
  emptyState = 'Nothing to show yet.',
  className,
}: TableProps<Row>): ReactElement {
  const captionId = useId();
  const rootClass = className ? `${styles.root} ${className}` : styles.root;

  return (
    // Focusable so keyboard users can scroll a table that overflows on narrow screens.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div role="region" aria-labelledby={captionId} tabIndex={0} className={rootClass}>
      <table className={styles.table}>
        <caption
          id={captionId}
          className={styles.caption}
          data-hidden={captionHidden ? 'true' : undefined}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={styles.header}
                data-numeric={column.numeric ? 'true' : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} data-part="empty" className={styles.empty}>
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th
                      key={column.key}
                      scope="row"
                      className={styles.rowHeader}
                      data-numeric={column.numeric ? 'true' : undefined}
                    >
                      {column.cell(row)}
                    </th>
                  ) : (
                    <td
                      key={column.key}
                      className={styles.cell}
                      data-numeric={column.numeric ? 'true' : undefined}
                    >
                      {column.cell(row)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
