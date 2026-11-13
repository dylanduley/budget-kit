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
