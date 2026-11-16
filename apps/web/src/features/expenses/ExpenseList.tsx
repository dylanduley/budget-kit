'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Button, Card, StatusMessage, Table, type TableColumn } from '@budget-kit/ui';

import { categoryLabel, expensesForMonth, formatMonth, getTotals, type Expense } from '@/lib/budget';
import { formatDate, formatMoney } from '@/lib/format';
import { TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';

const GENERIC_ERROR = 'Something went wrong. Your budget was not changed.';

// An expense id to focus, or 'empty' for the empty-state paragraph.
type FocusTarget = string | 'empty';

export function ExpenseList(): ReactElement | null {
  const budget = useBudget();
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const pendingMessage = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ message: '', key: 0 });
  const expenses = budget.status === 'ready' ? budget.state.expenses : null;
  const readyState = budget.status === 'ready' ? budget.state : null;

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === 'empty') emptyRef.current?.focus();
    else buttonRefs.current.get(target)?.focus();
  }, [expenses]);

  useEffect(() => {
    const deleted = pendingMessage.current;
    if (deleted === null || readyState === null) return;
    pendingMessage.current = null;
    const totals = getTotals(readyState);
    const message = deleted + (totals.hasIncome ? ` Left to spend: ${formatMoney(totals.leftToSpendCents)}.` : '');
    // Announce after focus has moved and the dialog has gone.
    setAnnouncement((current) => ({ message, key: current.key + 1 }));
  }, [readyState]);

  if (budget.status !== 'ready') return null;
  const { state, actions } = budget;
  const rows = expensesForMonth(state);

  function handleDelete(id: string): void {
    const index = rows.findIndex((row) => row.id === id);
    const next = rows[index + 1] ?? rows[index - 1];
    const gone = rows[index];
    try {
      actions.deleteExpense(id);
      if (gone !== undefined) {
        pendingMessage.current = `Expense deleted: ${formatMoney(gone.amountCents)} for ${categoryLabel(state, gone.categoryId)} on ${formatDate(gone.date)}.`;
      }
      pendingFocus.current = next === undefined ? 'empty' : next.id;
      setError(null);
    } catch (caught) {
      pendingFocus.current = null;
      pendingMessage.current = null;
      setError(
        caught instanceof RangeError && caught.message === TOTAL_TOO_LARGE_MESSAGE
          ? TOTAL_TOO_LARGE_MESSAGE
          : GENERIC_ERROR,
      );
    }
  }

  const columns: TableColumn<Expense>[] = [
    { key: 'date', header: 'Date', rowHeader: true, cell: (e) => formatDate(e.date) },
    { key: 'category', header: 'Category', cell: (e) => categoryLabel(state, e.categoryId) },
    { key: 'note', header: 'Note', cell: (e) => e.note },
    { key: 'amount', header: 'Amount', numeric: true, cell: (e) => formatMoney(e.amountCents) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (e) => (
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Delete ${formatMoney(e.amountCents)} ${categoryLabel(state, e.categoryId)} expense from ${formatDate(e.date)}`}
          ref={(node) => {
            if (node) buttonRefs.current.set(e.id, node);
            else buttonRefs.current.delete(e.id);
          }}
          onClick={() => handleDelete(e.id)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Card title={`Expenses in ${formatMonth(state.month)}`} description="Newest first.">
      <Table
        caption={`Expense table for ${formatMonth(state.month)}`}
        captionHidden
        columns={columns}
        rows={rows}
        getRowKey={(e) => e.id}
        emptyState={
          <p ref={emptyRef} tabIndex={-1}>
            No expenses in {formatMonth(state.month)}.
          </p>
        }
      />
      <StatusMessage visuallyHidden message={announcement.message} announceKey={announcement.key} />
      {state.categories.length === 0 ? <p>Add a category on the Plan page before adding expenses.</p> : null}
      {error !== null ? (
        <p role="alert" data-part="action-error">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
