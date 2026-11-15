import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from '../TextField/TextField';
import { Select } from './Select';

const categories = [
  { value: 'housing', label: 'Housing' },
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
];

const meta = {
  title: 'Components/Select',
  component: Select,
  args: { label: 'Category', options: categories },
  parameters: {
    docs: {
      description: {
        component: [
          'A field for choosing one option from a short, known list, such as a category. Use TextField when the user types a value.',
          '',
          'It wraps a native `<select>`, so keyboard behaviour and the open list come from the browser. A `placeholder` is a disabled first option, selected when there is no `value` or `defaultValue`.',
          '',
          '**Known limitations**',
          '- It is a native `<select>`: keyboard behaviour and the open list are the browser\'s own, and the open list is not styled.',
          '- With a `placeholder` and no `value` or `defaultValue`, the placeholder (a disabled first option) is selected initially.',
          '- Errors are announced when they appear (`role="alert"`) and are also linked with `aria-describedby` and `aria-invalid`, so they are read again when the control is focused.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: {
      description: 'Visible label, linked to the select. Required.',
    },
    hint: {
      description: 'Helper text shown under the field, read with the select.',
    },
    error: {
      description: 'Error message shown under the field. Setting it marks the select as invalid.',
    },
    options: {
      description: 'The choices, each with a `value`, a `label` and an optional `disabled` flag.',
    },
    placeholder: {
      description: 'Text for a disabled first option, selected when there is no `value` or `defaultValue`.',
    },
    value: {
      description: 'The selected option `value` for a controlled select. Pair it with `onChange`.',
    },
    defaultValue: {
      description: 'The initially selected option `value` for an uncontrolled select.',
    },
    disabled: {
      description: 'Disables the select.',
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
  args: { placeholder: 'Choose a category' },
};

export const WithHint: Story = { args: { hint: 'Used to group expenses' } };

export const WithError: Story = { args: { error: 'Pick one' } };

export const WithHintAndError: Story = {
  args: { hint: 'Used to group expenses', error: 'Pick one' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: 'food' } };

export const WithDisabledOption: Story = {
  args: {
    options: [
      { value: 'housing', label: 'Housing' },
      { value: 'food', label: 'Food', disabled: true },
      { value: 'transport', label: 'Transport' },
    ],
  },
};

export const BesideTextField: Story = {
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--bk-space-4)' }}>
      <TextField label="Expense name" />
      <Select {...args} />
    </div>
  ),
};
