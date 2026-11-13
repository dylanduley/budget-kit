'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../Button/Button';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

const TABBABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

function getTabbables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]'),
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  closeLabel = 'Close',
  initialFocusRef,
  className,
}: DialogProps) {
  const titleId = useId();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Latest values are read from refs so the document listener is attached once per open.
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);
  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRefRef.current = initialFocusRef;
  });

  // The container is created after mount so nothing touches the DOM during server render.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;

    const el = document.createElement('div');
    el.setAttribute('data-bk-dialog-root', '');
    document.body.appendChild(el);
    // The portal needs a container the render can read, and it only exists after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainer(el);

    return () => {
      el.remove();
      setContainer(null);
    };
  }, [open]);

  useEffect(() => {
    if (!container) return;

    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child !== container && !child.hasAttribute('inert')) {
        child.setAttribute('inert', '');
        inerted.push(child);
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    (initialFocusRefRef.current?.current ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const tabbables = getTabbables(panel);
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      event.preventDefault();
      if (!first || !last) {
        panel.focus();
        return;
      }
      const active = document.activeElement;
      const index = active instanceof HTMLElement ? tabbables.indexOf(active) : -1;
      if (event.shiftKey) {
        (index <= 0 ? last : tabbables[index - 1])?.focus();
      } else {
        (index === -1 || index === tabbables.length - 1 ? first : tabbables[index + 1])?.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        panel.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      for (const el of inerted) el.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      // After inert is lifted: inert elements cannot take focus.
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus();
      triggerRef.current = null;
    };
  }, [container]);

  if (!open || !container) return null;

  return createPortal(
    <>
      <div data-part="backdrop" className={styles.backdrop} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={className ? `${styles.panel} ${className}` : styles.panel}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label={closeLabel} onClick={() => onClose()}>
            <span aria-hidden="true">×</span>
          </Button>
        </header>
        <div data-part="body" className={styles.body}>
          {children}
        </div>
        {actions ? (
          <div data-part="actions" className={styles.actions}>
            {actions}
          </div>
        ) : null}
      </div>
    </>,
    container,
  );
}
