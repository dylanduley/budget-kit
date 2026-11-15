import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavBar, type NavBarItem, type NavBarLinkProps } from './NavBar';

const items: readonly NavBarItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/spending', label: 'Spending' },
  { href: '/plan', label: 'Plan' },
  { href: '/history', label: 'History' },
];

const meta = {
  title: 'Components/NavBar',
  component: NavBar,
  args: { label: 'Main', items, currentHref: '/' },
  parameters: {
    docs: {
      description: {
        component: [
          'A navigation landmark with a row of links between pages. The current page is marked with `aria-current="page"` and shown with a bottom border and bolder text, so it does not rely on colour.',
          '',
          'Pass your router\'s link as `linkComponent` (for example Next.js `Link`); the default is a plain `<a>`. `currentHref` is matched exactly against each `href`.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: { description: 'Accessible name of the navigation landmark, such as "Main".' },
    items: { description: 'The links, in order: `{ href, label }`.' },
    currentHref: { description: 'The `href` of the current page, or `null` for none. Exact match.' },
    linkComponent: { description: 'Component used to render each link. Defaults to `<a>`.' },
  },
} satisfies Meta<typeof NavBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CurrentLast: Story = { args: { currentHref: '/history' } };

export const NoCurrent: Story = { args: { currentHref: null } };

export const Narrow: Story = {
  parameters: {
    docs: { description: { story: 'The links wrap onto a second line in a 320px container. axe in jsdom cannot test wrapping, so check it by eye at 320px.' } },
  },
  render: (args) => (
    <div style={{ width: '320px' }}>
      <NavBar {...args} />
    </div>
  ),
};

export const LongLabel: Story = {
  parameters: {
    docs: { description: { story: 'A 60-character unbroken label wraps inside its item. %s' } },
  },
  args: {
    items: [
      { href: '/', label: 'Overview' },
      { href: '/long', label: 'A'.repeat(60) },
    ],
  },
  render: (args) => (
    <div style={{ width: '320px' }}>
      <NavBar {...args} />
    </div>
  ),
};

function CustomAnchor({ children, ...props }: NavBarLinkProps) {
  return (
    <a {...props} data-router="custom">
      {children}
    </a>
  );
}

export const CustomLink: Story = { args: { linkComponent: CustomAnchor } };
