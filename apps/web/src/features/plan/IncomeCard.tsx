'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

import { Card, MoneyField } from '@budget-kit/ui';

import { useBudget } from '@/state/BudgetProvider';

import { actionMessage, draftFromCents } from './actionMessage';

export function IncomeCard(): ReactElement | null {
  const budget = useBudget();
  const [draft, setDraft] = useState<number | null>(() =>
    budget.status === 'ready' ? draftFromCents(budget.state.incomeCents) : null,
  );
  const [error, setError] = useState<string | null>(null);
  if (budget.status !== 'ready') return null;
  const { actions } = budget;

  function handleChange(cents: number | null): void {
    setDraft(cents);
    try {
      actions.setIncome(cents ?? 0);
      setError(null);
    } catch (caught) {
      setError(actionMessage(caught));
    }
  }

  return (
    <Card title="Income">
      <MoneyField
        label="Monthly income (USD)"
        value={draft}
        error={error ?? undefined}
        onChange={handleChange}
      />
    </Card>
  );
}
