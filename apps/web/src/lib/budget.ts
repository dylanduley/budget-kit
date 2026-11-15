export const MAX_CENTS = 99_999_999_999_999; // the MoneyField cap, 999,999,999,999.99

export interface Category { id: string; name: string; plannedCents: number }
export interface Expense { id: string; categoryId: string; amountCents: number; note: string; date: string }
export interface BudgetState {
  month: string;
  incomeCents: number;
  categories: Category[];
  expenses: Expense[];
}
export interface NewCategory { name: string; plannedCents: number }
export interface CategoryPatch { name?: string; plannedCents?: number }
export interface NewExpense { categoryId: string; amountCents: number; note: string; date: string }

export interface BudgetTotals {
  incomeCents: number;
  plannedCents: number;
  spentCents: number;
  leftToSpendCents: number;
  unplannedCents: number;
  removedCategoriesSpentCents: number;
  hasIncome: boolean;
}
export interface CategorySummary {
  category: Category;
  spentCents: number;
  remainingCents: number;
  isOverBudget: boolean;
  hasPlan: boolean;
}

export const SUGGESTED_CATEGORIES: readonly Readonly<Category>[] = Object.freeze([
  Object.freeze({ id: 'suggested-rent', name: 'Rent', plannedCents: 0 }),
  Object.freeze({ id: 'suggested-groceries', name: 'Groceries', plannedCents: 0 }),
  Object.freeze({ id: 'suggested-transport', name: 'Transport', plannedCents: 0 }),
  Object.freeze({ id: 'suggested-utilities', name: 'Utilities', plannedCents: 0 }),
  Object.freeze({ id: 'suggested-eating-out', name: 'Eating out', plannedCents: 0 }),
]);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Callers have already matched the pattern, so the slices are digits.
function yearOf(value: string): number {
  return parseInt(value.slice(0, 4), 10);
}
function monthNumberOf(value: string): number {
  return parseInt(value.slice(5, 7), 10);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysIn(year: number, month: number): number {
  const days = DAYS_IN_MONTH[month - 1];
  if (days === undefined) throw new RangeError(`Not a month: ${month}`);
  return month === 2 && isLeapYear(year) ? 29 : days;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const month = monthNumberOf(value);
  const day = parseInt(value.slice(8, 10), 10);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysIn(yearOf(value), month);
}

export function isIsoMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function monthOf(date: string): string {
  if (!isIsoDate(date)) throw new RangeError(`Not an ISO date: ${date}`);
  return date.slice(0, 7);
}

export function isDateInMonth(date: string, month: string): boolean {
  return isIsoDate(date) && monthOf(date) === month;
}

export function formatMonth(month: string): string {
  if (!isIsoMonth(month)) throw new RangeError(`Not an ISO month: ${month}`);
  return `${MONTH_NAMES[monthNumberOf(month) - 1]} ${month.slice(0, 4)}`;
}

export function defaultExpenseDate(month: string, today: string): string {
  return isDateInMonth(today, month) ? today : `${month}-01`;
}

export function datesInMonth(month: string): string[] {
  if (!isIsoMonth(month)) throw new RangeError(`Not an ISO month: ${month}`);
  const count = daysIn(yearOf(month), monthNumberOf(month));
  const dates: string[] = [];
  for (let day = 1; day <= count; day += 1) dates.push(`${month}-${pad2(day)}`);
  return dates;
}

export function sumCents(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    if (!Number.isSafeInteger(amount)) throw new RangeError(`Not a safe integer: ${amount}`);
    total += amount;
    if (!Number.isSafeInteger(total)) throw new RangeError('Total is outside the safe integer range');
  }
  return total;
}

function assertAmount(amount: number, min: number): void {
  if (!Number.isSafeInteger(amount) || amount < min || amount > MAX_CENTS) {
    throw new RangeError(`Invalid amount: ${amount}`);
  }
}

export function createInitialState(month: string): BudgetState {
  if (!isIsoMonth(month)) throw new RangeError(`Not an ISO month: ${month}`);
  return {
    month,
    incomeCents: 0,
    categories: SUGGESTED_CATEGORIES.map((category) => ({ ...category })),
    expenses: [],
  };
}

export function setIncome(state: BudgetState, incomeCents: number): BudgetState {
  assertAmount(incomeCents, 0);
  return { ...state, incomeCents };
}

