export interface FocusSnapshot {
  target: EventTarget | null;
  text: string;
  inertPresent: boolean;
}

// Records, on every focusin, who got focus, the region's text and whether any [inert] exists at that moment.
export function recordFocus(region: Element): { snapshots: FocusSnapshot[]; stop: () => void } {
  const snapshots: FocusSnapshot[] = [];
  const listener = (event: Event): void => {
    snapshots.push({
      target: event.target,
      text: region.textContent ?? '',
      inertPresent: document.querySelector('[inert]') !== null,
    });
  };
  document.addEventListener('focusin', listener);
  return { snapshots, stop: () => document.removeEventListener('focusin', listener) };
}

export const statusRegions = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-part="status-message"]'));

export const statusText = (region: Element): Element | null => region.querySelector('[data-part="status-text"]');
