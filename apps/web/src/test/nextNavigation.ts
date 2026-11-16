import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  createElement,
  useSyncExternalStore,
} from 'react';
import { type Mock, vi } from 'vitest';

let pathname = '/';
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function setTestPathname(path: string): void {
  pathname = path;
  notify();
}

export function getTestPathname(): string {
  return pathname;
}

export const testRouter: { push: Mock<(href: string) => void> } = {
  push: vi.fn((href: string) => setTestPathname(href)),
};

export function resetTestNavigation(): void {
  pathname = '/';
  testRouter.push.mockClear();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getTestPathname, getTestPathname);
}

export function useRouter(): {
  push(href: string): void;
  replace(href: string): void;
  back(): void;
  refresh(): void;
  prefetch(): void;
} {
  return {
    push: (href) => testRouter.push(href),
    replace: (href) => testRouter.push(href),
    back: () => undefined,
    refresh: () => undefined,
    prefetch: () => undefined,
  };
}

export function MockLink({
  href,
  className,
  children,
  onClick,
  ...rest
}: { href: string; className?: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>): ReactElement {
  return createElement(
    'a',
    {
      ...rest,
      href,
      className,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
        if (plain && !event.defaultPrevented) {
          event.preventDefault();
          testRouter.push(href);
        }
      },
    },
    children,
  );
}
