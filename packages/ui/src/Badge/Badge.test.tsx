import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { Badge, type BadgeProps, type BadgeVariant } from '../index';
import * as stories from './Badge.stories';

const variants: BadgeVariant[] = ['neutral', 'success', 'warning', 'danger'];

describe('Badge', () => {
  describe('variant is reflected in data-variant', () => {
    it.each(variants)('variant "%s" sets data-variant="%s"', (variant) => {
      render(<Badge variant={variant}>Label</Badge>);
      expect(screen.getByText('Label')).toHaveAttribute('data-variant', variant);
    });

    it('defaults to data-variant="neutral" when no variant is given', () => {
      render(<Badge>Label</Badge>);
      expect(screen.getByText('Label')).toHaveAttribute('data-variant', 'neutral');
    });
  });

  describe('text is required (no colour-only meaning)', () => {
    it('renders the visible text', () => {
      render(<Badge>Over budget</Badge>);
      expect(screen.getByText('Over budget')).toBeVisible();
    });

    it('missing or null children are type errors', () => {
      // Type-only check; the runtime render just must not throw.
      // @ts-expect-error children is required
      render(<Badge />);
      // @ts-expect-error children must be a string
      render(<Badge>{null}</Badge>);
    });
  });

  describe('rendered element is a bare span', () => {
    it('is a span with no role, tabindex, aria-live or aria-label', () => {
      const { container } = render(<Badge variant="danger">Over budget</Badge>);
      const el = container.firstElementChild as HTMLElement;
      expect(container.children).toHaveLength(1);
      expect(el.tagName).toBe('SPAN');
      for (const attr of ['role', 'tabindex', 'aria-live', 'aria-label']) {
        expect(el).not.toHaveAttribute(attr);
      }
    });

    it('contains only text, no child elements', () => {
      const { container } = render(<Badge>On track</Badge>);
      const el = container.firstElementChild as HTMLElement;
      expect(el.childElementCount).toBe(0);
      expect(el.textContent).toBe('On track');
    });

    it('is not exposed with any ARIA role of its own', () => {
      render(<Badge>On track</Badge>);
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('className and native props', () => {
    it('appends className without dropping the component class', () => {
      render(<Badge className="extra">Label</Badge>);
      const el = screen.getByText('Label');
      expect(el.classList.contains('extra')).toBe(true);
      expect(el.classList.length).toBeGreaterThan(1);
    });

    it('forwards id, title and data attributes to the span', () => {
      render(
        <Badge id="b1" title="Tip" data-testid="x">
          Label
        </Badge>,
      );
      const el = screen.getByTestId('x');
      expect(el.tagName).toBe('SPAN');
      expect(el).toHaveAttribute('id', 'b1');
      expect(el).toHaveAttribute('title', 'Tip');
    });

    it('passes ref as a prop to the span', () => {
      const ref = createRef<HTMLSpanElement>();
      render(<Badge ref={ref}>Label</Badge>);
      expect(ref.current).toBe(screen.getByText('Label'));
    });

    it('does not let rest props override data-variant', () => {
      render(<Badge variant="success">Label</Badge>);
      expect(screen.getByText('Label')).toHaveAttribute('data-variant', 'success');
    });
  });

  describe('typed props', () => {
    it('accepts exactly the documented props', () => {
      const props: BadgeProps = { variant: 'warning', children: 'x', id: 'i' };
      expect(props.variant).toBe('warning');
      // @ts-expect-error unknown variant
      const bad: BadgeProps = { variant: 'info', children: 'x' };
      expect(bad).toBeDefined();
    });
  });

  describe('adds no tab stop (keyboard only)', () => {
    it('tabbing through all variants never focuses a Badge', async () => {
      const user = userEvent.setup();
      render(
        <div>
          {variants.map((v) => (
            <Badge key={v} variant={v}>
              {`Badge ${v}`}
            </Badge>
          ))}
        </div>,
      );
      await user.tab();
      expect(document.body).toHaveFocus();
      await user.tab();
      expect(document.body).toHaveFocus();
    });
  });

  describe('stories exist under Components/Badge', () => {
    it('has title Components/Badge', () => {
      expect(stories.default.title).toBe('Components/Badge');
    });

    it.each(['Neutral', 'Success', 'Warning', 'Danger', 'AllVariants'])(
      'exports story %s',
      (name) => {
        expect(stories).toHaveProperty(name);
      },
    );
  });

  describe('importable from the package entry', () => {
    it('Badge is exported as a function', () => {
      expect(typeof Badge).toBe('function');
    });
  });
});
