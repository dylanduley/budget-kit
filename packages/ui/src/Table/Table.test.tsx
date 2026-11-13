import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import type { ReactElement } from 'react';

import { Table as TableFromIndex, type TableColumn, type TableProps } from '../index';
import { Table } from './Table';
import * as stories from './Table.stories';

interface Expense {
  id: string;
  date: string;
  category: string;
  note: string;
  cents: number;
}

const data: Expense[] = [
  { id: 'a', date: '2025-01-01', category: 'Food', note: 'Lunch', cents: 1250 },
  { id: 'b', date: '2025-01-02', category: 'Rent', note: 'January', cents: 120000 },
  { id: 'c', date: '2025-01-03', category: 'Fun', note: 'Movie', cents: 999 },
];

const columns: TableColumn<Expense>[] = [
  { key: 'date', header: 'Date', cell: (r) => r.date },
  { key: 'category', header: 'Category', cell: (r) => r.category },
  { key: 'note', header: 'Note', cell: (r) => r.note },
  { key: 'amount', header: 'Amount', numeric: true, cell: (r) => `$${(r.cents / 100).toFixed(2)}` },
];

function setup(props: Partial<TableProps<Expense>> = {}): ReactElement {
  return (
    <Table caption="Expenses" columns={columns} rows={data} getRowKey={(r) => r.id} {...props} />
  );
}

describe('Real <table> with <th scope>', () => {
  it('getByRole table with caption name finds a TABLE element', () => {
    render(setup());
    expect(screen.getByRole('table', { name: 'Expenses' }).tagName).toBe('TABLE');
  });

  it('every column produces a th scope=col columnheader with header text, in order', () => {
    render(setup());
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Date', 'Category', 'Note', 'Amount']);
    headers.forEach((h) => {
      expect(h.tagName).toBe('TH');
      expect(h).toHaveAttribute('scope', 'col');
    });
  });
});

describe('Caption required (can be visually hidden)', () => {
  it('omitting caption is a type error', () => {
    // @ts-expect-error caption is required
    const element = <Table columns={columns} rows={data} getRowKey={(r) => r.id} />;
    expect(element).toBeTruthy();
  });

  it('caption is the first child of the table and has the caption text', () => {
    render(setup());
    const table = screen.getByRole('table');
    expect(table.firstElementChild?.tagName).toBe('CAPTION');
    expect(table.firstElementChild).toHaveTextContent('Expenses');
  });

  it('captionHidden keeps caption in DOM with data-hidden=true and same accessible name', () => {
    render(setup({ captionHidden: true }));
    const table = screen.getByRole('table', { name: 'Expenses' });
    const caption = table.querySelector('caption');
    expect(caption).toHaveAttribute('data-hidden', 'true');
    expect(caption).toHaveTextContent('Expenses');
  });

  it('visible caption has no data-hidden=true', () => {
    render(setup());
    expect(screen.getByRole('table').querySelector('caption')).not.toHaveAttribute(
      'data-hidden',
      'true',
    );
  });

  it('hidden caption CSS rule does not use display:none or visibility:hidden', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/Table/Table.module.css'), 'utf8');
    const rules = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)].filter(
      ([, selector]) => selector?.includes('data-hidden') ?? false,
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule[2]).not.toMatch(/display\s*:\s*none/);
      expect(rule[2]).not.toMatch(/visibility\s*:\s*hidden/);
    }
  });
});

describe('Columns config and rows', () => {
  it('3 rows and 4 columns give 3 body rows of 4 cells each in order with cell(row) content', () => {
    render(setup());
    const table = screen.getByRole('table');
    const bodyRows = within(table.querySelector('tbody') as HTMLElement).getAllByRole('row');
    expect(bodyRows).toHaveLength(3);
    bodyRows.forEach((tr, i) => {
      const cells = within(tr).getAllByRole('cell');
      expect(cells).toHaveLength(4);
      const row = data[i] as Expense;
      expect(cells.map((c) => c.textContent)).toEqual([
        row.date,
        row.category,
        row.note,
        `$${(row.cents / 100).toFixed(2)}`,
      ]);
    });
  });

  it('renders ReactNode returned by cell, and columns in config order', () => {
    render(
      setup({
        columns: [
          { key: 'n', header: 'Note', cell: (r) => <strong>{r.note}</strong> },
          { key: 'd', header: 'Date', cell: (r) => r.date },
        ],
      }),
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Note', 'Date']);
    expect(screen.getByText('Lunch').tagName).toBe('STRONG');
  });
});

describe('rowHeader column', () => {
  it('renders body cells as th scope=row; others are td', () => {
    render(
      setup({
        columns: columns.map((c) => (c.key === 'date' ? { ...c, rowHeader: true } : c)),
      }),
    );
    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders).toHaveLength(3);
    rowHeaders.forEach((h) => {
      expect(h.tagName).toBe('TH');
      expect(h).toHaveAttribute('scope', 'row');
    });
    expect(rowHeaders.map((h) => h.textContent)).toEqual(data.map((d) => d.date));
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(9);
    cells.forEach((c) => expect(c.tagName).toBe('TD'));
  });

  it('without rowHeader there are no th scope=row cells', () => {
    render(setup());
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
  });
});

