import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { Card as CardFromIndex, type CardProps } from '../index';
import { Card } from './Card';

describe('Card', () => {
  it('Title: renders an h2 by default, found by role and name', () => {
    render(<Card title="Budget">body</Card>);
    expect(screen.getByRole('heading', { level: 2, name: 'Budget' })).toBeInTheDocument();
  });

  it.each([3, 4] as const)('Title: headingLevel={%i} renders that level', (level) => {
    render(
      <Card title="Budget" headingLevel={level}>
        body
      </Card>,
    );
    expect(screen.getByRole('heading', { level, name: 'Budget' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('Root: is a <section> exposed as a region named by the title', () => {
    render(<Card title="Budget">body</Card>);
    const region = screen.getByRole('region', { name: 'Budget' });
    expect(region.tagName).toBe('SECTION');
  });

  it('Root: region name follows the title for each heading level', () => {
    render(
      <Card title="Level four" headingLevel={4}>
        body
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Level four' })).toBeInTheDocument();
  });

  it('Description: rendered in [data-part="description"] when set', () => {
    const { container } = render(
      <Card title="Budget" description="Planned spending">
        body
      </Card>,
    );
    const el = container.querySelector('[data-part="description"]');
    expect(el).not.toBeNull();
    expect(el).toHaveTextContent('Planned spending');
    expect(el?.tagName).toBe('P');
  });

  it('Description: element is absent without description', () => {
    const { container } = render(<Card title="Budget">body</Card>);
    expect(container.querySelector('[data-part="description"]')).toBeNull();
  });

  it('Description: element is absent for an empty string', () => {
    const { container } = render(
      <Card title="Budget" description="">
        body
      </Card>,
    );
    expect(container.querySelector('[data-part="description"]')).toBeNull();
  });

  it('Action: button is rendered inside [data-part="action"]', () => {
    const { container } = render(
      <Card title="Budget" action={<button type="button">Edit</button>}>
        body
      </Card>,
    );
    const wrapper = container.querySelector<HTMLElement>('[data-part="action"]');
    expect(wrapper).not.toBeNull();
    expect(within(wrapper as HTMLElement).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('Action: element is absent without action', () => {
    const { container } = render(<Card title="Budget">body</Card>);
    expect(container.querySelector('[data-part="action"]')).toBeNull();
  });

  it('Body: children are rendered inside [data-part="body"]', () => {
    const { container } = render(
      <Card title="Budget">
        <p>Body text</p>
      </Card>,
    );
    const body = container.querySelector<HTMLElement>('[data-part="body"]');
    expect(body).not.toBeNull();
    expect(within(body as HTMLElement).getByText('Body text')).toBeInTheDocument();
  });

  it('DOM order: title, description, action, body', () => {
    const { container } = render(
      <Card title="Budget" description="Desc" action={<button type="button">Edit</button>}>
        body
      </Card>,
    );
    const heading = screen.getByRole('heading');
    const desc = container.querySelector('[data-part="description"]') as HTMLElement;
    const action = container.querySelector('[data-part="action"]') as HTMLElement;
    const body = container.querySelector('[data-part="body"]') as HTMLElement;
    const before = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(heading, desc)).toBe(true);
    expect(before(desc, action)).toBe(true);
    expect(before(action, body)).toBe(true);
  });

  it('DOM order: first Tab focuses the action, second the body button', async () => {
    const user = userEvent.setup();
    render(
      <Card title="Budget" action={<button type="button">Edit</button>}>
        <button type="button">Body button</button>
      </Card>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Body button' })).toHaveFocus();
  });

  it('Keyboard: the Card adds no tab stop of its own', async () => {
    const user = userEvent.setup();
    render(<Card title="Budget">plain text</Card>);
    const region = screen.getByRole('region', { name: 'Budget' });
    expect(region).not.toHaveAttribute('tabindex');
    await user.tab();
    expect(region).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('Ids: two Cards on one page have different title ids', () => {
    render(
      <>
        <Card title="One">a</Card>
        <Card title="Two">b</Card>
      </>,
    );
    const one = screen.getByRole('heading', { name: 'One' }).id;
    const two = screen.getByRole('heading', { name: 'Two' }).id;
    expect(one).not.toBe('');
    expect(two).not.toBe('');
    expect(one).not.toBe(two);
    expect(screen.getByRole('region', { name: 'One' })).toHaveAttribute('aria-labelledby', one);
    expect(screen.getByRole('region', { name: 'Two' })).toHaveAttribute('aria-labelledby', two);
  });

  it('Ids: two Cards with the same title still get distinct ids', () => {
    render(
      <>
        <Card title="Same">a</Card>
        <Card title="Same">b</Card>
      </>,
    );
    const ids = screen.getAllByRole('heading', { name: 'Same' }).map((h) => h.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('className: is appended and native props reach the <section>', () => {
    render(
      <Card title="Budget" className="extra" id="my-card" data-testid="card">
        body
      </Card>,
    );
    const region = screen.getByRole('region', { name: 'Budget' });
    expect(region).toHaveClass('extra');
    expect(region.className.trim().split(/\s+/).length).toBeGreaterThan(1);
    expect(region).toHaveAttribute('id', 'my-card');
    expect(region).toHaveAttribute('data-testid', 'card');
  });

  it('className: own class is kept when no className is given', () => {
    render(<Card title="Budget">body</Card>);
    expect(screen.getByRole('region', { name: 'Budget' }).className).not.toBe('');
  });

  it('ref: is forwarded to the <section> (ref-as-prop)', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Card title="Budget" ref={ref}>
        body
      </Card>,
    );
    expect(ref.current).toBe(screen.getByRole('region', { name: 'Budget' }));
  });

  it('Types: title and children are required; Card is exported from the package index', () => {
    // @ts-expect-error title is required
    const missingTitle = <Card>body</Card>;
    // @ts-expect-error children is required
    const missingChildren = <Card title="x" />;
    const badLevel = (
      // @ts-expect-error headingLevel only allows 2 | 3 | 4
      <Card title="x" headingLevel={5}>
        b
      </Card>
    );
    const props: CardProps = { title: 'x', children: 'y' };
    expect(props.title).toBe('x');
    expect(CardFromIndex).toBe(Card);
    expect([missingTitle, missingChildren, badLevel]).toHaveLength(3);
  });
});
