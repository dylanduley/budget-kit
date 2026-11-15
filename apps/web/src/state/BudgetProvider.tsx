'use client';

import {
  type ReactElement,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type BudgetState,
  type CategoryPatch,
  type NewCategory,
  type NewExpense,
  monthOf,
} from '@/lib/budget';
import { todayIso } from '@/lib/clock';
import {
  type BudgetBook,
  EMPTY_BOOK,
  availableMonths,
  copySourceFor,
  findMonth,
  monthToShow,
  putMonth,
} from '@/lib/months';
import { type BudgetAction, budgetReducer } from '@/state/budgetReducer';
import { type LoadResult, type StorageLike, canBeTotalled, loadBudget, saveBook } from '@/state/storage';

export interface BudgetActions {
  setIncome(incomeCents: number): void;
  addCategory(input: NewCategory): string;
  updateCategory(id: string, patch: CategoryPatch): void;
  removeCategory(id: string): void;
  addExpense(input: NewExpense): string;
  deleteExpense(id: string): void;
  deleteAllData(): void;
}

export type BudgetContextValue =
  | { status: 'loading' }
  | {
      status: 'ready';
      state: BudgetState;
      book: BudgetBook;
      viewedMonth: string;
      months: string[];
      isViewedMonthStored: boolean;
      copiedFromMonth: string | null;
      today: string;
      currentMonth: string;
      generation: number;
      loadStatus: LoadResult['status'];
      savedDataReplaced: boolean;
      viewMonth(month: string): void;
      actions: BudgetActions;
    };

export interface BudgetProviderProps {
  children: ReactNode;
  storage?: StorageLike | null;
  getToday?: () => string;
  createId?: () => string;
}

interface Model {
  book: BudgetBook;
  viewedMonth: string;
  today: string;
  generation: number;
  loadStatus: LoadResult['status'];
  savedDataReplaced: boolean;
}

export const TOTAL_TOO_LARGE_MESSAGE = 'That change would make a total too large.';

// Exported for test helpers only.
export const BudgetContext = createContext<BudgetContextValue | null>(null);

function defaultGetToday(): string {
  return todayIso();
}

let idCounter = 0;

// randomUUID needs a secure origin (not plain http on a LAN address), so fall back.
function defaultCreateId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  }
  idCounter += 1;
  return `${idCounter}-${Math.random().toString(36).slice(2)}`;
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function BudgetProvider({
  children,
  storage,
  getToday = defaultGetToday,
  createId = defaultCreateId,
}: BudgetProviderProps): ReactElement {
  const [model, setModel] = useState<Model | null>(null);
  // Actions read the latest model and props from refs so `actions` can stay stable.
  const modelRef = useRef<Model | null>(null);
  const storageRef = useRef<StorageLike | null>(null);
  const propsRef = useRef({ storage, getToday, createId });

  useEffect(() => {
    propsRef.current = { storage, getToday, createId };
  });

  useEffect(() => {
    const props = propsRef.current;
    const resolved = resolveStorage(props.storage);
    const today = props.getToday();
    const result = loadBudget(resolved);
    const loaded: Model = {
      book: result.status === 'loaded' ? result.book : EMPTY_BOOK,
      viewedMonth: monthOf(today),
      today,
      generation: 0,
      loadStatus: result.status,
      savedDataReplaced: false,
    };
    storageRef.current = resolved;
    modelRef.current = loaded;
    setModel(loaded);
  }, []);

  const actions = useMemo<BudgetActions>(() => {
    function current(): Model {
      const m = modelRef.current;
      if (m === null) throw new Error('The budget has not loaded yet');
      return m;
    }
    // Reduce first so a throwing action leaves state and storage untouched.
    function commit(action: BudgetAction): void {
      const m = current();
      const base = monthToShow(m.book, m.viewedMonth);
      const nextState = budgetReducer(base, action);
      if (nextState === base) return;
      if (!canBeTotalled(nextState)) throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
      const book = putMonth(m.book, nextState);
      const saved = saveBook(storageRef.current, book);
      const next: Model = {
        ...m,
        book,
        savedDataReplaced: m.savedDataReplaced || (saved && m.loadStatus === 'invalid'),
      };
      modelRef.current = next;
      setModel(next);
    }
    return {
      setIncome: (incomeCents) => commit({ type: 'setIncome', incomeCents }),
      addCategory: (input) => {
        const id = propsRef.current.createId();
        commit({ type: 'addCategory', input, id });
        return id;
      },
      updateCategory: (id, patch) => commit({ type: 'updateCategory', id, patch }),
      removeCategory: (id) => commit({ type: 'removeCategory', id }),
      addExpense: (input) => {
        const id = propsRef.current.createId();
        commit({ type: 'addExpense', input, id });
        return id;
      },
      deleteExpense: (id) => commit({ type: 'deleteExpense', id }),
      deleteAllData: () => {
        const m = current();
        const saved = saveBook(storageRef.current, EMPTY_BOOK);
        const next: Model = {
          ...m,
          book: EMPTY_BOOK,
          viewedMonth: monthOf(m.today),
          generation: m.generation + 1,
          savedDataReplaced: m.savedDataReplaced || (saved && m.loadStatus === 'invalid'),
        };
        modelRef.current = next;
        setModel(next);
      },
    };
  }, []);

  const viewMonth = useCallback((month: string): void => {
    const m = modelRef.current;
    if (m === null) throw new Error('The budget has not loaded yet');
    if (!availableMonths(m.book, monthOf(m.today)).includes(month)) {
      throw new RangeError(`Month not available: ${month}`);
    }
    if (m.viewedMonth === month) return;
    const next: Model = { ...m, viewedMonth: month };
    modelRef.current = next;
    setModel(next);
  }, []);

  const value = useMemo<BudgetContextValue>(() => {
    if (model === null) return { status: 'loading' };
    const currentMonth = monthOf(model.today);
    const stored = findMonth(model.book, model.viewedMonth);
    return {
      status: 'ready',
      state: stored ?? monthToShow(model.book, model.viewedMonth),
      book: model.book,
      viewedMonth: model.viewedMonth,
      months: availableMonths(model.book, currentMonth),
      isViewedMonthStored: stored !== undefined,
      copiedFromMonth: stored === undefined ? (copySourceFor(model.book, model.viewedMonth)?.month ?? null) : null,
      today: model.today,
      currentMonth,
      generation: model.generation,
      loadStatus: model.loadStatus,
      savedDataReplaced: model.savedDataReplaced,
      viewMonth,
      actions,
    };
  }, [model, actions, viewMonth]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const value = useContext(BudgetContext);
  if (value === null) throw new Error('useBudget must be used inside a BudgetProvider');
  return value;
}
