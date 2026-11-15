'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

import { Button } from '@budget-kit/ui';

import { type BudgetState, SUGGESTED_CATEGORY_NAMES } from '@/lib/budget';
import type { BudgetActions } from '@/state/BudgetProvider';

import { actionMessage } from './actionMessage';

export interface SuggestionsProps {
  state: BudgetState;
  actions: BudgetActions;
  onAdded: (name: string) => void;
}

export function Suggestions({ state, actions, onAdded }: SuggestionsProps): ReactElement | null {
  const [error, setError] = useState<string | null>(null);
  const used = new Set(state.categories.map((category) => category.name.trim().toLowerCase()));
  const unused = SUGGESTED_CATEGORY_NAMES.filter((name) => !used.has(name.trim().toLowerCase()));
  if (unused.length === 0) return null;

  function handleAdd(name: string): void {
    try {
      actions.addCategory({ name, plannedCents: 0 });
    } catch (caught) {
      setError(actionMessage(caught));
      return;
    }
    setError(null);
    onAdded(name);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold text-text">Suggestions</h3>
      {/* Safari/VoiceOver drops list semantics when list-style is none */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ul role="list" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {unused.map((name) => (
          <li key={name}>
            <Button variant="secondary" onClick={() => handleAdd(name)}>
              Add {name}
            </Button>
          </li>
        ))}
      </ul>
      {error === null ? null : (
        <p role="alert" data-part="action-error">
          {error}
        </p>
      )}
    </div>
  );
}
