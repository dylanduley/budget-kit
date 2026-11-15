export interface ContrastPair {
  text: string;
  background: string;
  /** WCAG minimum: 4.5 for text, 3 for control outlines and focus rings. */
  min: 4.5 | 3;
}

/** Every text/background token pair components may use. Add a pair here before using it. */
export const contrastPairs: ContrastPair[] = [
  { text: '--bk-color-text', background: '--bk-color-bg', min: 4.5 },
  { text: '--bk-color-text', background: '--bk-color-surface', min: 4.5 },
  { text: '--bk-color-text', background: '--bk-color-surface-subtle', min: 4.5 },
  { text: '--bk-color-text-muted', background: '--bk-color-bg', min: 4.5 },
  { text: '--bk-color-text-muted', background: '--bk-color-surface', min: 4.5 },
  { text: '--bk-color-text-muted', background: '--bk-color-surface-subtle', min: 4.5 },
  { text: '--bk-color-on-primary', background: '--bk-color-primary', min: 4.5 },
  { text: '--bk-color-on-primary', background: '--bk-color-primary-hover', min: 4.5 },
  { text: '--bk-color-on-primary', background: '--bk-color-primary-active', min: 4.5 },
  { text: '--bk-color-primary-text', background: '--bk-color-bg', min: 4.5 },
  { text: '--bk-color-primary-text', background: '--bk-color-surface', min: 4.5 },
  { text: '--bk-color-primary-text', background: '--bk-color-primary-subtle', min: 4.5 },
  { text: '--bk-color-success-text', background: '--bk-color-success-bg', min: 4.5 },
  { text: '--bk-color-success-text', background: '--bk-color-surface', min: 4.5 },
  { text: '--bk-color-on-status', background: '--bk-color-success', min: 4.5 },
  { text: '--bk-color-warning-text', background: '--bk-color-warning-bg', min: 4.5 },
  { text: '--bk-color-warning-text', background: '--bk-color-surface', min: 4.5 },
  { text: '--bk-color-on-status', background: '--bk-color-warning', min: 4.5 },
  { text: '--bk-color-danger-text', background: '--bk-color-danger-bg', min: 4.5 },
  { text: '--bk-color-danger-text', background: '--bk-color-surface', min: 4.5 },
  { text: '--bk-color-on-status', background: '--bk-color-danger', min: 4.5 },
  { text: '--bk-color-on-status', background: '--bk-color-danger-hover', min: 4.5 },
  { text: '--bk-color-border-strong', background: '--bk-color-bg', min: 3 },
  { text: '--bk-color-border-strong', background: '--bk-color-surface', min: 3 },
  { text: '--bk-color-focus', background: '--bk-color-bg', min: 3 },
  { text: '--bk-color-focus', background: '--bk-color-surface', min: 3 },
  { text: '--bk-color-success-text', background: '--bk-color-bg', min: 4.5 },
  { text: '--bk-color-warning-text', background: '--bk-color-bg', min: 4.5 },
  { text: '--bk-color-danger-text', background: '--bk-color-bg', min: 4.5 },
  { text: '--bk-color-danger', background: '--bk-color-surface', min: 3 },
  { text: '--bk-color-danger', background: '--bk-color-bg', min: 3 },
  { text: '--bk-color-border-strong', background: '--bk-color-surface-subtle', min: 3 },
  { text: '--bk-color-success', background: '--bk-color-surface-subtle', min: 3 },
  { text: '--bk-color-warning', background: '--bk-color-surface-subtle', min: 3 },
  { text: '--bk-color-danger', background: '--bk-color-surface-subtle', min: 3 },
  // Current NavBar link's 2px bottom border: against its own background and the page behind it.
  { text: '--bk-color-primary', background: '--bk-color-primary-subtle', min: 3 },
  { text: '--bk-color-primary', background: '--bk-color-bg', min: 3 },
];
