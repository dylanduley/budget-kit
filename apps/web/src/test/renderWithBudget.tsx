import { type RenderResult, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { BudgetState } from '@/lib/budget';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY, type StorageLike, parseStoredBudget, serializeBudget } from '@/state/storage';
import { createMemoryStorage } from '@/test/memoryStorage';

export interface RenderWithBudgetOptions {
  storage?: StorageLike & Partial<{ dump(): Record<string, string> }>;
  state?: BudgetState;
  today?: string;
}

export type RenderWithBudgetResult = RenderResult & {
  user: UserEvent;
  storage: StorageLike;
  refresh(): RenderResult;
  readStored(): BudgetState | null;
};

export function renderWithBudget(ui: ReactElement, options: RenderWithBudgetOptions = {}): RenderWithBudgetResult {
  const storage = options.storage ?? createMemoryStorage();
  const today = options.today ?? '2026-11-14';
  if (options.state !== undefined) storage.setItem(STORAGE_KEY, serializeBudget(options.state));

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
