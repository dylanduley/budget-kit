'use client';

import { Button, Card } from '@budget-kit/ui';
import { type ReactElement, useState } from 'react';

import { ResetMonthDialog } from '@/features/reset/ResetMonthDialog';
import { useBudget } from '@/state/BudgetProvider';

export function ResetMonth(): ReactElement | null {
  const budget = useBudget();
  const [open, setOpen] = useState(false);

  if (budget.status !== 'ready') return null;

  return (
    <Card title="Reset month" description="Clear your income, categories and expenses and start again.">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Reset month
      </Button>
      <ResetMonthDialog open={open} onClose={() => setOpen(false)} onConfirmed={() => setOpen(false)} />
    </Card>
  );
}
