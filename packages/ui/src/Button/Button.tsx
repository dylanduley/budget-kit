'use client';

import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react';

import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // aria-disabled instead of disabled keeps focus, so the click is blocked here.
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      {...(loading ? { 'aria-busy': true, 'aria-disabled': true } : undefined)}
      type={type}
      className={className ? `${styles.button} ${className}` : styles.button}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      onClick={handleClick}
    >
      <span className={styles.label}>{children}</span>
      {loading ? <span className={styles.spinner} data-part="spinner" aria-hidden="true" /> : null}
    </button>
  );
}
