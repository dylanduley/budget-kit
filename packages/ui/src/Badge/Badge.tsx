import type { ComponentPropsWithRef } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  variant?: BadgeVariant;
  children: string;
}

export function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={className ? `${styles.badge} ${className}` : styles.badge}
      data-variant={variant}
    >
      {children}
    </span>
  );
}
