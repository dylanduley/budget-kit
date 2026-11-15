'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { Button, Card, MoneyField, TextField } from '@budget-kit/ui';

import { type BudgetState, type Category, categoryLabel, categoryNameError } from '@/lib/budget';
import { type BudgetActions, TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';

const GENERIC_ERROR = 'Something went wrong. Your budget was not changed.';
const AMOUNT_ERROR = 'Enter an amount like 250.00';

function actionMessage(error: unknown): string {
  return error instanceof RangeError && error.message === TOTAL_TOO_LARGE_MESSAGE
    ? TOTAL_TOO_LARGE_MESSAGE
    : GENERIC_ERROR;
}

function draftFromCents(cents: number): number | null {
  return cents === 0 ? null : cents;
}

interface CategoryRowProps {
  category: Category;
  position: number;
  state: BudgetState;
  actions: BudgetActions;
  registerRemove: (id: string, element: HTMLButtonElement | null) => void;
  onRemove: (id: string) => string | null;
}

function CategoryRow({
  category,
  position,
  state,
  actions,
  registerRemove,
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

  function handleRemove(): void {
    setRemoveError(onRemove(id));
  }

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
        label={`Category ${position} planned (USD)`}
        value={plannedDraft}
        error={plannedError ?? undefined}
        onChange={handlePlannedChange}
      />
      <div className="flex flex-col gap-2">
        <Button
          ref={(element) => registerRemove(id, element)}
          variant="secondary"
          size="sm"
          aria-label={`Remove ${categoryLabel(state, id)}`}
          onClick={handleRemove}
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

export function MonthSetup(): ReactElement | null {
  const budget = useBudget();
  if (budget.status !== 'ready') return null;
  return <MonthSetupReady state={budget.state} actions={budget.actions} />;
}

function MonthSetupReady({ state, actions }: { state: BudgetState; actions: BudgetActions }): ReactElement {
  const [incomeDraft, setIncomeDraft] = useState<number | null>(() => draftFromCents(state.incomeCents));
  const [incomeError, setIncomeError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newPlanned, setNewPlanned] = useState<number | null>(null);
  const [newNameError, setNewNameError] = useState<string | null>(null);
  const [newPlannedError, setNewPlannedError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const newNameRef = useRef<HTMLInputElement>(null);
  const newPlannedRef = useRef<HTMLInputElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  // Id of the row to focus once a removal has re-rendered; null means the new-name field.
  const pendingFocus = useRef<{ id: string | null } | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    const button = target.id === null ? undefined : removeButtons.current.get(target.id);
    (button ?? newNameRef.current)?.focus();
  }, [state.categories]);

  function registerRemove(id: string, element: HTMLButtonElement | null): void {
    if (element === null) removeButtons.current.delete(id);
    else removeButtons.current.set(id, element);
  }

  function handleIncomeChange(cents: number | null): void {
    setIncomeDraft(cents);
    try {
      actions.setIncome(cents ?? 0);
      setIncomeError(null);
    } catch (error) {
      setIncomeError(actionMessage(error));
    }
  }

  function handleRemove(id: string): string | null {
    const index = state.categories.findIndex((category) => category.id === id);
    const successor = state.categories[index + 1] ?? state.categories[index - 1];
    try {
      actions.removeCategory(id);
    } catch (error) {
      return actionMessage(error);
    }
    pendingFocus.current = { id: successor?.id ?? null };
    return null;
  }

  function handleNewNameChange(value: string): void {
    setNewName(value);
    setNewNameError(null);
    setAddError(null);
  }

  function handleNewPlannedChange(cents: number | null): void {
    setNewPlanned(cents);
    setNewPlannedError(null);
    setAddError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nameProblem = categoryNameError(state, newName);
    const plannedProblem = newPlanned === null ? AMOUNT_ERROR : null;
    setNewNameError(nameProblem);
    setNewPlannedError(plannedProblem);
    setAddError(null);
    if (nameProblem !== null) {
      newNameRef.current?.focus();
      return;
    }
    if (newPlanned === null) {
      newPlannedRef.current?.focus();
      return;
    }
    try {
      actions.addCategory({ name: newName, plannedCents: newPlanned });
    } catch (error) {
      const message = actionMessage(error);
      if (message === TOTAL_TOO_LARGE_MESSAGE) setNewPlannedError(message);
      else setAddError(message);
      return;
    }
    setNewName('');
    setNewPlanned(null);
    newNameRef.current?.focus();
  }

  return (
    <Card
      title="Set up the month"
      description="Enter your monthly income and how much you plan to spend in each category."
    >
      <div className="flex flex-col gap-6">
        <MoneyField
          label="Monthly income (USD)"
          value={incomeDraft}
          error={incomeError ?? undefined}
          onChange={handleIncomeChange}
        />
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-text">Categories</h3>
          {state.categories.length === 0 ? (
            <p>No categories yet. Add one below.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {state.categories.map((category, index) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  position={index + 1}
                  state={state}
                  actions={actions}
                  registerRemove={registerRemove}
                  onRemove={handleRemove}
                />
              ))}
            </ul>
          )}
        </div>
        <form aria-label="Add a category" noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              ref={newNameRef}
              label="New category name"
              value={newName}
              error={newNameError ?? undefined}
              onChange={(event) => handleNewNameChange(event.target.value)}
            />
            <MoneyField
              ref={newPlannedRef}
              label="New category planned (USD)"
              value={newPlanned}
              error={newPlannedError ?? undefined}
              onChange={handleNewPlannedChange}
            />
          </div>
          <Button type="submit">Add category</Button>
          {addError === null ? null : (
            <p role="alert" data-part="action-error">
              {addError}
            </p>
          )}
        </form>
      </div>
    </Card>
  );
}
