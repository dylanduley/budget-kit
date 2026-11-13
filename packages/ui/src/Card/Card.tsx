import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  children: ReactNode;
}

export function Card({
  title,
  description,
  action,
  headingLevel = 2,
  children,
  className,
  ...rest
}: CardProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      {...rest}
      aria-labelledby={titleId}
      className={className ? `${styles.card} ${className}` : styles.card}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <Heading id={titleId} className={styles.title}>
            {title}
          </Heading>
          {description ? (
            <p data-part="description" className={styles.description}>
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div data-part="action" className={styles.action}>
            {action}
          </div>
        ) : null}
      </header>
      <div data-part="body" className={styles.body}>
        {children}
      </div>
    </section>
  );
}
