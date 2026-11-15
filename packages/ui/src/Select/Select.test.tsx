import { createRef, useState } from 'react';
import type { ReactElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as publicApi from '../index';
import { Select, type SelectOption } from './Select';
import * as stories from './Select.stories';

const options: SelectOption[] = [
  { value: 'food', label: 'Food' },
  { value: 'rent', label: 'Rent', disabled: true },
  { value: 'fun', label: 'Fun' },
];

describe('Select', () => {
  it('keyboard: the control is an HTMLSelectElement with no role, tabindex or multiple attribute', () => {
    render(<Select label="Category" options={options} />);
    const select = screen.getByLabelText('Category');
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select).not.toHaveAttribute('role');
    expect(select).not.toHaveAttribute('tabindex');
    expect(select).not.toHaveAttribute('multiple');
    expect((select as HTMLSelectElement).multiple).toBe(false);
  });

  it('keyboard: Select.tsx registers no onKeyDown/onKeyUp of its own', () => {
    const source = readFileSync(join(import.meta.dirname, 'Select.tsx'), 'utf8');
    expect(source).not.toMatch(/onKey(Down|Up|Press)/);
  });

  it('keyboard: Tab focuses the select and a disabled select is skipped by Tab', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select label="First" options={options} />
        <Select label="Second" options={options} disabled />
        <Select label="Third" options={options} />
      </>,
    );
    await user.tab();
    expect(screen.getByLabelText('First')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Third')).toHaveFocus();
  });

  it('userEvent.selectOptions calls onChange once and the value becomes the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Category" options={options} onChange={onChange} />);
    const select = screen.getByLabelText('Category');
    await user.selectOptions(select, 'fun');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveValue('fun');
  });

  it('renders one option per entry, in order, with matching value, text and disabled', () => {
    render(<Select label="Category" options={options} />);
    const rendered = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(rendered.map((o) => [o.value, o.textContent, o.disabled])).toEqual([
      ['food', 'Food', false],
      ['rent', 'Rent', true],
      ['fun', 'Fun', false],
    ]);
  });

  it('renders no options for an empty options array', () => {
    render(<Select label="Category" options={[]} />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('placeholder renders a first option with value "", disabled, and that text', () => {
    render(<Select label="Category" options={options} placeholder="Choose a category" />);
    const rendered = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(rendered).toHaveLength(options.length + 1);
    expect(rendered[0]).toHaveValue('');
    expect(rendered[0]).toHaveAttribute('disabled');
    expect(rendered[0]).toHaveTextContent('Choose a category');
    expect(rendered[1]).toHaveValue('food');
  });

  it('without placeholder no option has value ""', () => {
    render(<Select label="Category" options={options} />);
    const rendered = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(rendered).toHaveLength(options.length);
    expect(rendered.some((o) => o.value === '')).toBe(false);
  });

  it('the disabled placeholder cannot be re-selected by the user once a value is chosen', async () => {
    const user = userEvent.setup();
    render(<Select label="Category" options={options} placeholder="Choose" />);
    const select = screen.getByLabelText('Category');
    await user.selectOptions(select, 'fun');
    await user.selectOptions(select, 'Choose').catch(() => undefined);
    expect(select).toHaveValue('fun');
  });

  it('label: getByLabelText returns the select and clicking the label focuses it', async () => {
    const user = userEvent.setup();
    render(<Select label="Category" options={options} />);
    await user.click(screen.getByText('Category'));
    const select = screen.getByLabelText('Category');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveFocus();
  });

  it('error: sets aria-invalid="true" and an accessible description including the error', () => {
    render(<Select label="Category" options={options} error="Pick one" />);
    const select = screen.getByLabelText('Category');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription(expect.stringContaining('Pick one'));
  });

  it('with hint and error, aria-describedby is exactly "<id>-error <id>-hint"', () => {
    const { container } = render(
      <Select label="Category" id="c" options={options} hint="Help" error="Bad" />,
    );
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-describedby', 'c-error c-hint');
    expect(container.querySelector('#c-error[data-part="error"]')).toHaveTextContent('Bad');
    expect(container.querySelector('#c-hint[data-part="hint"]')).toHaveTextContent('Help');
  });

  it('with only hint, aria-describedby is exactly "<id>-hint" and there is no aria-invalid', () => {
    render(<Select label="Category" id="c" options={options} hint="Help" />);
    const select = screen.getByLabelText('Category');
    expect(select).toHaveAttribute('aria-describedby', 'c-hint');
    expect(select).not.toHaveAttribute('aria-invalid');
  });

  it.each([undefined, ''])('with neither hint nor error (error=%j) aria-describedby and aria-invalid are absent', (error) => {
    const { container } = render(<Select label="Category" options={options} error={error} />);
    const select = screen.getByLabelText('Category');
    expect(select).not.toHaveAttribute('aria-describedby');
    expect(select).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('[data-part="error"]')).toBeNull();
  });

  it('aria-describedby and aria-invalid passed at runtime cannot override the component values', () => {
    const conflicting = { 'aria-describedby': 'other', 'aria-invalid': 'true' } as Record<string, string>;
    const { rerender } = render(<Select label="Category" options={options} {...conflicting} />);
    const select = screen.getByLabelText('Category');
    expect(select).not.toHaveAttribute('aria-describedby');
    expect(select).not.toHaveAttribute('aria-invalid');
    rerender(<Select label="Category" id="c" options={options} hint="Help" {...conflicting} />);
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-describedby', 'c-hint');
  });

  it('a passed id is used as given and two Selects without id get different ids', () => {
    const { unmount } = render(<Select label="Category" id="custom" options={options} />);
    expect(screen.getByLabelText('Category')).toHaveAttribute('id', 'custom');
    unmount();
    render(
      <>
        <Select label="A" options={options} />
        <Select label="B" options={options} />
      </>,
    );
    const a = screen.getByLabelText('A').id;
    const b = screen.getByLabelText('B').id;
    expect(a).not.toBe('');
    expect(a).not.toBe(b);
  });

  it('disabled reaches the select', () => {
    render(<Select label="Category" options={options} disabled />);
    expect(screen.getByLabelText('Category')).toBeDisabled();
  });

  it('name, required, value and defaultValue reach the select', () => {
    const { rerender } = render(
      <Select label="Category" options={options} name="cat" required defaultValue="fun" />,
    );
    const select = screen.getByLabelText('Category');
    expect(select).toHaveAttribute('name', 'cat');
    expect(select).toBeRequired();
    expect(select).toHaveValue('fun');
    rerender(
      <Select label="Category" options={options} name="cat" value="food" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Category')).toHaveValue('food');
  });

  it('ref receives the HTMLSelectElement', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select label="Category" options={options} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    expect(ref.current).toBe(screen.getByLabelText('Category'));
  });

  it('className is appended on the root element, not the select', () => {
    const { container } = render(<Select label="Category" options={options} className="extra" />);
    expect(container.querySelector('[data-part="field"]')).toHaveClass('extra');
    expect(screen.getByLabelText('Category')).not.toHaveClass('extra');
  });

  it('the chevron adds no DOM text: the select only contains its options', () => {
    render(<Select label="Category" options={options} />);
    expect(screen.getByLabelText('Category').textContent).toBe('FoodRentFun');
  });

  it('placeholder with no value and no defaultValue: the placeholder is selected and submits an empty string', () => {
    const { container } = render(
      <form>
        <Select label="Category" name="cat" options={options} placeholder="Choose" />
      </form>,
    );
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select).toHaveValue('');
    expect(select.selectedOptions).toHaveLength(1);
    expect(select.selectedOptions[0]).toHaveTextContent('Choose');
    expect((screen.getAllByRole('option')[0] as HTMLOptionElement).selected).toBe(true);
    const form = container.querySelector('form') as HTMLFormElement;
    expect(new FormData(form).get('cat')).toBe('');
  });

  it('placeholder with an explicit defaultValue selects that option, not the placeholder', () => {
    render(<Select label="Category" options={options} placeholder="Choose" defaultValue="fun" />);
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select).toHaveValue('fun');
    expect(select.selectedOptions[0]).toHaveTextContent('Fun');
  });

  it('placeholder with controlled value="" selects the placeholder without a React warning', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Select label="Category" options={options} placeholder="Choose" value="" onChange={() => {}} />);
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select).toHaveValue('');
    expect(select.selectedOptions[0]).toHaveTextContent('Choose');
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('placeholder with a controlled real value selects that option', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Select label="Category" options={options} placeholder="Choose" value="fun" onChange={() => {}} />);
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select).toHaveValue('fun');
    expect(select.selectedOptions[0]).toHaveTextContent('Fun');
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('without placeholder and no value, the first real option is selected', () => {
    render(<Select label="Category" options={options} />);
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select).toHaveValue('food');
    expect(select.selectedOptions[0]).toHaveTextContent('Food');
  });

  it('from the placeholder state the user can pick a real option and then the value is a real one', async () => {
    const user = userEvent.setup();
    render(<Select label="Category" options={options} placeholder="Choose" />);
    const select = screen.getByLabelText('Category');
    expect(select).toHaveValue('');
    await user.selectOptions(select, 'fun');
    expect(select).toHaveValue('fun');
  });

  it('a controlled value re-renders to the new value after selectOptions', async () => {
    const user = userEvent.setup();
    function Controlled(): ReactElement {
      const [value, setValue] = useState('food');
      return <Select label="Category" options={options} value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    render(<Controlled />);
    const select = screen.getByLabelText('Category');
    expect(select).toHaveValue('food');
    await user.selectOptions(select, 'fun');
    expect(select).toHaveValue('fun');
  });

  it('a controlled value stays put when the parent ignores the change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Category" options={options} value="food" onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText('Category'), 'fun');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Category')).toHaveValue('food');
  });

  it('data-invalid="true" is on the Field root only when there is an error', () => {
    const { container, rerender } = render(<Select label="Category" options={options} error="Bad" />);
    expect(container.querySelector('[data-part="field"]')).toHaveAttribute('data-invalid', 'true');
    rerender(<Select label="Category" options={options} error="" />);
    expect(container.querySelector('[data-part="field"]')).not.toHaveAttribute('data-invalid');
    rerender(<Select label="Category" options={options} />);
    expect(container.querySelector('[data-invalid]')).toBeNull();
  });

  it('omitting label or options is a type error', () => {
    // @ts-expect-error label is required
    const noLabel = <Select options={options} />;
    // @ts-expect-error options is required
    const noOptions = <Select label="Category" />;
    expect(noLabel).toBeDefined();
    expect(noOptions).toBeDefined();
  });
});

describe('Select source and public API', () => {
  it('Select.tsx has no any, @ts-ignore or @ts-expect-error', () => {
    const source = readFileSync(join(import.meta.dirname, 'Select.tsx'), 'utf8');
    expect(source).not.toMatch(/@ts-ignore|@ts-expect-error|:\s*any\b|\bas any\b|<any>/);
  });

  it('Select.tsx has no use client directive', () => {
    const source = readFileSync(join(import.meta.dirname, 'Select.tsx'), 'utf8');
    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it('Select.module.css has no colour literals', () => {
    const css = readFileSync(join(import.meta.dirname, 'Select.module.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('Select is exported from the package index', () => {
    expect(publicApi.Select).toBe(Select);
  });
});

describe('stories', () => {
  it('every story listed under Stories required exists under Components/Select', () => {
    const required = [
      'Default',
      'WithPlaceholder',
      'WithHint',
      'WithError',
      'WithHintAndError',
      'Disabled',
      'WithDisabledOption',
      'BesideTextField',
    ];
    for (const name of required) expect(stories).toHaveProperty(name);
    expect(stories.default.title).toBe('Components/Select');
  });
});
