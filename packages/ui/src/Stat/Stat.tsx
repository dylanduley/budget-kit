import type { ComponentPropsWithRef } from 'react';

import styles from './Stat.module.css';

export type StatTone = 'good' | 'bad' | 'neutral';

export interface StatProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  label: string;
  value: string;
  change?: string;
  tone?: StatTone;
}

export function Stat({ label, value, change, tone = 'neutral', className, ...rest }: StatProps) {
  const rootClass = className ? `${styles.stat} ${className}` : styles.stat;

  return (
    <div {...rest} className={rootClass} data-tone={tone}>
      <p data-part="label" className={styles.label}>
        {label}
      </p>
      <p data-part="value" className={styles.value}>
        {value}
      </p>
      {change !== undefined && (
        <p data-part="change" className={styles.change}>
          {tone !== 'neutral' && (
            <span data-part="tone-marker" aria-hidden="true" className={styles.marker}>
              {tone === 'good' ? '✓' : '!'}
            </span>
          )}
          {tone !== 'neutral' && (
            <span data-part="tone-text" className={styles.toneText}>
              {tone === 'good' ? 'Good: ' : 'Bad: '}
            </span>
          )}
          {change}
        </p>
      )}
    </div>
  );
}
