import { useId, type ComponentPropsWithRef } from 'react';

import styles from './ProgressBar.module.css';

export type ProgressBarTone = 'ok' | 'warning' | 'danger';

export interface ProgressBarProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  label: string;
  value: number;
  max: number;
  formatValue?: (amount: number) => string;
}

const defaultFormat = (amount: number): string => String(amount);

function normalise(amount: number): number {
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function ProgressBar({
  label,
  value: rawValue,
  max: rawMax,
  formatValue = defaultFormat,
  className,
  ...rest
}: ProgressBarProps) {
  const labelId = useId();
  const value = normalise(rawValue);
  const max = normalise(rawMax);

  // Integer comparisons so thresholds never depend on float ratios.
  const tone: ProgressBarTone = value * 5 <= max * 4 ? 'ok' : value <= max ? 'warning' : 'danger';
  const over = value > max;

  const status = over
    ? `${formatValue(value)} of ${formatValue(max)}, over by ${formatValue(value - max)}`
    : `${formatValue(value)} of ${formatValue(max)}`;

  const percent = value >= max ? (max === 0 && value === 0 ? 0 : 100) : Math.floor((value * 100) / max);

  return (
    <div {...rest} className={className ? `${styles.root} ${className}` : styles.root} data-tone={tone}>
      <div className={styles.header}>
        <span id={labelId} data-part="label" className={styles.label}>
          {label}
        </span>
        <span data-part="status" className={styles.status}>
          {status}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        aria-valuetext={status}
        className={styles.track}
      >
        <div data-part="fill" className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
