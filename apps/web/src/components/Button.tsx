import Link from 'next/link';
import * as React from 'react';

import { PendingMark } from '@/components/PendingMark';

/**
 * Mirrors the mobile app's GoldButton (src/components/auth/gold-button.tsx):
 * filled  → gold bg, dark text (primary action)
 * outline → gold border, gold text (secondary)
 *
 * Gold is reserved for primary actions and active states — do not add a
 * decorative variant.
 */
type Variant = 'filled' | 'outline';

const BASE =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md px-6 text-[length:var(--text-body-lg)] font-semibold ' +
  'transition-[background-color,color,transform] duration-150 ease-[var(--ease-standard)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ' +
  'active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100';

const VARIANTS: Record<Variant, string> = {
  // primary-foreground flips with the theme, so the label stays readable on gold in both.
  filled: 'bg-primary text-primary-foreground hover:bg-gold-600',
  outline: 'border-[1.5px] border-primary bg-transparent text-primary hover:bg-primary/10',
};

type CommonProps = {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

function classesFor(variant: Variant, fullWidth: boolean, className: string) {
  return `${BASE} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`;
}

export function ButtonLink({
  href,
  variant = 'filled',
  fullWidth = false,
  className = '',
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={classesFor(variant, fullWidth, className)}>
      {children}
    </Link>
  );
}

export function Button({
  variant = 'filled',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isBusy = rest['aria-busy'] === true || rest['aria-busy'] === 'true';
  return (
    <button
      {...rest}
      className={`${classesFor(variant, fullWidth, className)} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {isBusy && <PendingMark />}
      {children}
    </button>
  );
}
