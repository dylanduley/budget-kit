import type { BudgetState, NewExpense } from '@/lib/budget';

export interface ExpenseFormValues {
  amountCents: number | null;
  categoryId: string;
  note: string;
  date: string;
}

export type ExpenseField = 'amount' | 'category' | 'note';

export type ExpenseFormResult =
  | { ok: true; expense: NewExpense }
  | { ok: false; errors: Partial<Record<ExpenseField, string>> };

export const NOTE_MAX_LENGTH = 100;

export function validateExpenseForm(values: ExpenseFormValues, state: BudgetState): ExpenseFormResult {
  const errors: Partial<Record<ExpenseField, string>> = {};
  const { amountCents } = values;

  if (amountCents === null) errors.amount = 'Enter an amount like 12.50';
  else if (amountCents === 0) errors.amount = 'Enter an amount more than 0.00';

  if (values.categoryId === '' || !state.categories.some((category) => category.id === values.categoryId)) {
    errors.category = 'Choose a category';
  }

  const note = values.note.trim();
  if (note.length > NOTE_MAX_LENGTH) errors.note = `Keep the note to ${NOTE_MAX_LENGTH} characters or fewer`;

  if (Object.keys(errors).length > 0 || amountCents === null) return { ok: false, errors };

  return {
    ok: true,
    expense: { categoryId: values.categoryId, amountCents, note, date: values.date },
  };
}
