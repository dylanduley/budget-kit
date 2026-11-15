'use client';

import { Button, Dialog } from '@budget-kit/ui';
import { type ReactElement, useRef, useState } from 'react';

import { expensesForMonth, formatMonth } from '@/lib/budget';
import { TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';

export interface ResetMonthDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}

const GENERIC_ERROR = 'Something went wrong. Your budget was not changed.';

export function ResetMonthDialog({ open, onClose, onConfirmed }: ResetMonthDialogProps): ReactElement | null {
  const budget = useBudget();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (budget.status !== 'ready') return null;
  const { state, currentMonth, isOtherMonth, actions } = budget;
  const count = expensesForMonth(state).length;
  const noun = count === 1 ? 'expense' : 'expenses';
  const ending = isOtherMonth ? `, and starts a new budget for ${formatMonth(currentMonth)}.` : '.';

  function close(): void {
    setError(null);
    onClose();
  }

  function confirm(): void {
    try {
      actions.resetMonth();
    } catch (caught) {
      setError(
        caught instanceof RangeError && caught.message === TOTAL_TOO_LARGE_MESSAGE
          ? TOTAL_TOO_LARGE_MESSAGE
          : GENERIC_ERROR,
      );
      return;
    }
    setError(null);
    onConfirmed();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Reset month?"
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button variant="secondary" ref={cancelRef} onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm}>
            Reset month
          </Button>
        </>
      }
    >
      <p>
        This deletes your income, your categories and {count} {noun} for {formatMonth(state.month)}
        {ending} You can&apos;t undo this.
      </p>
      {error !== null ? (
        <p role="alert" data-part="action-error">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
