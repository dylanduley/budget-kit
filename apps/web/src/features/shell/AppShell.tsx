'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { NavBar, StatusMessage } from '@budget-kit/ui';

import { AddExpense } from '@/features/expenses/AddExpense';
import { MonthSwitcher } from '@/features/month/MonthSwitcher';
import { useBudget } from '@/state/BudgetProvider';

import { NAV_ITEMS } from './navItems';

const INVALID_MESSAGE =
  "Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.";
const REPLACED_MESSAGE = "Your saved budget couldn't be read and has been replaced.";
const UNAVAILABLE_MESSAGE =
  "This browser isn't letting the app save, so your changes will be lost when you close the page.";

export function AppShell({ children }: { children: ReactNode }): ReactElement {
  const budget = useBudget();
  const pathname = usePathname();
  const ready = budget.status === 'ready';
  const replaced = budget.status === 'ready' && budget.savedDataReplaced;
  const [showReplaced, setShowReplaced] = useState(false);

  useEffect(() => {
    // Announce only after focus has moved and any dialog has gone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowReplaced(replaced);
  }, [replaced]);

  return (
    <>
      <header className="mx-auto flex max-w-3xl flex-col gap-2 px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-text">Budget Kit</p>
          {ready ? <AddExpense /> : null}
        </div>
        <NavBar label="Main" items={NAV_ITEMS} currentHref={pathname} linkComponent={Link} />
        <MonthSwitcher />
      </header>
      <main
        className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
        aria-busy={ready ? undefined : 'true'}
      >
        {budget.status === 'ready' && budget.loadStatus === 'invalid' ? (
          <StatusMessage message={showReplaced ? REPLACED_MESSAGE : INVALID_MESSAGE} />
        ) : null}
        {budget.status === 'ready' && budget.loadStatus === 'unavailable' ? <p>{UNAVAILABLE_MESSAGE}</p> : null}
        {children}
      </main>
    </>
  );
}
