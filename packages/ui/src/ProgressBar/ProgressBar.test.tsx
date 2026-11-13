import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';

import * as ui from '../index';
import { ProgressBar } from './ProgressBar';

function setup(value: number, max: number, extra: Partial<React.ComponentProps<typeof ProgressBar>> = {}) {
  const utils = render(<ProgressBar label="Groceries" value={value} max={max} {...extra} />);
  const root = utils.container.firstElementChild as HTMLElement;
  const track = within(root).getByRole('progressbar', { name: 'Groceries' });
  const fill = root.querySelector('[data-part="fill"]') as HTMLElement;
  const status = root.querySelector('[data-part="status"]') as HTMLElement;
  return { ...utils, root, track, fill, status };
}

function expectClean(container: HTMLElement) {
  expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  for (const el of container.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      expect(`${attr.name}=${attr.value}`).not.toMatch(/NaN|Infinity|undefined/);
    }
  }
}

describe('ProgressBar', () => {
  describe('tone changes at thresholds', () => {
    it.each([
      [0, 'ok'],
      [40, 'ok'],
      [80, 'ok'],
      [81, 'warning'],
      [90, 'warning'],
      [100, 'warning'],
      [101, 'danger'],
      [125, 'danger'],
    ])('max=100 value=%i -> %s', (value, tone) => {
      const { root } = setup(value, 100);
      expect(root).toHaveAttribute('data-tone', tone);
    });

    it.each([
      [2, 'ok'],
      [3, 'warning'],
      [4, 'danger'],
    ])('max=3 value=%i -> %s', (value, tone) => {
      expect(setup(value, 3).root).toHaveAttribute('data-tone', tone);
    });

    it('boundary just over 80% with large integers', () => {
      expect(setup(8_000_000, 10_000_000).root).toHaveAttribute('data-tone', 'ok');
    });
    it('boundary just over 80% with large integers (+1)', () => {
      expect(setup(8_000_001, 10_000_000).root).toHaveAttribute('data-tone', 'warning');
    });
    it('boundary at max and max+1 with large integers', () => {
      expect(setup(10_000_000, 10_000_000).root).toHaveAttribute('data-tone', 'warning');
      expect(setup(10_000_001, 10_000_000).root).toHaveAttribute('data-tone', 'danger');
    });
    it('large cents values stay exact', () => {
      const { status, root } = setup(900_719_925_474, 900_719_925_473);
      expect(root).toHaveAttribute('data-tone', 'danger');
      expect(status).toHaveTextContent('900719925474 of 900719925473, over by 1');
    });
  });

  describe('shows "over by X" when over', () => {
    it('value=125 max=100 renders over by 25', () => {
      const { status } = setup(125, 100);
      expect(status).toHaveTextContent('125 of 100, over by 25');
      expect(screen.getByText('125 of 100, over by 25')).toBeVisible();
    });
    it('value=100 max=100 renders no over by', () => {
      const { status } = setup(100, 100);
      expect(status.textContent).toBe('100 of 100');
      expect(screen.queryByText(/over by/)).toBeNull();
    });
    it('value=101 max=100 is over by 1', () => {
      expect(setup(101, 100).status.textContent).toBe('101 of 100, over by 1');
    });
  });

  describe('formatValue is applied to value, max and the overage', () => {
    it('renders $125 of $100, over by $25', () => {
      const { status, track } = setup(125, 100, { formatValue: (n) => '$' + n });
      expect(status.textContent).toBe('$125 of $100, over by $25');
      expect(track).toHaveAttribute('aria-valuetext', '$125 of $100, over by $25');
    });
    it('not over: formats value and max only', () => {
      expect(setup(40, 100, { formatValue: (n) => '$' + n }).status.textContent).toBe('$40 of $100');
    });
    it('formatter is never given NaN or Infinity', () => {
      const seen: number[] = [];
      setup(NaN, Infinity, { formatValue: (n) => (seen.push(n), String(n)) });
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
    });
  });

  describe('role=progressbar with aria-valuenow/min/max and a text label', () => {
    it('value=40 max=100 exposes the ARIA attributes and visible label', () => {
      const { track } = setup(40, 100);
      expect(track).toHaveAttribute('aria-valuemin', '0');
      expect(track).toHaveAttribute('aria-valuemax', '100');
      expect(track).toHaveAttribute('aria-valuenow', '40');
      expect(track).toHaveAttribute('aria-valuetext', '40 of 100');
      expect(screen.getByText('Groceries')).toBeVisible();
    });
  });

  describe('over 100% still renders correctly', () => {
    it('value=125 max=100 caps aria-valuenow and fill, text explains', () => {
      const { track, fill } = setup(125, 100);
      expect(track).toHaveAttribute('aria-valuenow', '100');
      expect(track).toHaveAttribute('aria-valuemax', '100');
      expect(track).toHaveAttribute('aria-valuetext', '125 of 100, over by 25');
      expect(fill.style.width).toBe('100%');
    });
    it('huge overage still caps width at 100%', () => {
      expect(setup(1e9, 1, {}).fill.style.width).toBe('100%');
    });
  });

  describe('fill width', () => {
    it.each([
      [40, 100, '40%'],
      [1, 3, '33%'],
      [2, 3, '66%'],
      [0, 100, '0%'],
      [100, 100, '100%'],
      [99, 100, '99%'],
      [1, 1000, '0%'],
      [999_999, 1_000_000, '99%'],
    ])('value=%i max=%i -> %s', (value, max, width) => {
      expect(setup(value, max).fill.style.width).toBe(width);
    });
  });

  describe('edge inputs', () => {
    it('value=0 max=0 -> ok, 0%, "0 of 0"', () => {
      const { root, fill, status, track } = setup(0, 0);
      expect(root).toHaveAttribute('data-tone', 'ok');
      expect(fill.style.width).toBe('0%');
      expect(status.textContent).toBe('0 of 0');
      expect(track).toHaveAttribute('aria-valuenow', '0');
      expect(track).toHaveAttribute('aria-valuemax', '0');
    });
    it('value=10 max=0 -> danger, 100%, "10 of 0, over by 10"', () => {
      const { root, fill, status, track } = setup(10, 0);
      expect(root).toHaveAttribute('data-tone', 'danger');
      expect(fill.style.width).toBe('100%');
      expect(status.textContent).toBe('10 of 0, over by 10');
      expect(track).toHaveAttribute('aria-valuenow', '0');
    });
    it('value=-5 max=100 behaves exactly like value=0', () => {
      const a = setup(-5, 100);
      const b = setup(0, 100);
      expect(a.root.getAttribute('data-tone')).toBe(b.root.getAttribute('data-tone'));
      expect(a.fill.style.width).toBe(b.fill.style.width);
      expect(a.status.textContent).toBe(b.status.textContent);
      expect(a.track.getAttribute('aria-valuenow')).toBe('0');
      expect(a.track.getAttribute('aria-valuetext')).toBe(b.track.getAttribute('aria-valuetext'));
    });
    it('value=NaN behaves like value=0', () => {
      const { root, fill, status, track } = setup(NaN, 100);
      expect(root).toHaveAttribute('data-tone', 'ok');
      expect(fill.style.width).toBe('0%');
      expect(status.textContent).toBe('0 of 100');
      expect(track).toHaveAttribute('aria-valuenow', '0');
    });
    it('negative max is treated as 0', () => {
      const { root, status, fill } = setup(5, -10);
      expect(root).toHaveAttribute('data-tone', 'danger');
      expect(status.textContent).toBe('5 of 0, over by 5');
      expect(fill.style.width).toBe('100%');
    });
    it('negative value and negative max -> 0 of 0', () => {
      const { root, status } = setup(-1, -1);
      expect(root).toHaveAttribute('data-tone', 'ok');
      expect(status.textContent).toBe('0 of 0');
    });
    it.each([
      ['NaN value', NaN, 100],
      ['NaN max', 10, NaN],
      ['NaN both', NaN, NaN],
      ['Infinity value', Infinity, 100],
      ['-Infinity value', -Infinity, 100],
      ['Infinity max', 10, Infinity],
      ['-Infinity max', 10, -Infinity],
      ['Infinity both', Infinity, Infinity],
      ['negative both', -3, -4],
    ])('no NaN/Infinity reaches the DOM: %s', (_name, value, max) => {
      const { container } = setup(value, max);
      expectClean(container);
    });
    it('Infinity max is treated as 0 (danger when value > 0)', () => {
      const { root, status } = setup(10, Infinity);
      expect(root).toHaveAttribute('data-tone', 'danger');
      expect(status.textContent).toBe('10 of 0, over by 10');
    });
    it('Infinity value is treated as 0', () => {
      const { root, status } = setup(Infinity, 100);
      expect(root).toHaveAttribute('data-tone', 'ok');
      expect(status.textContent).toBe('0 of 100');
    });
  });

  describe('tone is never colour-only', () => {
    it.each([
      [40, 100],
      [90, 100],
      [125, 100],
      [10, 0],
    ])('status text with numbers is visible for value=%i max=%i, and danger includes over by', (value, max) => {
      const { status, root } = setup(value, max);
      expect(status).toBeVisible();
      expect(status.textContent).toMatch(new RegExp(`^${value} of ${max}`));
      if (root.getAttribute('data-tone') === 'danger') {
        expect(status.textContent).toContain('over by');
      } else {
        expect(status.textContent).not.toContain('over by');
      }
    });
  });

  describe('two ProgressBars on one page have different label ids', () => {
    it('each track is labelled by its own label', () => {
      render(
        <>
          <ProgressBar label="Groceries" value={1} max={10} />
          <ProgressBar label="Transport" value={2} max={10} />
        </>,
      );
      const a = screen.getByRole('progressbar', { name: 'Groceries' });
      const b = screen.getByRole('progressbar', { name: 'Transport' });
      const idA = a.getAttribute('aria-labelledby');
      const idB = b.getAttribute('aria-labelledby');
      expect(idA).toBeTruthy();
      expect(idB).toBeTruthy();
      expect(idA).not.toBe(idB);
      expect(document.getElementById(idA as string)).toHaveTextContent('Groceries');
      expect(document.getElementById(idB as string)).toHaveTextContent('Transport');
    });
  });

  describe('className is appended and native props reach the root', () => {
    it('appends className, keeps the base class, and forwards props and ref to the root div', () => {
      const ref = createRef<HTMLDivElement>();
      const { root } = setup(1, 2, {
        className: 'extra',
        id: 'pb',
        title: 'hello',
        ref,
      });
      expect(root.tagName).toBe('DIV');
      expect(root).toHaveClass('extra');
      expect(root.className.split(' ').length).toBeGreaterThan(1);
      expect(root).toHaveAttribute('id', 'pb');
      expect(root).toHaveAttribute('title', 'hello');
      expect(root.closest('[id="pb"]')).toBe(root);
      expect(ref.current).toBe(root);
      expect(root).toHaveAttribute('data-tone', 'ok');
    });
    it('without className there is no "undefined" class', () => {
      expect(setup(1, 2).root.className).not.toContain('undefined');
    });
  });

  describe('not interactive', () => {
    it('adds no tab stop', () => {
      const { container } = setup(1, 2);
      const focusable = container.querySelectorAll('[tabindex], a, button, input, select, textarea');
      expect(focusable).toHaveLength(0);
    });
  });

  describe('typed props and public exports', () => {
    it('ProgressBar is importable from the package index', () => {
      expect(ui.ProgressBar).toBe(ProgressBar);
    });
    it('omitting label, value or max is a type error', () => {
      // Compile-time check: typecheck fails if any directive below becomes unused.
      const elements = [
        // @ts-expect-error label is required
        <ProgressBar value={1} max={2} />,
        // @ts-expect-error value is required
        <ProgressBar label="x" max={2} />,
        // @ts-expect-error max is required
        <ProgressBar label="x" value={1} />,
      ];
      expect(elements).toHaveLength(3);
    });
    it('ProgressBarProps and ProgressBarTone types are exported', () => {
      const tone: ui.ProgressBarTone = 'ok';
      const props: ui.ProgressBarProps = { label: 'x', value: 1, max: 2 };
      expect([tone, props.label]).toEqual(['ok', 'x']);
    });
  });
});
