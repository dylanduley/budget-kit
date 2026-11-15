'use client';

import { useRef, useState } from 'react';
import type { ReactElement, Ref } from 'react';

import { Button, MoneyField, TextField } from '@budget-kit/ui';

import { type BudgetState, type Category, categoryLabel, categoryNameError } from '@/lib/budget';
import type { BudgetActions } from '@/state/BudgetProvider';

import { actionMessage, draftFromCents } from './actionMessage';

export interface CategoryRowProps {
  category: Category;
  position: number;
  state: BudgetState;
  actions: BudgetActions;
  registerRemove: (id: string, element: HTMLButtonElement | null) => void;
  registerPlanned: (id: string, element: HTMLInputElement | null) => void;
  onRemove: (id: string) => string | null;
}

export function CategoryRow({
  category,
  position,
  state,
  actions,
  registerRemove,
  registerPlanned,
  onRemove,
}: CategoryRowProps): ReactElement {
  const { id } = category;
  const [nameDraft, setNameDraft] = useState(category.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [plannedDraft, setPlannedDraft] = useState<number | null>(() => draftFromCents(category.plannedCents));
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const edited = useRef(false);

  function handleNameChange(value: string): void {
    edited.current = true;
    setNameDraft(value);
    setNameError(categoryNameError(state, value, id));
  }

  function handleNameBlur(): void {
    if (!edited.current) return;
    edited.current = false;
    const problem = categoryNameError(state, nameDraft, id);
    if (problem !== null) {
      setNameDraft(category.name);
      setNameError(`${problem}. The name is still ${category.name}.`);
      return;
    }
    const trimmed = nameDraft.trim();
    if (trimmed !== category.name) {
      try {
        actions.updateCategory(id, { name: trimmed });
      } catch (error) {
        setNameDraft(category.name);
        setNameError(actionMessage(error));
        return;
      }
    }
    setNameDraft(trimmed);
    setNameError(null);
  }

  function handlePlannedChange(cents: number | null): void {
    setPlannedDraft(cents);
    try {
      actions.updateCategory(id, { plannedCents: cents ?? 0 });
      setPlannedError(null);
    } catch (error) {
      setPlannedError(actionMessage(error));
    }
  }

  const plannedRef: Ref<HTMLInputElement> = (element) => registerPlanned(id, element);

  return (
    <li className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      <TextField
        label={`Category ${position} name`}
        value={nameDraft}
        error={nameError ?? undefined}
        onChange={(event) => handleNameChange(event.target.value)}
        onBlur={handleNameBlur}
      />
      <MoneyField
        ref={plannedRef}
        label={`Category ${position} planned (USD)`}
        value={plannedDraft}
        error={plannedError ?? undefined}
        onChange={handlePlannedChange}
      />
      <div className="flex flex-col items-start gap-2">
        <Button
          ref={(element) => registerRemove(id, element)}
          variant="ghost"
          aria-label={`Remove ${categoryLabel(state, id)}`}
          onClick={() => setRemoveError(onRemove(id))}
        >
          Remove
        </Button>
        {removeError === null ? null : (
          <p role="alert" data-part="action-error">
            {removeError}
          </p>
        )}
      </div>
    </li>
  );
}
