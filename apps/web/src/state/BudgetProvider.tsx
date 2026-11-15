'use client';

import {
  type ReactElement,
  type ReactNode,
  createContext,
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
  createInitialState,
  monthOf,
} from '@/lib/budget';
import { todayIso } from '@/lib/clock';
import { type BudgetAction, budgetReducer } from '@/state/budgetReducer';
import { type LoadResult, type StorageLike, loadBudget, saveBudget } from '@/state/storage';

export interface BudgetActions {
  setIncome(incomeCents: number): void;
  addCategory(input: NewCategory): string;
  updateCategory(id: string, patch: CategoryPatch): void;
  removeCategory(id: string): void;
  addExpense(input: NewExpense): string;
  deleteExpense(id: string): void;
  resetMonth(): void;
}

export type BudgetContextValue =
  | { status: 'loading' }
  | {
      status: 'ready';
      state: BudgetState;
      today: string;
      currentMonth: string;
      isOtherMonth: boolean;
      generation: number;
      loadStatus: LoadResult['status'];
      actions: BudgetActions;
    };

export interface BudgetProviderProps {
  children: ReactNode;
  storage?: StorageLike | null;
  getToday?: () => string;
  createId?: () => string;
}

interface Model {
  state: BudgetState;
  today: string;
  generation: number;
  loadStatus: LoadResult['status'];
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function defaultGetToday(): string {
  return todayIso();
}

function defaultCreateId(): string {
  return crypto.randomUUID();
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
      state: result.status === 'loaded' ? result.state : createInitialState(monthOf(today)),
      today,
      generation: 0,
      loadStatus: result.status,
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
    function commit(action: BudgetAction, generation?: number): void {
      const m = current();
      const next: Model = {
        ...m,
        state: budgetReducer(m.state, action),
        generation: generation ?? m.generation,
      };
      modelRef.current = next;
      saveBudget(storageRef.current, next.state);
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
      resetMonth: () => {
        const m = current();
        commit({ type: 'reset', month: monthOf(m.today) }, m.generation + 1);
      },
    };
  }, []);

  const value = useMemo<BudgetContextValue>(() => {
    if (model === null) return { status: 'loading' };
    const currentMonth = monthOf(model.today);
    return {
      status: 'ready',
      state: model.state,
      today: model.today,
      currentMonth,
      isOtherMonth: model.state.month !== currentMonth,
      generation: model.generation,
      loadStatus: model.loadStatus,
      actions,
    };
  }, [model, actions]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const value = useContext(BudgetContext);
  if (value === null) throw new Error('useBudget must be used inside a BudgetProvider');
  return value;
}
