'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { Button, Card, StatusMessage } from '@budget-kit/ui';

import { categoryLabel } from '@/lib/budget';
import { formatMoney } from '@/lib/format';
import { useBudget } from '@/state/BudgetProvider';

import { AddCategoryDialog } from './AddCategoryDialog';
import { actionMessage } from './actionMessage';
import { CategoryRow } from './CategoryRow';
import { Suggestions } from './Suggestions';

type PendingFocus = { kind: 'remove'; id: string | null } | { kind: 'planned'; id: string };

type PendingAnnouncement = { kind: 'added'; id: string } | { kind: 'removed'; name: string };

export function CategoriesCard(): ReactElement | null {
  const budget = useBudget();
  const [dialogOpen, setDialogOpen] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const plannedFields = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<PendingFocus | null>(null);
  const pendingAnnouncement = useRef<PendingAnnouncement | null>(null);
  const [announcement, setAnnouncement] = useState({ message: '', key: 0 });
  const categories = budget.status === 'ready' ? budget.state.categories : null;
  const readyState = budget.status === 'ready' ? budget.state : null;

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null || categories === null) return;
    pendingFocus.current = null;
    if (target.kind === 'planned') {
      plannedFields.current.get(target.id)?.focus();
      return;
    }
    const button = target.id === null ? undefined : removeButtons.current.get(target.id);
    (button ?? addButton.current)?.focus();
  }, [categories]);

  useEffect(() => {
    const pending = pendingAnnouncement.current;
    if (pending === null || readyState === null) return;
    pendingAnnouncement.current = null;
    let message: string;
    if (pending.kind === 'removed') {
      message = `Category removed: ${pending.name}.`;
    } else {
      const added = readyState.categories.find((category) => category.id === pending.id);
      if (added === undefined) return;
      message = `Category added: ${categoryLabel(readyState, added.id)}.`;
      if (added.plannedCents > 0) message += ` Planned: ${formatMoney(added.plannedCents)}.`;
    }
    // Announce after focus has moved and the dialog has gone.
    setAnnouncement((current) => ({ message, key: current.key + 1 }));
  }, [readyState]);

  if (budget.status !== 'ready') return null;
  const { state, actions } = budget;

  function registerRemove(id: string, element: HTMLButtonElement | null): void {
    if (element === null) removeButtons.current.delete(id);
    else removeButtons.current.set(id, element);
  }

  function registerPlanned(id: string, element: HTMLInputElement | null): void {
    if (element === null) plannedFields.current.delete(id);
    else plannedFields.current.set(id, element);
  }

  function handleRemove(id: string): string | null {
    const index = state.categories.findIndex((category) => category.id === id);
    const successor = state.categories[index + 1] ?? state.categories[index - 1];
    const name = categoryLabel(state, id);
    try {
      actions.removeCategory(id);
    } catch (error) {
      return actionMessage(error);
    }
    pendingFocus.current = { kind: 'remove', id: successor?.id ?? null };
    pendingAnnouncement.current = { kind: 'removed', name };
    return null;
  }

  return (
    <Card
      title="Categories"
      description="What you plan to spend in each category."
      action={
        <Button ref={addButton} variant="secondary" onClick={() => setDialogOpen(true)}>
          Add category
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {state.categories.length === 0 ? (
          <p>No categories yet. Add your own, or start from a suggestion below.</p>
        ) : (
          // Safari/VoiceOver drops list semantics when list-style is none
          // eslint-disable-next-line jsx-a11y/no-redundant-roles
          <ul role="list" className="m-0 flex list-none flex-col gap-4 p-0">
            {state.categories.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={category}
                position={index + 1}
                state={state}
                actions={actions}
                registerRemove={registerRemove}
                registerPlanned={registerPlanned}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
        <Suggestions
          state={state}
          actions={actions}
          onAdded={(id) => {
            pendingFocus.current = { kind: 'planned', id };
            pendingAnnouncement.current = { kind: 'added', id };
          }}
        />
        <StatusMessage visuallyHidden message={announcement.message} announceKey={announcement.key} />
      </div>
      {dialogOpen ? (
        <AddCategoryDialog
          open
          onClose={() => setDialogOpen(false)}
          onAdded={(id) => {
            pendingAnnouncement.current = { kind: 'added', id };
          }}
        />
      ) : null}
    </Card>
  );
}
