import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactElement, type ReactNode } from 'react';

import { NavBar, type NavBarItem, type NavBarLinkProps } from '../index';

const items: NavBarItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/spending', label: 'Spending' },
  { href: '/plan', label: 'Plan' },
  { href: '/history', label: 'History' },
];

describe('NavBar', () => {
  describe('structure: nav landmark, list, links in order', () => {
    it('finds the nav named by label', () => {
      render(<NavBar label="Main" items={items} currentHref={null} />);
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    });

    it('contains a list with one listitem per item and four links in order with hrefs', () => {
      render(<NavBar label="Main" items={items} currentHref={null} />);
      const nav = screen.getByRole('navigation', { name: 'Main' });
      const list = within(nav).getByRole('list');
      expect(list.tagName).toBe('UL');
      expect(list).toHaveAttribute('role', 'list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(4);
      const links = within(nav).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Spending', 'Plan', 'History']);
      expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/spending', '/plan', '/history']);
      links.forEach((link) => expect(link.parentElement?.tagName).toBe('LI'));
    });

    it('follows items order, not alphabetical or href order', () => {
      render(<NavBar label="Main" items={[...items].reverse()} currentHref={null} />);
      expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual([
        'History',
        'Plan',
        'Spending',
        'Overview',
      ]);
    });

    it('label cannot be overridden by an aria-label prop', () => {
      const props = { 'aria-label': 'Other' } as unknown as Record<string, unknown>;
      render(<NavBar label="Main" items={items} currentHref={null} {...props} />);
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Other' })).not.toBeInTheDocument();
    });

    it('empty items renders an empty list without crashing', () => {
      render(<NavBar label="Main" items={[]} currentHref="/" />);
      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(within(nav).getByRole('list')).toBeEmptyDOMElement();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
  });

  describe('current page marking', () => {
    it('marks only the exact-href link with aria-current and data-current', () => {
      render(<NavBar label="Main" items={items} currentHref="/plan" />);
      const plan = screen.getByRole('link', { name: 'Plan' });
      expect(plan).toHaveAttribute('aria-current', 'page');
      expect(plan).toHaveAttribute('data-current', 'true');
      for (const name of ['Overview', 'Spending', 'History']) {
        const link = screen.getByRole('link', { name });
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).not.toHaveAttribute('data-current');
      }
    });

    it('marks the first and last item too', () => {
      const { rerender } = render(<NavBar label="Main" items={items} currentHref="/" />);
      expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
      rerender(<NavBar label="Main" items={items} currentHref="/history" />);
      expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    });

    it('currentHref null marks no link', () => {
      render(<NavBar label="Main" items={items} currentHref={null} />);
      for (const link of screen.getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).not.toHaveAttribute('data-current');
      }
    });

    it('a currentHref that merely extends an item href (/plans) marks no link', () => {
      render(<NavBar label="Main" items={items} currentHref="/plans" />);
      for (const link of screen.getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).not.toHaveAttribute('data-current');
      }
    });

    it('an item whose href merely starts with another item href is not current ("/" and "/spending" with current "/")', () => {
      render(<NavBar label="Main" items={items} currentHref="/" />);
      expect(screen.getAllByRole('link').filter((l) => l.hasAttribute('aria-current'))).toHaveLength(1);
      expect(screen.getByRole('link', { name: 'Spending' })).not.toHaveAttribute('data-current');
    });

    it('a longer item href is not current when currentHref is its prefix', () => {
      render(<NavBar label="Main" items={items} currentHref="/spend" />);
      expect(screen.getByRole('link', { name: 'Spending' })).not.toHaveAttribute('aria-current');
    });

    it('never renders aria-current="false"', () => {
      render(<NavBar label="Main" items={items} currentHref="/plan" />);
      expect(document.querySelectorAll('[aria-current="false"]')).toHaveLength(0);
    });

    it('marks both items when two share the same href', () => {
      render(
        <NavBar
          label="Main"
          items={[
            { href: '/a', label: 'One' },
            { href: '/a', label: 'Two' },
            { href: '/b', label: 'Three' },
          ]}
          currentHref="/a"
        />,
      );
      expect(screen.getByRole('link', { name: 'One' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Two' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Three' })).not.toHaveAttribute('aria-current');
    });
  });

  describe('default link is a plain anchor', () => {
    it('renders <a> elements with the given href', () => {
      render(<NavBar label="Main" items={items} currentHref="/" />);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(4);
      links.forEach((l, i) => {
        expect(l.tagName).toBe('A');
        expect(l).toHaveAttribute('href', items[i]?.href);
      });
    });
  });

  describe('custom linkComponent', () => {
    it('is rendered once per item with exactly href, className, children (and current attrs for the current item)', () => {
      const received: Array<Record<string, unknown>> = [];
      function Custom(props: NavBarLinkProps): ReactElement {
        received.push({ ...props });
        return <span data-testid="custom">{props.children}</span>;
      }
      const { container } = render(<NavBar label="Main" items={items} currentHref="/plan" linkComponent={Custom} />);

      expect(screen.getAllByTestId('custom')).toHaveLength(4);
      expect(container.querySelector('a')).toBeNull();
      // Strict mode / re-render safety: only inspect the last render per item.
      const last = items.map((item) => [...received].reverse().find((p) => p.href === item.href));
      last.forEach((props, i) => {
        expect(props).toBeDefined();
        const item = items[i];
        expect(props?.href).toBe(item?.href);
        expect(props?.children).toBe(item?.label);
        expect(typeof props?.className).toBe('string');
        if (item?.href === '/plan') {
          expect(Object.keys(props ?? {}).sort()).toEqual(
            ['aria-current', 'children', 'className', 'data-current', 'href'].sort(),
          );
          expect(props?.['aria-current']).toBe('page');
          expect(props?.['data-current']).toBe('true');
        } else {
          expect(Object.keys(props ?? {}).sort()).toEqual(['children', 'className', 'href']);
        }
      });
    });

    it('receives no current attributes at all when currentHref is null', () => {
      const received: Array<Record<string, unknown>> = [];
      function Custom(props: NavBarLinkProps): ReactElement {
        received.push({ ...props });
        return <a {...props} data-router="custom">{props.children}</a>;
      }
      render(<NavBar label="Main" items={items} currentHref={null} linkComponent={Custom} />);
      expect(received.length).toBeGreaterThanOrEqual(4);
      received.forEach((p) => {
        expect('aria-current' in p).toBe(false);
        expect('data-current' in p).toBe(false);
      });
      expect(screen.getAllByRole('link')).toHaveLength(4);
    });

    it('type test: a next/link shaped component is accepted without a cast', () => {
      type LinkShape = {
        href: string;
        className?: string;
        'aria-current'?: 'page' | 'step' | boolean;
        children?: ReactNode;
        prefetch?: boolean;
      };
      const NextLike = (props: LinkShape): ReactElement => <a href={props.href}>{props.children}</a>;
      render(<NavBar label="Main" items={items} currentHref="/" linkComponent={NextLike} />);
      expect(screen.getAllByRole('link')).toHaveLength(4);
    });
  });

  describe('className, native props and ref', () => {
    it('appends className to the nav alongside the component class', () => {
      render(<NavBar label="Main" items={items} currentHref={null} className="x" />);
      const nav = screen.getByRole('navigation', { name: 'Main' });
      const tokens = nav.className.split(/\s+/).filter(Boolean);
      expect(tokens).toContain('x');
      expect(tokens.length).toBeGreaterThan(1);
    });

    it('passes data-testid and id to the nav', () => {
      render(<NavBar label="Main" items={items} currentHref={null} data-testid="nb" id="main-nav" />);
      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(screen.getByTestId('nb')).toBe(nav);
      expect(nav).toHaveAttribute('id', 'main-nav');
    });

    it('forwards ref to the nav element', () => {
      const ref = createRef<HTMLElement>();
      render(<NavBar label="Main" items={items} currentHref={null} ref={ref} />);
      expect(ref.current).toBe(screen.getByRole('navigation', { name: 'Main' }));
    });
  });

  describe('keyboard', () => {
    it('Tab visits the links in order and then leaves the nav', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button>before</button>
          <NavBar label="Main" items={items} currentHref="/plan" />
          <button>after</button>
        </>,
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
      for (const item of items) {
        await user.tab();
        expect(screen.getByRole('link', { name: item.label })).toHaveFocus();
      }
      await user.tab();
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    });
  });
});
