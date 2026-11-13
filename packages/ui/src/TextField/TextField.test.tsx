import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as publicApi from '../index';
import { TextField } from './TextField';
import * as stories from './TextField.stories';

describe('TextField', () => {
  it('error is linked with aria-describedby and sets aria-invalid', () => {
    render(<TextField label="Name" error="Required" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    const texts = ids.map((id) => document.getElementById(id)?.textContent);
    expect(texts).toContain('Required');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Required'));
  });

  it('with hint and error, aria-describedby is exactly "<id>-error <id>-hint" and both elements exist', () => {
    const { container } = render(<TextField label="Name" id="n" hint="Help" error="Bad" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'n-error n-hint');
    expect(container.querySelector('#n-error[data-part="error"]')).toHaveTextContent('Bad');
    expect(container.querySelector('#n-hint[data-part="hint"]')).toHaveTextContent('Help');
  });

  it('with only hint, aria-describedby is exactly "<id>-hint"', () => {
    render(<TextField label="Name" id="n" hint="Help" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'n-hint');
  });

  it.each([undefined, ''])('with error=%j there is no aria-invalid and no error element', (error) => {
    const { container } = render(<TextField label="Name" error={error} />);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('[data-part="error"]')).toBeNull();
    expect(container.querySelector('[data-invalid]')).toBeNull();
  });

  it('with neither hint nor error there is no aria-describedby attribute', () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby');
  });

  it('with only error, aria-describedby is exactly "<id>-error"', () => {
    render(<TextField label="Name" id="n" error="Bad" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'n-error');
  });

  it('label click focuses the input and getByLabelText returns the input', async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" />);
    await user.click(screen.getByText('Name'));
    const input = screen.getByLabelText('Name');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveFocus();
  });

  it('two TextFields without id get different ids', () => {
    render(
      <>
        <TextField label="A" />
        <TextField label="B" />
      </>,
    );
    const a = screen.getByLabelText('A').id;
    const b = screen.getByLabelText('B').id;
    expect(a).not.toBe('');
    expect(b).not.toBe('');
    expect(a).not.toBe(b);
  });

  it('a passed id is used as given, with hint and error ids derived from it', () => {
    const { container } = render(<TextField label="Name" id="custom" hint="h" error="e" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'custom');
    expect(container.querySelector('#custom-hint')).not.toBeNull();
    expect(container.querySelector('#custom-error')).not.toBeNull();
  });

  it('prefix renders in an aria-hidden element and the accessible name is still exactly the label', () => {
    render(<TextField label="Amount" prefix="$" />);
    const prefix = screen.getByText('$');
    expect(prefix).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('textbox', { name: 'Amount' })).toBeInTheDocument();
  });

  it('type defaults to text', () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text');
  });

  it('type="number" renders input type=number', () => {
    render(<TextField label="Day" type="number" />);
    expect(screen.getByLabelText('Day')).toHaveAttribute('type', 'number');
    expect(screen.getByRole('spinbutton', { name: 'Day' })).toBeInTheDocument();
  });

  it('value, name, required, disabled and placeholder reach the input', () => {
    render(
      <TextField label="Name" value="x" onChange={() => {}} name="nm" required disabled placeholder="ph" />,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveValue('x');
    expect(input).toHaveAttribute('name', 'nm');
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'ph');
  });

  it('typing abc fires onChange three times', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField label="Name" onChange={onChange} />);
    await user.type(screen.getByLabelText('Name'), 'abc');
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText('Name')).toHaveValue('abc');
  });

  it('ref receives the HTMLInputElement', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField label="Name" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByLabelText('Name'));
  });

  it('className is appended on the root element, not the input', () => {
    const { container } = render(<TextField label="Name" className="extra" />);
    expect(container.querySelector('[data-part="field"]')).toHaveClass('extra');
    expect(screen.getByLabelText('Name')).not.toHaveClass('extra');
  });

  it('data-invalid is set on the root only when there is an error', () => {
    const { container, rerender } = render(<TextField label="Name" error="Bad" />);
    expect(container.querySelector('[data-part="field"]')).toHaveAttribute('data-invalid', 'true');
    rerender(<TextField label="Name" />);
    expect(container.querySelector('[data-part="field"]')).not.toHaveAttribute('data-invalid');
  });

  it('DOM order is label, control, hint, error', () => {
    const { container } = render(<TextField label="Name" hint="h" error="e" />);
    const root = container.querySelector('[data-part="field"]');
    const kinds = Array.from(root?.children ?? []).map(
      (c) => c.tagName.toLowerCase() + (c.getAttribute('data-part') ? `:${c.getAttribute('data-part')}` : ''),
    );
    expect(kinds).toEqual(['label', 'div', 'p:hint', 'p:error']);
    expect(root?.querySelector('label')).toHaveAttribute('for', screen.getByLabelText('Name').id);
  });

  it('keyboard only: Tab reaches the input, typing edits it, Tab leaves it; a disabled input is skipped', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextField label="First" />
        <TextField label="Second" disabled />
        <TextField label="Third" />
      </>,
    );
    await user.tab();
    expect(screen.getByLabelText('First')).toHaveFocus();
    await user.keyboard('hi');
    expect(screen.getByLabelText('First')).toHaveValue('hi');
    await user.tab();
    expect(screen.getByLabelText('Third')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Third')).not.toHaveFocus();
  });

  it('omitting label is a type error', () => {
    // @ts-expect-error label is required
    const element = <TextField />;
    expect(element).toBeDefined();
  });
});

describe('public API', () => {
  it('Field and describedBy are not exported from the package index', () => {
    expect(publicApi).not.toHaveProperty('Field');
    expect(publicApi).not.toHaveProperty('describedBy');
  });

  it('TextField is exported from the package index', () => {
    expect(publicApi.TextField).toBe(TextField);
  });
});

describe('stories', () => {
  it('every story listed under Stories required exists under Components/TextField', () => {
    const required = [
      'Default', 'WithHint', 'WithError', 'WithHintAndError', 'WithPrefix',
      'NumberType', 'Disabled', 'Required', 'OnSurface',
    ];
    for (const name of required) expect(stories).toHaveProperty(name);
    expect(stories.default.title).toBe('Components/TextField');
  });
});
