import type { BudgetState } from '@/lib/budget';
import type { BudgetBook } from '@/lib/months';

export const SCENARIO_TODAY = '2026-11-14';

export const SCENARIO: BudgetState = {
  month: '2026-11',
  incomeCents: 320000,
  categories: [
    { id: 'suggested-rent', name: 'Rent', plannedCents: 150000 },
    { id: 'suggested-groceries', name: 'Groceries', plannedCents: 40000 },
    { id: 'suggested-transport', name: 'Transport', plannedCents: 12000 },
    { id: 'suggested-utilities', name: 'Utilities', plannedCents: 15000 },
    { id: 'suggested-eating-out', name: 'Eating out', plannedCents: 10000 },
  ],
  expenses: [
    { id: 'e1', categoryId: 'suggested-rent', amountCents: 150000, note: 'November rent', date: '2026-11-01' },
    { id: 'e2', categoryId: 'suggested-groceries', amountCents: 8247, note: '', date: '2026-11-03' },
    { id: 'e3', categoryId: 'suggested-eating-out', amountCents: 11235, note: 'Birthday dinner', date: '2026-11-05' },
  ],
};

export const OCTOBER: BudgetState = {
  month: '2026-10',
  incomeCents: 300000,
  categories: SCENARIO.categories.map((category) => ({ ...category })),
  expenses: [
    { id: 'o1', categoryId: 'suggested-rent', amountCents: 150000, note: 'October rent', date: '2026-10-01' },
    { id: 'o2', categoryId: 'suggested-groceries', amountCents: 199482, note: '', date: '2026-10-12' },
  ],
};

export const BOOK: BudgetBook = { months: [OCTOBER, SCENARIO] };
