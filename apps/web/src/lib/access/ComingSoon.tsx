'use client';

import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { isRestrictedRole } from '@/config/access-policy';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';

type ComingSoonContextValue = {
  /** True when the signed-in user is confined to /home by the access policy. */
  restricted: boolean;
  open: (trigger?: HTMLElement | null, opts?: { feature?: ComingSoonFeature }) => void;
};

export type ComingSoonFeature = 'market' | 'governance' | 'community';

/** Maps a destination path to the feature whose popup copy should be shown. */
export function featureForHref(href: string): ComingSoonFeature | undefined {
  if (/^\/(directory|cart|checkout|orders)(\/|$)/.test(href)) return 'market';
  if (/^\/governance(\/|$)/.test(href)) return 'governance';
  if (/^\/(announcements|reports)(\/|$)/.test(href)) return 'community';
  return undefined;
}

const ComingSoonContext = React.createContext<ComingSoonContextValue>({
  restricted: false,
  open: () => undefined,
});

export function useComingSoon(): ComingSoonContextValue {
  return React.useContext(ComingSoonContext);
}

const EXIT_MS = 180;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ComingSoonProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const restricted = isRestrictedRole(user?.role);
  const [visible, setVisible] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [feature, setFeature] = React.useState<ComingSoonFeature | undefined>(undefined);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const open = React.useCallback((trigger?: HTMLElement | null, opts?: { feature?: ComingSoonFeature }) => {
    triggerRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    setFeature(opts?.feature);
    setClosing(false);
    setVisible(true);
  }, []);

  const close = React.useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      triggerRef.current?.focus();
    }, EXIT_MS);
  }, []);

  const value = React.useMemo(() => ({ restricted, open }), [restricted, open]);

  return (
    <ComingSoonContext.Provider value={value}>
      {children}
      {visible && createPortal(<ComingSoonDialog closing={closing} feature={feature} onClose={close} />, document.body)}
    </ComingSoonContext.Provider>
  );
}

function ComingSoonDialog({
  closing,
  feature,
  onClose,
}: {
  closing: boolean;
  feature?: ComingSoonFeature;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    buttonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Make the rest of the page inert (no focus, no pointer, hidden from AT) while the modal is open.
    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === backdropRef.current || child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      inerted.push(child);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const child of inerted) child.removeAttribute('inert');
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={backdropRef}
      className="coming-soon-backdrop fixed inset-0 z-[100] flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center"
      data-closing={closing || undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
        aria-describedby="coming-soon-body"
        className="coming-soon-panel w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-2xl sm:p-8"
      >
        <div className="relative mx-auto size-20" aria-hidden="true">
          <div className="absolute inset-[12%] rounded-full bg-gold-500/15 blur-xl" />
          <Image src="/eastpark-mark.png" alt="" fill sizes="80px" className="object-contain" />
        </div>
        <h2 id="coming-soon-title" className="mt-4 text-[length:var(--text-h2)] font-bold text-foreground">
          {t('access.coming_soon_title')}
        </h2>
        <p id="coming-soon-body" className="mt-2 text-[length:var(--text-body)] leading-7 text-muted-foreground">
          {feature ? t(`home.teaser.popup_${feature}`) : t('access.coming_soon_body')}
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          {t('access.coming_soon_dismiss')}
        </button>
      </div>
    </div>
  );
}

type GatedLinkProps = Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string };

/**
 * Drop-in for next/link. For restricted users every destination except /home
 * becomes a real button that opens the Coming soon popup instead of navigating.
 */
export function GatedLink({ href, children, onClick, prefetch, ...rest }: GatedLinkProps) {
  const { restricted, open } = useComingSoon();
  if (restricted && href !== '/home') {
    // A button is not a page link, so aria-current is deliberately dropped; only button-safe props pass through.
    const { className, id, title, lang, dir, style, tabIndex } = rest;
    const ariaLabel = rest['aria-label'];
    const dataProps = Object.fromEntries(Object.entries(rest).filter(([key]) => key.startsWith('data-')));
    return (
      <button
        {...dataProps}
        id={id}
        title={title}
        lang={lang}
        dir={dir}
        style={style}
        tabIndex={tabIndex}
        type="button"
        className={`${className ?? ''} cursor-pointer text-start`}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onClick={(event) => {
          // Chain the caller's handler (typed for anchors) first; honour preventDefault.
          onClick?.(event as unknown as React.MouseEvent<HTMLAnchorElement>);
          if (event.defaultPrevented) return;
          open(event.currentTarget, { feature: featureForHref(href) });
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={href} prefetch={prefetch} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
