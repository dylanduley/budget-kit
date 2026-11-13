import { useId } from 'react';
import type { ComponentPropsWithRef, ReactElement } from 'react';
import { Field, describedBy } from '../Field/Field';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<
    ComponentPropsWithRef<'select'>,
    'children' | 'multiple' | 'size' | 'aria-describedby' | 'aria-invalid'
  > {
  label: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  id,
  className,
  ...selectProps
}: SelectProps): ReactElement {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field id={selectId} label={label} hint={hint} error={error} className={className}>
      <div className={styles.box}>
        <select
          {...selectProps}
          id={selectId}
          className={styles.select}
          aria-describedby={describedBy(selectId, hint, error)}
          aria-invalid={error ? true : undefined}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}
