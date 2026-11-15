import type { Meta, StoryObj } from '@storybook/react-vite';

import { MoneyField } from '../MoneyField/MoneyField';
import { Select } from '../Select/Select';
import { TextField } from '../TextField/TextField';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save budget' },
  parameters: {
    docs: {
      description: {
        component: [
          'A button for an action the user takes on the page or in a form. Use `primary` for the main action in a view and `danger` only for destructive actions; use a link to navigate.',
          '',
          'Enter and Space activate it natively. While `loading`, it keeps focus, keeps its label in the accessibility tree (the label is only made transparent, and the button is not natively `disabled`), sets `aria-busy` and `aria-disabled`, ignores clicks (so a loading submit button does not submit its form), and hides the spinner from assistive technology.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    variant: {
      description: 'Visual style: `primary`, `secondary`, `ghost` or `danger`.',
    },
    size: {
      description: 'Height and font size: `md` (default) or `sm`.',
    },
    loading: {
      description: 'Shows a spinner over the label and blocks clicks while an action is in progress. The label keeps its width.',
    },
    disabled: {
      description: 'Disables the button. It cannot be focused or activated.',
    },
    type: {
      description: 'Native button type: `button` (default), `submit` or `reset`.',
    },
    children: {
      description: 'The button label. It is the accessible name.',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
const sizes: ButtonSize[] = ['md', 'sm'];

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete expense' } };
export const Small: Story = { args: { size: 'sm' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const LoadingSmall: Story = { args: { loading: true, size: 'sm' } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--bk-space-4)' }}>
      {variants.flatMap((variant) =>
        sizes.map((size) => (
          <div key={`${variant}-${size}`} style={{ display: 'flex', gap: 'var(--bk-space-3)', alignItems: 'center' }}>
            <Button variant={variant} size={size}>
              {`${variant} ${size}`}
            </Button>
            <Button variant={variant} size={size} disabled>
              {`${variant} ${size} disabled`}
            </Button>
            <Button variant={variant} size={size} loading>
              {`${variant} ${size} loading`}
            </Button>
          </div>
        )),
      )}
    </div>
  ),
};

export const LoadingWidth: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--bk-space-3)', justifyItems: 'start' }}>
      <Button>Save budget</Button>
      <Button loading>Save budget</Button>
    </div>
  ),
};

export const SubmitInForm: Story = {
  render: () => (
    <form
      onSubmit={(event) => event.preventDefault()}
      style={{ display: 'flex', gap: 'var(--bk-space-3)', alignItems: 'end' }}
    >
      <label style={{ display: 'grid', gap: 'var(--bk-space-1)', font: 'var(--bk-font-size-sm) var(--bk-font-sans)' }}>
        Category name
        <input type="text" name="category" style={{ font: 'inherit' }} />
      </label>
      <Button type="submit">Add category</Button>
    </form>
  ),
};

export const BesideFields: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Button md and every field are the same height (--bk-control-height). Use ghost for row actions beside fields so they do not read as inputs; size sm is for compact places, not beside fields.',
      },
    },
  },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--bk-space-3)', alignItems: 'flex-end' }}>
      <TextField label="Category 1 name" defaultValue="Housing" />
      <MoneyField label="Category 1 planned (USD)" value={120000} onChange={() => {}} />
      <Select
        label="Category"
        defaultValue="housing"
        options={[
          { value: 'housing', label: 'Housing' },
          { value: 'food', label: 'Food' },
        ]}
      />
      <Button variant="ghost">Remove</Button>
      <Button variant="secondary">Save</Button>
    </div>
  ),
};
