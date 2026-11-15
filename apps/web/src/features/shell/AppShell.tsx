'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';

import { NavBar } from '@budget-kit/ui';

import { AddExpense } from '@/features/expenses/AddExpense';
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

  return (
    <>
      <header className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-text">Budget Kit</p>
          <NavBar label="Main" items={NAV_ITEMS} currentHref={pathname} linkComponent={Link} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">{ready ? <AddExpense /> : null}</div>
      </header>
      <main
        className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
        aria-busy={ready ? undefined : 'true'}
      >
        {budget.status === 'ready' && budget.loadStatus === 'invalid' ? (
          <p>{budget.savedDataReplaced ? REPLACED_MESSAGE : INVALID_MESSAGE}</p>
        ) : null}
        {budget.status === 'ready' && budget.loadStatus === 'unavailable' ? <p>{UNAVAILABLE_MESSAGE}</p> : null}
        {children}
      </main>
    </>
  );
}
