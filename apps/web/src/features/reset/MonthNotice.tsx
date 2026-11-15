'use client';

import { Button } from '@budget-kit/ui';
import { type ReactElement, useEffect, useId, useRef, useState } from 'react';

import { ResetMonthDialog } from '@/features/reset/ResetMonthDialog';
import { formatMonth } from '@/lib/budget';
import { useBudget } from '@/state/BudgetProvider';

const MAX_FOCUS_ATTEMPTS = 10;

export function MonthNotice(): ReactElement | null {
  const budget = useBudget();
  const id = useId();
  const doneRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  // The Dialog lifts inert from the page in its own cleanup, so retry until focus can land.
  useEffect(() => {
    if (!done) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function tryFocus(): void {
      const el = doneRef.current;
      if (el === null) return;
      if (el.closest('[inert]') === null) {
        el.focus();
        return;
      }
      attempts += 1;
      if (attempts < MAX_FOCUS_ATTEMPTS) timer = setTimeout(tryFocus, 0);
    }
    tryFocus();
    return () => clearTimeout(timer);
  }, [done]);

  if (budget.status !== 'ready') return null;
  const { state, currentMonth, isOtherMonth } = budget;

  return (
    <>
      {isOtherMonth ? (
        <section aria-labelledby={id} className="flex flex-col gap-2">
          <h2 id={id}>
            New month
          </h2>
          <p>
            This budget is for {formatMonth(state.month)}. It is now {formatMonth(currentMonth)}.
          </p>
          <p>Your figures are kept until you start a new budget.</p>
          <div>
            <Button onClick={() => setOpen(true)}>Start {formatMonth(currentMonth)} budget</Button>
          </div>
        </section>
      ) : null}
      {done ? (
        <p ref={doneRef} tabIndex={-1}>
          New budget started for {formatMonth(currentMonth)}.
        </p>
      ) : null}
      <ResetMonthDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirmed={() => {
          setOpen(false);
          setDone(true);
        }}
      />
    </>
  );
}
