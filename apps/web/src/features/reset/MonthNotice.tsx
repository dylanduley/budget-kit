'use client';

import { Button } from '@budget-kit/ui';
import { type ReactElement, useEffect, useId, useRef, useState } from 'react';

import { ResetMonthDialog } from '@/features/reset/ResetMonthDialog';
import { formatMonth } from '@/lib/budget';
import { useBudget } from '@/state/BudgetProvider';

export function MonthNotice(): ReactElement | null {
  const budget = useBudget();
  const id = useId();
  const doneRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  if (budget.status !== 'ready') return null;
  const { state, currentMonth, isOtherMonth } = budget;

  return (
    <>
      {isOtherMonth ? (
        <section aria-labelledby={id} className="flex flex-col gap-2">
          <h2 id={id}>New month</h2>
          <p>
            This budget is for {formatMonth(state.month)}. It is now {formatMonth(currentMonth)}.
          </p>
          <p>Your figures are kept until you start a new budget.</p>
          <Button className="self-start" onClick={() => setOpen(true)}>
            Start {formatMonth(currentMonth)} budget
          </Button>
        </section>
      ) : null}
      {done ? (
        <p ref={doneRef} tabIndex={-1}>
          New budget started for {formatMonth(currentMonth)}.
        </p>
      ) : null}
      {open ? (
        <ResetMonthDialog
          open
          onClose={() => setOpen(false)}
          onConfirmed={() => {
            setOpen(false);
            setDone(true);
          }}
        />
      ) : null}
    </>
  );
}
