import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { Stat, type StatProps, type StatTone } from '../index';

const part = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-part="${name}"]`);

describe('Stat', () => {
  it('label and value: both texts are rendered, the label before the value in DOM order', () => {
    const { container } = render(<Stat label="Groceries" value="$1,200.00" />);
    const label = part(container, 'label');
    const value = part(container, 'value');
    expect(label).toHaveTextContent('Groceries');
    expect(value).toHaveTextContent('$1,200.00');
    expect(label!.compareDocumentPosition(value!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label!.tagName).toBe('P');
    expect(value!.tagName).toBe('P');
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('$1,200.00')).toBeInTheDocument();
  });

  it.each<StatTone | undefined>(['good', 'bad', 'neutral', undefined])(
    'optional change: with no change prop there is no change, marker or tone text (tone=%s)',
    (tone) => {
      const { container } = render(<Stat label="L" value="V" tone={tone} />);
      expect(part(container, 'change')).toBeNull();
      expect(part(container, 'tone-marker')).toBeNull();
      expect(part(container, 'tone-text')).toBeNull();
    },
  );

  it('optional change: a provided change renders the change line', () => {
    const { container } = render(<Stat label="L" value="V" change="x" />);
    expect(part(container, 'change')).toHaveTextContent('x');
  });

  it.each<StatTone>(['good', 'bad', 'neutral'])('data-tone on the root equals the tone prop (%s)', (tone) => {
    const { container } = render(<Stat label="L" value="V" tone={tone} />);
    expect(container.firstElementChild).toHaveAttribute('data-tone', tone);
    expect(container.firstElementChild!.tagName).toBe('DIV');
  });

  it('data-tone on the root defaults to neutral', () => {
    const { container } = render(<Stat label="L" value="V" />);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'neutral');
  });

  it('trend meaning not shown by colour alone: good has a aria-hidden check marker and full text', () => {
    const { container } = render(<Stat label="L" value="V" tone="good" change="$50.00 under plan" />);
    const change = part(container, 'change')!;
    const marker = part(container, 'tone-marker')!;
    expect(marker).toHaveTextContent('✓');
    expect(marker.textContent).toBe('✓');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
    expect(part(container, 'tone-text')!.textContent).toBe('Good: ');
    expect(change.textContent).toBe('✓Good: $50.00 under plan');
    const kids = Array.from(change.children).map((c) => c.getAttribute('data-part'));
    expect(kids).toEqual(['tone-marker', 'tone-text']);
  });

  it('trend meaning not shown by colour alone: bad has a ! marker and hidden Bad: text', () => {
    const { container } = render(<Stat label="L" value="V" tone="bad" change="$75.00 over plan" />);
    const marker = part(container, 'tone-marker')!;
    expect(marker.textContent).toBe('!');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
    expect(part(container, 'tone-text')!.textContent).toBe('Bad: ');
    expect(part(container, 'change')!.textContent).toBe('!Bad: $75.00 over plan');
  });

  it('trend meaning not shown by colour alone: neutral change text content is exactly the change string', () => {
    const { container } = render(<Stat label="L" value="V" tone="neutral" change="Same as last month" />);
    expect(part(container, 'change')!.textContent).toBe('Same as last month');
    expect(part(container, 'tone-marker')).toBeNull();
    expect(part(container, 'tone-text')).toBeNull();
  });

  it('trend meaning not shown by colour alone: default tone behaves as neutral', () => {
    const { container } = render(<Stat label="L" value="V" change="Flat" />);
    expect(part(container, 'change')!.textContent).toBe('Flat');
  });

  it('trend meaning: the accessible text exposes the tone word but not the marker', () => {
    render(<Stat label="L" value="V" tone="good" change="$50.00 under plan" />);
    expect(screen.getByText('Good:', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('✓')).toBeInTheDocument();
    expect(screen.queryByText('✓', { ignore: '[aria-hidden="true"]' })).toBeNull();
  });

  it('tone-text span is not hidden with the hidden attribute or inline display/visibility', () => {
    const { container } = render(<Stat label="L" value="V" tone="bad" change="c" />);
    const span = part(container, 'tone-text')!;
    expect(span).not.toHaveAttribute('hidden');
    expect(span).not.toHaveAttribute('aria-hidden');
    expect(span.style.display).not.toBe('none');
    expect(span.style.visibility).not.toBe('hidden');
    expect(span).toBeVisible();
  });

  it('tone-text span is not hidden with display: none or visibility: hidden in the CSS', () => {
    const css = readFileSync(join(__dirname, 'Stat.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/display\s*:\s*none/);
    expect(css).not.toMatch(/visibility\s*:\s*hidden/);
  });

  it('uses tokens: the stylesheet has no colour literals', () => {
    const css = readFileSync(join(__dirname, 'Stat.module.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('className is appended and other native props reach the root div', async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Stat
        ref={ref}
        label="L"
        value="V"
        className="extra"
        id="s1"
        data-testid="stat"
        aria-label="custom"
        onClick={onClick}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('extra');
    expect(root.className.split(' ').length).toBeGreaterThan(1);
    expect(root).toHaveAttribute('id', 's1');
    expect(root).toHaveAttribute('data-testid', 'stat');
    expect(root).toHaveAttribute('aria-label', 'custom');
    expect(ref.current).toBe(root);
    await userEvent.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('props cannot override data-tone on the root', () => {
    const { container } = render(<Stat label="L" value="V" tone="good" />);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'good');
  });

  it('typed props: value as a number is a type error', () => {
    // @ts-expect-error value must be a string
    const props: StatProps = { label: 'L', value: 1200 };
    expect(props.label).toBe('L');
  });

  it('typed props: Stat, StatProps and StatTone are importable from the package index', () => {
    const tone: StatTone = 'good';
    expect(typeof Stat).toBe('function');
    expect(tone).toBe('good');
  });

  it('visible focus / keyboard only: the Stat adds no tab stop', async () => {
    render(
      <>
        <button>before</button>
        <Stat label="A" value="1" tone="good" change="c" />
        <Stat label="B" value="2" tone="bad" change="c" />
        <Stat label="C" value="3" />
        <button>after</button>
      </>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('visible focus / keyboard only: no focusable descendants and no interactive roles', () => {
    const { container } = render(<Stat label="A" value="1" tone="good" change="c" />);
    expect(container.querySelectorAll('[tabindex], a, button, input')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('long value: renders a 20-character value without truncation', () => {
    const value = '$123,456,789,012.34!';
    expect(value).toHaveLength(20);
    const { container } = render(<Stat label="L" value={value} />);
    expect(part(container, 'value')).toHaveTextContent(value);
  });
});