export function categoryNameError(state: BudgetState, name: string, exceptId?: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a category name';
  const wanted = trimmed.toLowerCase();
  const other = state.categories.find(
    (category) => category.id !== exceptId && category.name.trim().toLowerCase() === wanted,
  );
  return other === undefined ? null : `You already have a category called ${other.name.trim()}`;
}

export function addCategory(state: BudgetState, input: NewCategory, id: string): BudgetState {
  assertAmount(input.plannedCents, 0);
  if (state.categories.some((category) => category.id === id)) {
    throw new Error(`Category id already used: ${id}`);
  }
  const nameError = categoryNameError(state, input.name);
  if (nameError !== null) throw new Error(nameError);
  const category: Category = { id, name: input.name.trim(), plannedCents: input.plannedCents };
  return { ...state, categories: [...state.categories, category] };
}

export function updateCategory(state: BudgetState, id: string, patch: CategoryPatch): BudgetState {
  if (patch.plannedCents !== undefined) assertAmount(patch.plannedCents, 0);
  if (!state.categories.some((category) => category.id === id)) return state;
  return {
    ...state,
    categories: state.categories.map((category) => 
      category.id === id
        ? {
            id: category.id,
            name: patch.name ?? category.name,
            plannedCents: patch.plannedCents ?? category.plannedCents,
          }
        : category,
    ),
  };
}

export function removeCategory(state: BudgetState, id: string): BudgetState {
  if (!state.categories.some((category) => category.id === id)) return state;
  return { ...state, categories: state.categories.filter((category) => category.id !== id) };
}

export function addExpense(state: BudgetState, input: NewExpense, id: string): BudgetState {
  assertAmount(input.amountCents, 1);
  if (!isDateInMonth(input.date, state.month)) {
    throw new RangeError(`Date ${input.date} is not in ${state.month}`);
  }
  if (state.expenses.some((expense) => expense.id === id)) {
    throw new Error(`Expense id already used: ${id}`);
  }
  if (!state.categories.some((category) => category.id === input.categoryId)) {
    throw new Error(`Unknown category: ${input.categoryId}`);
  }
  const expense: Expense = {
    id,
    categoryId: input.categoryId,
    amountCents: input.amountCents,
    note: input.note.trim(),
    date: input.date,
  };
  return { ...state, expenses: [...state.expenses, expense] };
}

export function deleteExpense(state: BudgetState, id: string): BudgetState {
  if (!state.expenses.some((expense) => expense.id === id)) return state;
  return { ...state, expenses: state.expenses.filter((expense) => expense.id !== id) };
}

export function expensesForMonth(state: BudgetState): Expense[] {
  return state.expenses
    .map((expense, index) => ({ expense, index }))
    .filter(({ expense }) => isDateInMonth(expense.date, state.month))
    .sort((a, b) => {
      if (a.expense.date !== b.expense.date) return a.expense.date < b.expense.date ? 1 : -1;
      return b.index - a.index;
    })
    .map(({ expense }) => expense);
}

export function getTotals(state: BudgetState): BudgetTotals {
  const expenses = expensesForMonth(state);
  const plannedCents = sumCents(state.categories.map((category) => category.plannedCents));
  const spentCents = sumCents(expenses.map((expense) => expense.amountCents));
  const known = new Set(state.categories.map((category) => category.id));
  const removedCategoriesSpentCents = sumCents(
    expenses.filter((expense) => !known.has(expense.categoryId)).map((expense) => expense.amountCents),
  );
  return {
    incomeCents: state.incomeCents,
    plannedCents,
    spentCents,
    leftToSpendCents: sumCents([state.incomeCents, -spentCents]),
    unplannedCents: sumCents([state.incomeCents, -plannedCents]),
    removedCategoriesSpentCents,
    hasIncome: state.incomeCents > 0,
  };
}

export function getCategorySummaries(state: BudgetState): CategorySummary[] {
  const expenses = expensesForMonth(state);
  return state.categories.map((category) => {
    const spentCents = sumCents(
      expenses.filter((expense) => expense.categoryId === category.id).map((expense) => expense.amountCents),
    );
    return {
      category,
      spentCents,
      remainingCents: sumCents([category.plannedCents, -spentCents]),
      isOverBudget: spentCents > category.plannedCents,
      hasPlan: category.plannedCents > 0,
    };
  });
}

export function categoryLabel(state: BudgetState, categoryId: string): string {
  const category = state.categories.find((candidate) => candidate.id === categoryId);
  if (category === undefined) return 'Removed category';
  const name = category.name.trim();
  return name === '' ? 'Unnamed category' : name;
}
