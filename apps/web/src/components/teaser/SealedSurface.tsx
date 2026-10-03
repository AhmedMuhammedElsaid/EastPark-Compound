import type { ReactNode } from 'react';

import { GatedLink } from '@/lib/access/ComingSoon';

/**
 * The outer element of a sealed teaser card. With `href` it is a `GatedLink` (signed-in residents get
 * the Coming soon dialog); with `href={null}` (public landing) it is a plain article — visitors have
 * nowhere to go yet — and its hint stays visible because there is no hover/focus to reveal it.
 */
export function SealedSurface({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <GatedLink href={href} className={`sealed-card ${className}`}>
        {children}
      </GatedLink>
    );
  }
  return <article className={`sealed-card sealed-card--static ${className}`}>{children}</article>;
}
