import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table, type TableColumn } from './Table';

interface Expense {
  id: string;
  date: string;
  category: string;
  note: string;
  cents: number;
}

const expenses: Expense[] = [
  { id: 'e1', date: '2026-11-02', category: 'Groceries', note: 'Weekly shop', cents: 8423 },
  { id: 'e2', date: '2026-11-04', category: 'Transport', note: 'Train pass', cents: 12000 },
  { id: 'e3', date: '2026-11-09', category: 'Dining', note: 'Dinner with Sam', cents: 5675 },
];

const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const columns: TableColumn<Expense>[] = [
  { key: 'date', header: 'Date', cell: (row) => row.date },
  { key: 'category', header: 'Category', cell: (row) => row.category },
  { key: 'note', header: 'Note', cell: (row) => row.note },
  { key: 'amount', header: 'Amount', numeric: true, cell: (row) => formatCents(row.cents) },
];

const columnsWithAction: TableColumn<Expense>[] = [
  ...columns,
  {
    key: 'actions',
    header: 'Actions',
    cell: (row) => <button type="button">Delete {row.note}</button>,
  },
];

const meta = {
  title: 'Components/Table',
  component: Table<Expense>,
  args: {
    caption: 'Expenses',
    columns,
    rows: expenses,
    getRowKey: (row: Expense) => row.id,
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A table of rows and columns for data a user scans or compares, such as a list of expenses.',
          '',
          'The caption is the table\'s accessible name. It is visible unless `captionHidden` is set. Column headers are linked to their cells, and a column with `rowHeader` has its cells read as row headers. Numeric columns are right-aligned with tabular figures.',
          '',
          '**Known limitations**',
          '- The scroll wrapper is a focusable, named region (one extra tab stop per table); a focusable scroll region is the pattern for keyboard access to scrollable content.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    caption: {
      description: 'Table caption, read as the table\'s name. Shown above the table unless `captionHidden` is set.',
    },
    captionHidden: {
      description: 'Hides the caption visually and keeps it for assistive technology.',
    },
    columns: {
      description: 'The columns: each has a `key`, a `header`, a `cell` function, and optional `numeric` and `rowHeader` flags.',
    },
    rows: {
      description: 'The data, one item per row.',
    },
    getRowKey: {
      description: 'Returns a unique string key for each row, used by React to track rows.',
    },
    emptyState: {
      description: 'Shown in a single row when there are no rows. Defaults to "Nothing to show yet."',
    },
    className: {
      description: 'Extra class name added to the table wrapper.',
    },
  },
} satisfies Meta<typeof Table<Expense>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRowHeader: Story = {
  args: {
    columns: [
      { key: 'note', header: 'Note', rowHeader: true, cell: (row) => row.note },
      { key: 'date', header: 'Date', cell: (row) => row.date },
      { key: 'category', header: 'Category', cell: (row) => row.category },
      { key: 'amount', header: 'Amount', numeric: true, cell: (row) => formatCents(row.cents) },
    ],
  },
};

export const HiddenCaption: Story = {
  args: { captionHidden: true },
};

export const Empty: Story = {
  args: { rows: [] },
};

export const CustomEmptyState: Story = {
  args: { rows: [], emptyState: <p>No expenses yet. Add your first one to get started.</p> },
};

export const WithRowAction: Story = {
  args: {
    columns: columnsWithAction,
  },
};

export const NarrowViewport: Story = {
  args: { columns: columnsWithAction },
  render: (args) => (
    <div style={{ width: '320px' }}>
      <Table {...args} />
    </div>
  ),
};
