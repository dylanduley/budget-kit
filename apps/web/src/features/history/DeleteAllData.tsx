'use client';

import { type ReactElement, useEffect, useRef, useState } from 'react';

import { Button, Card, Dialog } from '@budget-kit/ui';

import { formatMonth } from '@/lib/budget';
import { useBudget } from '@/state/BudgetProvider';

const UNEXPECTED_MESSAGE = 'Something went wrong. Your budget was not changed.';

export function DeleteAllData(): ReactElement | null {
  const budget = useBudget();
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmationRef = useRef<HTMLParagraphElement | null>(null);

  // Runs after the dialog's own focus return, so the confirmation keeps focus.
  useEffect(() => {
    if (deleted) confirmationRef.current?.focus();
  }, [deleted]);

  if (budget.status === 'loading') return null;

  const { actions, currentMonth } = budget;

  function close(): void {
    setOpen(false);
    setActionError(null);
  }

  function confirm(): void {
    setActionError(null);
    try {
      actions.deleteAllData();
    } catch {
      setActionError(UNEXPECTED_MESSAGE);
      return;
    }
    setDeleted(true);
    close();
  }

  return (
    <Card title="Start over" description="Delete every month saved in this browser and begin again.">
      <div className="flex flex-col items-start gap-4">
        {deleted ? (
          <p ref={confirmationRef} tabIndex={-1}>
            All data deleted. You&apos;re starting fresh with {formatMonth(currentMonth)}.
          </p>
        ) : null}
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Delete all data
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={close}
        title="Delete all data?"
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button variant="secondary" ref={cancelRef} onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm}>
              Delete all data
            </Button>
          </>
        }
      >
        <p>
          This deletes the income, categories and expenses of every month saved in this browser. You can&apos;t undo
          this.
        </p>
        {actionError === null ? null : (
          <p role="alert" data-part="action-error">
            {actionError}
          </p>
        )}
      </Dialog>
    </Card>
  );
}
