'use client';

import type { ReactElement } from 'react';
import { Badge, Card, ProgressBar, Stat } from '@budget-kit/ui';

import { categoryLabel, getCategorySummaries, getTotals } from '@/lib/budget';
import { formatMoney } from '@/lib/format';
import { useBudget } from '@/state/BudgetProvider';

const INCOME_PROMPT = 'Enter your monthly income in Set up the month below';

export function Dashboard(): ReactElement | null {
  const budget = useBudget();
  if (budget.status !== 'ready') return null;

  const { state } = budget;
  const totals = getTotals(state);
  const summaries = getCategorySummaries(state);
  const { leftToSpendCents, unplannedCents } = totals;

  return (
    <>
      <Card title="Summary">
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          <li>
            <Stat label="Income" value={formatMoney(totals.incomeCents)} />
          </li>
          <li>
            <Stat label="Planned" value={formatMoney(totals.plannedCents)} />
          </li>
          <li>
            <Stat label="Spent" value={formatMoney(totals.spentCents)} />
          </li>
          <li>
            {totals.hasIncome ? (
              <Stat
                label="Left to spend"
                value={formatMoney(leftToSpendCents)}
                tone={leftToSpendCents < 0 ? 'bad' : 'neutral'}
                change={
                  leftToSpendCents < 0
                    ? `Spent ${formatMoney(-leftToSpendCents)} more than your income`
                    : undefined
                }
              />
            ) : (
              <Stat label="Left to spend" value="Not set" change={INCOME_PROMPT} />
            )}
          </li>
          <li>
            {totals.hasIncome ? (
              <Stat
                label="Unplanned money"
                value={formatMoney(unplannedCents)}
                tone={unplannedCents < 0 ? 'bad' : 'neutral'}
                change={
                  unplannedCents < 0
                    ? `Planned ${formatMoney(-unplannedCents)} more than your income`
                    : unplannedCents > 0
                      ? 'Not yet assigned to a category'
                      : undefined
                }
              />
            ) : (
              <Stat label="Unplanned money" value="Not set" change={INCOME_PROMPT} />
            )}
          </li>
        </ul>
      </Card>
      <Card title="Spending by category">
        {summaries.length === 0 ? (
          <p>No categories yet. Add one in Set up the month below.</p>
        ) : (
          <ul className="flex list-none flex-col gap-4 p-0">
            {summaries.map((summary) => {
              const label = categoryLabel(state, summary.category.id);
              return (
                <li key={summary.category.id} className="flex flex-col gap-2">
                  {summary.hasPlan ? (
                    <>
                      <ProgressBar
                        label={label}
                        value={summary.spentCents}
                        max={summary.category.plannedCents}
                        formatValue={formatMoney}
                      />
                      {summary.isOverBudget ? (
                        <Badge variant="danger">Over budget</Badge>
                      ) : (
                        <p>{formatMoney(summary.remainingCents)} left</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p>{label}</p>
                      <Badge variant="neutral">No plan set</Badge>
                      <p>Spent {formatMoney(summary.spentCents)}</p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {totals.removedCategoriesSpentCents > 0 ? (
          <p>
            The Spent total includes {formatMoney(totals.removedCategoriesSpentCents)} from removed
            categories, which are not listed above.
          </p>
        ) : null}
      </Card>
    </>
  );
}
