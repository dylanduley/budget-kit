import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type BudgetState, createInitialState } from '@/lib/budget';
import { useBudget } from '@/state/BudgetProvider';
import { STORAGE_KEY, serializeBook } from '@/state/storage';
import { SCENARIO } from './fixtures';
import { createMemoryStorage } from './memoryStorage';
import { renderWithBudget } from './renderWithBudget';

function Show(): React.ReactElement {
  const b = useBudget();
  return b.status === 'ready' ? <p data-testid="income">{b.state.incomeCents}</p> : <p>loading</p>;
}

describe('renderWithBudget storage', () => {
  it('returns a memory storage that exposes setItemCalls, getItemCalls and dump', async () => {
    const view = renderWithBudget(<Show />);
    await screen.findByTestId('income');
    expect(typeof view.storage.setItemCalls).toBe('number');
    expect(view.storage.getItemCalls).toBeGreaterThanOrEqual(1);
    expect(view.storage.dump()).toEqual({});
  });

  it('setItemCalls is 0 right after rendering with a seeded state, and the state is stored and loaded', async () => {
    const view = renderWithBudget(<Show />, { state: SCENARIO });
    expect(view.storage.setItemCalls).toBe(0);
    await screen.findByTestId('income');
    expect(screen.getByTestId('income')).toHaveTextContent(String(SCENARIO.incomeCents));
    expect(view.storage.setItemCalls).toBe(0);
    expect(view.storage.dump()[STORAGE_KEY]).toBe(serializeBook({ months: [SCENARIO] }));
    expect(view.readStored()).toEqual(SCENARIO);
  });

  it('getItemCalls counts reads (one per load, one more after refresh)', async () => {
    const view = renderWithBudget(<Show />, { state: SCENARIO });
    await screen.findByTestId('income');
    const first = view.storage.getItemCalls;
    expect(first).toBe(1);
    view.refresh();
    await screen.findByTestId('income');
    expect(view.storage.getItemCalls).toBe(2);
  });

  it('a throwOnSet storage does not break the helper, even when asked to seed a state', async () => {
    const storage = createMemoryStorage({}, { throwOnSet: true });
    expect(() => renderWithBudget(<Show />, { storage, state: SCENARIO })).not.toThrow();
    await screen.findByTestId('income');
    expect(screen.getByTestId('income')).toHaveTextContent('0');
    expect(storage.setItemCalls).toBe(0);
  });

  it('seeds a caller-supplied storage and keeps its setItemCalls at 0', async () => {
    const storage = createMemoryStorage();
    const view = renderWithBudget(<Show />, { storage, state: SCENARIO });
    expect(view.storage).toBe(storage);
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(serializeBook({ months: [SCENARIO] }));
    await screen.findByTestId('income');
    expect(screen.getByTestId('income')).toHaveTextContent(String(SCENARIO.incomeCents));
  });

  it('seeds a plain caller-supplied storage without counters', async () => {
    const data = new Map<string, string>();
    const plain = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    const state: BudgetState = { ...createInitialState('2026-11'), incomeCents: 77 };
    renderWithBudget(<Show />, { storage: plain, state });
    await screen.findByTestId('income');
    expect(screen.getByTestId('income')).toHaveTextContent('77');
  });

  it('without a state the storage starts empty and nothing is written on load', async () => {
    const view = renderWithBudget(<Show />);
    await screen.findByTestId('income');
    expect(view.storage.setItemCalls).toBe(0);
    expect(view.readStored()).toBeNull();
  });
});
