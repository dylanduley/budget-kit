'use client';

import { useId, useRef, useState } from 'react';
import type { FormEvent, ReactElement, RefObject } from 'react';

import { Button, Dialog, MoneyField, TextField } from '@budget-kit/ui';

import { categoryNameError } from '@/lib/budget';
import { TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';

import { actionMessage } from './actionMessage';

export interface AddCategoryDialogProps {
  open: boolean;
  onClose: () => void;
}

interface AddCategoryFormProps {
  formId: string;
  nameRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
}

// Mounted only while the dialog is open, so the fields are empty every time it opens.
function AddCategoryForm({ formId, nameRef, onClose }: AddCategoryFormProps): ReactElement | null {
  const budget = useBudget();
  const [name, setName] = useState('');
  const [planned, setPlanned] = useState<number | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  if (budget.status !== 'ready') return null;
  const { state, actions } = budget;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const problem = categoryNameError(state, name);
    setNameError(problem);
    setPlannedError(null);
    setActionError(null);
    if (problem !== null) {
      nameRef.current?.focus();
      return;
    }
    try {
      actions.addCategory({ name, plannedCents: planned ?? 0 });
    } catch (error) {
      const message = actionMessage(error);
      if (message === TOTAL_TOO_LARGE_MESSAGE) setPlannedError(message);
      else setActionError(message);
      return;
    }
    onClose();
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        ref={nameRef}
        label="Name"
        value={name}
        error={nameError ?? undefined}
        onChange={(event) => {
          setName(event.target.value);
          setNameError(null);
          setActionError(null);
        }}
      />
      <MoneyField
        label="Planned (USD)"
        hint="Optional. Leave empty for $0.00."
        value={planned}
        error={plannedError ?? undefined}
        onChange={(cents) => {
          setPlanned(cents);
          setPlannedError(null);
          setActionError(null);
        }}
      />
      {actionError === null ? null : (
        <p role="alert" data-part="action-error">
          {actionError}
        </p>
      )}
    </form>
  );
}

export function AddCategoryDialog({ open, onClose }: AddCategoryDialogProps): ReactElement | null {
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add category"
      initialFocusRef={nameRef}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            Save category
          </Button>
        </>
      }
    >
      <AddCategoryForm formId={formId} nameRef={nameRef} onClose={onClose} />
    </Dialog>
  );
}
