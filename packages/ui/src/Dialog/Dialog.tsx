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
    (el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert]'),
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
  const [scrollable, setScrollable] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
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
      if (event.isComposing || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const tabbables = getTabbables(panel);
      event.preventDefault();
      const count = tabbables.length;
      const active = document.activeElement;
      const index = active instanceof HTMLElement ? tabbables.indexOf(active) : -1;
      const step = event.shiftKey ? -1 : 1;
      // focus() fails silently on elements that are not really focusable (e.g. display: none),
      // so try each candidate in turn until one takes focus.
      const start = index === -1 ? (event.shiftKey ? 0 : -1) : index;
      for (let i = 1; i <= count; i += 1) {
        const candidate = tabbables[(((start + step * i) % count) + count) % count];
        candidate?.focus();
        if (document.activeElement === candidate) return;
      }
      panel.focus();
    };

    const onFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        panel.focus();
      }
    };

    // A scroller must be keyboard-focusable, but a permanent tab stop would clutter short bodies.
    const body = bodyRef.current;
    const measure = () => {
      if (body) setScrollable(body.scrollHeight > body.clientHeight);
    };
    measure();
    let observer: ResizeObserver | undefined;
    if (body && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(body);
      for (const child of Array.from(body.children)) observer.observe(child);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      observer?.disconnect();
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
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label={closeLabel} onClick={() => onClose()}>
            <span aria-hidden="true">×</span>
          </Button>
        </div>
        <div
          ref={bodyRef}
          data-part="body"
          className={styles.body}
          {...(scrollable ? { tabIndex: 0, role: 'region', 'aria-labelledby': titleId } : {})}
        >
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
