import type { ComponentPropsWithRef, ComponentType, ReactElement, ReactNode } from 'react';
import styles from './NavBar.module.css';

export interface NavBarItem {
  href: string;
  label: string;
}

// What the link component receives. A plain <a> satisfies it; so does next/link's Link.
export interface NavBarLinkProps {
  href: string;
  className: string;
  'aria-current'?: 'page';
  'data-current'?: 'true';
  children: ReactNode;
}

export interface NavBarProps extends Omit<ComponentPropsWithRef<'nav'>, 'children' | 'aria-label'> {
  label: string;
  items: readonly NavBarItem[];
  currentHref: string | null;
  linkComponent?: ComponentType<NavBarLinkProps>;
}

function DefaultLink({ children, ...props }: NavBarLinkProps) {
  return <a {...props}>{children}</a>;
}

export function NavBar({
  label,
  items,
  currentHref,
  linkComponent: Link = DefaultLink,
  className,
  ...rest
}: NavBarProps): ReactElement {
  // CSS module keys are typed string | undefined under noUncheckedIndexedAccess
  const linkClass = styles.link ?? '';
  return (
    <nav {...rest} aria-label={label} className={className ? `${styles.nav} ${className}` : styles.nav}>
      {/* role="list" restores list semantics in VoiceOver when list-style is none */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ul role="list" className={styles.list}>
        {items.map((item) => {
          const isCurrent = item.href === currentHref;
          return (
            <li key={item.href} className={styles.item}>
              {isCurrent ? (
                <Link href={item.href} className={linkClass} aria-current="page" data-current="true">
                  {item.label}
                </Link>
              ) : (
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
