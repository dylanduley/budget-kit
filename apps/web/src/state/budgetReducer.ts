import {
  type BudgetState,
  type CategoryPatch,
  type NewCategory,
  type NewExpense,
  addCategory,
  addExpense,
  deleteExpense,
  removeCategory,
  setIncome,
  updateCategory,
} from '@/lib/budget';

export type BudgetAction =
  | { type: 'setIncome'; incomeCents: number }
  | { type: 'addCategory'; input: NewCategory; id: string }
  | { type: 'updateCategory'; id: string; patch: CategoryPatch }
  | { type: 'removeCategory'; id: string }
  | { type: 'addExpense'; input: NewExpense; id: string }
  | { type: 'deleteExpense'; id: string };

export function budgetReducer(state: BudgetState, action: BudgetAction): BudgetState {
  switch (action.type) {
    case 'setIncome':
      return setIncome(state, action.incomeCents);
    case 'addCategory':
      return addCategory(state, action.input, action.id);
    case 'updateCategory':
      return updateCategory(state, action.id, action.patch);
    case 'removeCategory':
      return removeCategory(state, action.id);
    case 'addExpense':
      return addExpense(state, action.input, action.id);
    case 'deleteExpense':
      return deleteExpense(state, action.id);
  }
}