describe('Right-aligned numeric columns', () => {
  it('numeric column header and all body cells have data-numeric=true; others never do', () => {
    render(setup());
    const table = screen.getByRole('table');
    const numericHeader = screen.getByRole('columnheader', { name: 'Amount' });
    expect(numericHeader).toHaveAttribute('data-numeric', 'true');
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = tr.children;
      expect(cells[3]).toHaveAttribute('data-numeric', 'true');
      [0, 1, 2].forEach((i) => expect(cells[i]).not.toHaveAttribute('data-numeric'));
    });
    ['Date', 'Category', 'Note'].forEach((name) =>
      expect(screen.getByRole('columnheader', { name })).not.toHaveAttribute('data-numeric'),
    );
  });

  it('numeric rowHeader column also carries data-numeric', () => {
    render(
      setup({
        columns: [{ key: 'c', header: 'Cents', numeric: true, rowHeader: true, cell: (r) => r.cents }],
      }),
    );
    screen.getAllByRole('rowheader').forEach((h) => expect(h).toHaveAttribute('data-numeric', 'true'));
  });
});

describe('Optional empty state', () => {
  it('rows=[] keeps header row and one tbody row with one td colspan=columns and default text', () => {
    render(setup({ rows: [] }));
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    const tbody = screen.getByRole('table').querySelector('tbody') as HTMLElement;
    expect(tbody.querySelectorAll('tr')).toHaveLength(1);
    const cells = tbody.querySelectorAll('tr > *');
    expect(cells).toHaveLength(1);
    expect(cells[0]?.tagName).toBe('TD');
    expect(cells[0]).toHaveAttribute('colspan', '4');
    expect(cells[0]).toHaveTextContent('Nothing to show yet.');
    expect(cells[0]).toHaveAttribute('data-part', 'empty');
  });

  it('custom emptyState is shown instead of the default', () => {
    render(setup({ rows: [], emptyState: <p>No expenses yet</p> }));
    expect(screen.getByText('No expenses yet')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to show yet.')).not.toBeInTheDocument();
  });

  it('with rows no [data-part=empty] exists', () => {
    const { container } = render(setup());
    expect(container.querySelector('[data-part="empty"]')).toBeNull();
  });

  it('empty colspan follows a different column count', () => {
    render(setup({ rows: [], columns: columns.slice(0, 2) }));
    expect(screen.getByRole('table').querySelector('[data-part="empty"]')).toHaveAttribute(
      'colspan',
      '2',
    );
  });
});

describe('getRowKey used for React keys', () => {
  it('re-rendering with first row removed logs no console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(setup());
    rerender(setup({ rows: data.slice(1) }));
    expect(screen.getByText('January')).toBeInTheDocument();
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keys preserve DOM nodes of remaining rows when first row is removed', () => {
    const { rerender } = render(setup());
    const before = screen.getByText('January').closest('tr');
    rerender(setup({ rows: data.slice(1) }));
    expect(screen.getByText('January').closest('tr')).toBe(before);
  });
});

describe('Scroll wrapper', () => {
  it('has role=region, tabindex=0 and accessible name equal to the caption', () => {
    render(setup());
    const region = screen.getByRole('region', { name: 'Expenses' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toContainElement(screen.getByRole('table'));
  });

  it('region name still equals caption when caption is hidden', () => {
    render(setup({ captionHidden: true }));
    expect(screen.getByRole('region', { name: 'Expenses' })).toBeInTheDocument();
  });

  it('className is appended on the wrapper', () => {
    render(setup({ className: 'extra' }));
    expect(screen.getByRole('region')).toHaveClass('extra');
  });

  it('wrapper can be focused with Tab', async () => {
    const user = userEvent.setup();
    render(setup());
    await user.tab();
    expect(screen.getByRole('region')).toHaveFocus();
  });
});

describe('Table is generic', () => {
  it('cell: (row) => row.note type-checks and a missing property is a type error', () => {
    const ok: TableColumn<Expense> = { key: 'n', header: 'Note', cell: (row) => row.note };
    // @ts-expect-error property 'missing' does not exist on Expense
    const bad: TableColumn<Expense> = { key: 'm', header: 'M', cell: (row) => row.missing };
    expect(ok.cell(data[0] as Expense)).toBe('Lunch');
    expect(bad).toBeTruthy();
  });

  it('infers Row from props without a cast', () => {
    render(
      <Table
        caption="Inferred"
        rows={data}
        getRowKey={(r) => r.id}
        columns={[{ key: 'n', header: 'Note', cell: (r) => r.note }]}
      />,
    );
    expect(screen.getByText('Movie')).toBeInTheDocument();
  });
});

describe('Keyboard only: row actions', () => {
  it('Tab reaches wrapper then each row button in order and Enter activates it', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      setup({
        columns: [
          ...columns,
          {
            key: 'act',
            header: 'Actions',
            cell: (r) => (
              <button type="button" onClick={() => onDelete(r.id)}>
                Delete {r.note}
              </button>
            ),
          },
        ],
      }),
    );
    await user.tab();
    expect(screen.getByRole('region')).toHaveFocus();
    for (const row of data) {
      await user.tab();
      expect(screen.getByRole('button', { name: `Delete ${row.note}` })).toHaveFocus();
    }
    await user.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('c');
  });
});

describe('Every story listed exists under Components/Table', () => {
  it('story exports and title', () => {
    const names = [
      'Default',
      'WithRowHeader',
      'HiddenCaption',
      'Empty',
      'CustomEmptyState',
      'WithRowAction',
      'NarrowViewport',
    ];
    names.forEach((n) => expect(stories).toHaveProperty(n));
    expect(stories.default.title).toBe('Components/Table');
  });

  it('WithRowAction story renders native buttons named Delete <note>', () => {
    const { WithRowAction } = composeStories(stories);
    render(<WithRowAction />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
      expect(b.getAttribute('aria-label') ?? b.textContent).toMatch(/^Delete \S+/);
    });
  });

  it('Empty story shows the default empty text', () => {
    const { Empty } = composeStories(stories);
    render(<Empty />);
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });
});

describe('Importable from the package index', () => {
  it('Table is exported from index', () => {
    expect(TableFromIndex).toBe(Table);
  });
});
