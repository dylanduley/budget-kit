'use client';

import type { ReactElement } from 'react';

import { useRouter } from 'next/navigation';

import { Button, Card, Table, type TableColumn } from '@budget-kit/ui';

import { formatMonth } from '@/lib/budget';
import { formatMoney } from '@/lib/format';
import { type MonthSummary, monthSummaries } from '@/lib/months';
import { useBudget } from '@/state/BudgetProvider';

export function MonthsTable(): ReactElement | null {
  const budget = useBudget();
  const router = useRouter();

  if (budget.status === 'loading') return null;

  const { book, currentMonth, viewMonth } = budget;

  const columns: TableColumn<MonthSummary>[] = [
    {
      key: 'month',
      header: 'Month',
      rowHeader: true,
      cell: (row) => `${formatMonth(row.month)}${row.month === currentMonth ? ' (this month)' : ''}`,
    },
    {
      key: 'income',
      header: 'Income',
      numeric: true,
      cell: (row) => (row.hasIncome ? formatMoney(row.incomeCents) : 'Not set'),
    },
    { key: 'spent', header: 'Spent', numeric: true, cell: (row) => formatMoney(row.spentCents) },
    {
      key: 'left',
      header: 'Left',
      numeric: true,
      cell: (row) => (row.hasIncome ? formatMoney(row.leftToSpendCents) : 'Not set'),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <Button
          variant="secondary"
          size="sm"
          aria-label={`View ${formatMonth(row.month)}`}
          onClick={() => {
            viewMonth(row.month);
            router.push('/');
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="Your months"
      description="Every month you have used, newest first. Choose View to see a month's details."
    >
      <Table
        caption="Months"
        captionHidden
        columns={columns}
        rows={monthSummaries(book, currentMonth)}
        getRowKey={(row) => row.month}
      />
    </Card>
  );
}
