import { type RenderResult, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { BudgetState } from '@/lib/budget';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY, type StorageLike, parseStoredBudget, serializeBudget } from '@/state/storage';
import { type MemoryStorage, createMemoryStorage } from '@/test/memoryStorage';

export interface RenderWithBudgetOptions<S extends StorageLike = MemoryStorage> {
  storage?: S;
  state?: BudgetState;
  today?: string;
}

export type RenderWithBudgetResult<S extends StorageLike = MemoryStorage> = RenderResult & {
  user: UserEvent;
  storage: S;
  refresh(): RenderResult;
  readStored(): BudgetState | null;
};

export function renderWithBudget<S extends StorageLike = MemoryStorage>(
  ui: ReactElement,
  options: RenderWithBudgetOptions<S> = {},
): RenderWithBudgetResult<S> {
  const seeded = options.state === undefined ? null : serializeBudget(options.state);
  const seed: Record<string, string> = seeded === null ? {} : { [STORAGE_KEY]: seeded };
  // Seeding through `initial` keeps setItemCalls at 0 and works with throwOnSet.
  const storage: S = options.storage ?? (createMemoryStorage(seed) as unknown as S);
  const today = options.today ?? '2026-11-14';
  if (options.storage !== undefined && seeded !== null) {
    const calls = 'setItemCalls' in storage ? storage.setItemCalls : undefined;
    try {
      storage.setItem(STORAGE_KEY, seeded);
    } catch {
      // A storage that throws on write cannot be seeded this way.
    }
    if (typeof calls === 'number') Object.assign(storage, { setItemCalls: calls });
  }

  let counter = 0;
  const createId = (): string => {
    counter += 1;
    return `id-${counter}`;
  };
  const wrap = (): ReactElement => (
    <BudgetProvider storage={storage} getToday={() => today} createId={createId}>
      {ui}
    </BudgetProvider>
  );

  const user = userEvent.setup();
  const result = render(wrap());

  return {
    ...result,
    user,
    storage,
    // The id counter keeps running so ids created after a refresh do not collide with stored ones.
    refresh() {
      result.unmount();
      return render(wrap());
    },
    readStored() {
      const loaded = parseStoredBudget(storage.getItem(STORAGE_KEY));
      return loaded.status === 'loaded' ? loaded.state : null;
    },
  };
}
