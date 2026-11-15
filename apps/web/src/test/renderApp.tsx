import { act } from '@testing-library/react';
import type { ReactElement } from 'react';

import { HistoryPage } from '@/features/history/HistoryPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { AppShell } from '@/features/shell/AppShell';
import { SpendingPage } from '@/features/spending/SpendingPage';
import { setTestPathname, usePathname } from '@/test/nextNavigation';
import {
  type RenderWithBudgetOptions,
  type RenderWithBudgetResult,
  renderWithBudget,
} from '@/test/renderWithBudget';

export type RenderAppOptions = RenderWithBudgetOptions & {
  path?: string;
  getToday?: () => string;
};

export type RenderAppResult = RenderWithBudgetResult & { goTo(path: string): void };

function CurrentPage(): ReactElement {
  switch (usePathname()) {
    case '/spending':
      return <SpendingPage />;
    case '/plan':
      return <PlanPage />;
    case '/history':
      return <HistoryPage />;
    default:
      return <OverviewPage />;
  }
}

export function renderApp(options: RenderAppOptions = {}): RenderAppResult {
  setTestPathname(options.path ?? '/');
  const result = renderWithBudget(
    <AppShell>
      <CurrentPage />
    </AppShell>,
    options,
  );
  return {
    ...result,
    goTo(path: string): void {
      act(() => setTestPathname(path));
    },
  };
}
