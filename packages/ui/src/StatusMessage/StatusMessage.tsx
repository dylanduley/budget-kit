import type { ComponentPropsWithRef } from 'react';

import styles from './StatusMessage.module.css';

export interface StatusMessageProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'role' | 'aria-live' | 'aria-atomic'> {
  /** The text to announce. '' renders the region with nothing in it. */
  message: string;
  /** Change this (for example a counter) to announce the same text again. */
  announceKey?: string | number;
  /** Hide the text visually but keep it for assistive technology. Default false. */
  visuallyHidden?: boolean;
}

export function StatusMessage({
  message,
  announceKey,
  visuallyHidden = false,
  className,
  ...rest
}: StatusMessageProps) {
  const rootClass = className ? `${styles.message} ${className}` : styles.message;

  return (
    <div
      {...rest}
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-part="status-message"
      data-visually-hidden={visuallyHidden ? 'true' : undefined}
    >
      {message !== '' ? (
        <span key={announceKey} data-part="status-text">
          {message}
        </span>
      ) : null}
    </div>
  );
}
