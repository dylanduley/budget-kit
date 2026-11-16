import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { StatusMessage } from './StatusMessage';

const textSpan = (root: HTMLElement) => root.querySelector('[data-part="status-text"]');

describe('StatusMessage', () => {
  it('empty message: region exists with role, aria-live, aria-atomic, data-part and no children', () => {
    render(<StatusMessage message="" />);
    const root = screen.getByRole('status');
    expect(root).toHaveAttribute('aria-live', 'polite');
    expect(root).toHaveAttribute('aria-atomic', 'true');
    expect(root).toHaveAttribute('data-part', 'status-message');
    expect(root).not.toHaveAttribute('data-visually-hidden');
    expect(root.textContent).toBe('');
    expect(root.children).toHaveLength(0);
    expect(root.childNodes).toHaveLength(0);
  });

  it('same node, new text: root is the same element and text is exact in one status-text span', () => {
    const { rerender } = render(<StatusMessage message="" />);
    const root = screen.getByRole('status');
    rerender(<StatusMessage message="Expense added." />);
    expect(screen.getByRole('status')).toBe(root);
    expect(root.textContent).toBe('Expense added.');
    expect(root.querySelectorAll('[data-part="status-text"]')).toHaveLength(1);
    expect(root.children).toHaveLength(1);
    rerender(<StatusMessage message="Expense deleted." />);
    expect(screen.getByRole('status')).toBe(root);
    expect(root.textContent).toBe('Expense deleted.');
    expect(root.children).toHaveLength(1);
  });

  it('renders text exactly, without trimming or altering whitespace and markup characters', () => {
    render(<StatusMessage message="  <b>5 & 6</b>  " />);
    expect(textSpan(screen.getByRole('status'))?.textContent).toBe('  <b>5 & 6</b>  ');
    expect(screen.getByRole('status').querySelector('b')).toBeNull();
  });

  it('re-announce: new announceKey with same text gives a new span, same root; unchanged key keeps span', () => {
    const { rerender } = render(<StatusMessage message="Saved." announceKey={1} />);
    const root = screen.getByRole('status');
    const first = textSpan(root);
    expect(first).not.toBeNull();
    rerender(<StatusMessage message="Saved." announceKey={2} />);
    const second = textSpan(root);
    expect(screen.getByRole('status')).toBe(root);
    expect(second).not.toBe(first);
    expect(second?.textContent).toBe('Saved.');
    expect(first?.isConnected).toBe(false);
    expect(root.children).toHaveLength(1);
    rerender(<StatusMessage message="Saved." announceKey={2} />);
    expect(textSpan(root)).toBe(second);
  });

  it('re-announce: same key and same message keeps the same span node across rerenders', () => {
    const { rerender } = render(<StatusMessage message="Saved." />);
    const span = textSpan(screen.getByRole('status'));
    rerender(<StatusMessage message="Saved." />);
    expect(textSpan(screen.getByRole('status'))).toBe(span);
  });

  it('empty again: rerender with empty message keeps the root and removes children', () => {
    const { rerender } = render(<StatusMessage message="Hello." announceKey={1} />);
    const root = screen.getByRole('status');
    rerender(<StatusMessage message="" announceKey={1} />);
    expect(screen.getByRole('status')).toBe(root);
    expect(root.children).toHaveLength(0);
    expect(root.textContent).toBe('');
  });

  it('visuallyHidden: data-visually-hidden is true, text stays in the DOM and in the accessibility tree', () => {
    render(<StatusMessage message="Item 1 added." visuallyHidden />);
    const root = screen.getByRole('status', { name: '' });
    expect(root).toHaveAttribute('data-visually-hidden', 'true');
    expect(root).toHaveTextContent('Item 1 added.');
    expect(root).not.toHaveAttribute('hidden');
    expect(root).not.toHaveAttribute('aria-hidden');
    expect(root).not.toHaveStyle({ display: 'none' });
    expect(root).toBeVisible();
    expect(textSpan(root)).not.toHaveAttribute('aria-hidden');
  });

  it('visuallyHidden: data-visually-hidden is absent when false or omitted', () => {
    render(<StatusMessage message="x" visuallyHidden={false} />);
    expect(screen.getByRole('status')).not.toHaveAttribute('data-visually-hidden');
  });

  describe('CSS source', () => {
    const css = readFileSync(join(__dirname, 'StatusMessage.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    it('visuallyHidden: hidden-state rule uses clip-path inset(50%) and position absolute', () => {
      const match = css.match(/\.message\[data-visually-hidden=['"]true['"]\]\s*\{([^}]*)\}/);
      expect(match, 'hidden-state rule exists').not.toBeNull();
      const body = match?.[1] ?? '';
      expect(body).toMatch(/clip-path\s*:\s*inset\(50%\)/);
      expect(body).toMatch(/position\s*:\s*absolute/);
    });

    it('visuallyHidden: CSS has no display: none or visibility: hidden', () => {
      expect(css).not.toMatch(/display\s*:\s*none/);
      expect(css).not.toMatch(/visibility\s*:\s*hidden/);
    });

    it('uses no colour literals', () => {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    });
  });

  it('className is appended on the root and keeps the component class', () => {
    render(<StatusMessage message="x" className="extra" />);
    const root = screen.getByRole('status');
    expect(root).toHaveClass('extra');
    expect(root.className.split(/\s+/).length).toBeGreaterThanOrEqual(2);
  });

  it('id, data-* and aria-label-free native props and ref reach the root div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<StatusMessage message="x" id="live" data-testid="sm" title="t" ref={ref} />);
    const root = screen.getByRole('status');
    expect(root.tagName).toBe('DIV');
    expect(root).toHaveAttribute('id', 'live');
    expect(root).toHaveAttribute('data-testid', 'sm');
    expect(root).toHaveAttribute('title', 't');
    expect(ref.current).toBe(root);
    expect(root).not.toHaveAttribute('aria-label');
  });

  it('role, aria-live and aria-atomic cannot be overridden by props', () => {
    const props = { role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'false', 'data-part': 'other' } as Record<
      string,
      string
    >;
    render(<StatusMessage message="x" {...props} />);
    const root = screen.getByRole('status');
    expect(root).toHaveAttribute('aria-live', 'polite');
    expect(root).toHaveAttribute('aria-atomic', 'true');
    expect(root).toHaveAttribute('data-part', 'status-message');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('children cannot be passed through props: content is only the message', () => {
    const props = { children: 'sneaky' } as Record<string, string>;
    render(<StatusMessage message="real" {...props} />);
    expect(screen.getByRole('status').textContent).toBe('real');
  });

  it('not focusable: no tabindex on root or span, and Tab skips it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        <StatusMessage message="text" />
        <button type="button">after</button>
      </>,
    );
    const root = screen.getByRole('status');
    expect(root).not.toHaveAttribute('tabindex');
    expect(textSpan(root)).not.toHaveAttribute('tabindex');
    await user.tab();
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('source contains no setTimeout, useEffect, useState or use client', () => {
    const src = readFileSync(join(__dirname, 'StatusMessage.tsx'), 'utf8');
    expect(src).not.toMatch(/setTimeout|useEffect|useState|use client/);
  });

  it('works with string announceKey and counts as a change', () => {
    const { rerender } = render(<StatusMessage message="Saved." announceKey="a" />);
    const first = textSpan(screen.getByRole('status'));
    rerender(<StatusMessage message="Saved." announceKey="b" />);
    expect(textSpan(screen.getByRole('status'))).not.toBe(first);
  });
});
