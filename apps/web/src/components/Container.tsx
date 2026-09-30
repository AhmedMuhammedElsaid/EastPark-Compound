import * as React from 'react';

/**
 * Page-width wrapper. One place to change the measure so bands can never drift
 * out of alignment with each other.
 */
export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1120px] px-5 sm:px-8 ${className}`}>{children}</div>
  );
}
