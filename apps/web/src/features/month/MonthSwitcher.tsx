'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { Button } from '@budget-kit/ui';

import { formatMonth } from '@/lib/budget';
import { adjacentMonth } from '@/lib/months';
import { useBudget } from '@/state/BudgetProvider';

export function MonthSwitcher(): ReactElement | null {
  const budget = useBudget();
  const pathname = usePathname();
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef<'previous' | 'next' | null>(null);
  const viewedMonth = budget.status === 'ready' ? budget.viewedMonth : null;

  // A natively disabled button drops focus to body, so hand it to the other button.
  useEffect(() => {
    const was = pressed.current;
    pressed.current = null;
    if (was === null) return;
    const mine = was === 'previous' ? previousRef.current : nextRef.current;
    const other = was === 'previous' ? nextRef.current : previousRef.current;
    if (mine?.disabled && other && !other.disabled) other.focus();
  }, [viewedMonth]);

  if (budget.status !== 'ready' || pathname === '/history') return null;

  const { months, currentMonth, isViewedMonthStored, copiedFromMonth, viewMonth } = budget;
  const previous = adjacentMonth(months, budget.viewedMonth, -1);
  const next = adjacentMonth(months, budget.viewedMonth, 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={previousRef}
          variant="secondary"
          aria-label="Previous month"
          disabled={previous === null}
          onClick={() => {
            if (previous === null) return;
            pressed.current = 'previous';
            viewMonth(previous);
          }}
        >
          Previous
        </Button>
        <p className="font-semibold text-text" aria-live="polite">
          {formatMonth(budget.viewedMonth)}
        </p>
        <Button
          ref={nextRef}
          variant="secondary"
          aria-label="Next month"
          disabled={next === null}
          onClick={() => {
            if (next === null) return;
            pressed.current = 'next';
            viewMonth(next);
          }}
        >
          Next
        </Button>
      </div>
      {budget.viewedMonth < currentMonth ? (
        <p>
          You&apos;re looking at a past month. Changes are saved to {formatMonth(budget.viewedMonth)}.
        </p>
      ) : null}
      {!isViewedMonthStored && copiedFromMonth !== null ? (
        <p>
          New month. Your income and categories were copied from {formatMonth(copiedFromMonth)}. Change them on
          the Plan page.
        </p>
      ) : null}
    </div>
  );
}
