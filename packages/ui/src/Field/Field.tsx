import type { ReactElement, ReactNode } from 'react';
import styles from './Field.module.css';

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [error ? `${id}-error` : undefined, hint ? `${id}-hint` : undefined].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function Field({ id, label, hint, error, className, children }: FieldProps): ReactElement {
  return (
    <div
      data-part="field"
      data-invalid={error ? 'true' : undefined}
      className={className ? `${styles.field} ${className}` : styles.field}
    >
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} data-part="hint" className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} data-part="error" role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
