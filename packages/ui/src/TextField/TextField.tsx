import { useId } from 'react';
import type { ComponentPropsWithRef, ReactElement } from 'react';
import { Field, describedBy } from '../Field/Field';
import styles from './TextField.module.css';

export interface TextFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'prefix' | 'aria-describedby' | 'aria-invalid'> {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  type?: 'text' | 'number';
}

export function TextField({
  label,
  hint,
  error,
  prefix,
  type = 'text',
  id,
  className,
  ...inputProps
}: TextFieldProps): ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} className={className}>
      <div className={styles.box}>
        {prefix ? (
          <span data-part="prefix" aria-hidden="true" className={styles.prefix}>
            {prefix}
          </span>
        ) : null}
        <input
          {...inputProps}
          id={inputId}
          type={type}
          className={styles.input}
          aria-describedby={describedBy(inputId, hint, error)}
          aria-invalid={error ? true : undefined}
        />
      </div>
    </Field>
  );
}
