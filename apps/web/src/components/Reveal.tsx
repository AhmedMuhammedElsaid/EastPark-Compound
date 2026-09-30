'use client';

import * as React from 'react';

/**
 * Fade-and-rise on scroll into view, once.
 *
 * Two safety rules baked in, both required by the design spec:
 *  1. NO-JS: the hidden state is applied only after mount, so with JavaScript
 *     disabled the content renders plainly visible instead of a blank page.
 *  2. REDUCED MOTION: checked before arming the observer — a user who asked for
 *     no motion gets the content immediately, with no transform or transition.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = '',
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Derived during render, not in an effect: on the server and on the very
  // first client render this is false, so the markup is always the visible
  // variant. That IS rule 1 — no JS, no hidden content — and it also keeps
  // hydration output identical on both sides.
  const [armed, setArmed] = React.useState(false);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const node = ref.current;

    // Nothing to animate: leave `armed` false so the content simply stays visible.
    if (reduced || !node) return;

    // Arm and observe in the same tick. React batches these, so the element
    // goes hidden and the observer attaches in one commit rather than two.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );

    const raf = requestAnimationFrame(() => {
      setArmed(true);
      observer.observe(node);
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const hidden = armed && !shown;

  return (
    <div
      ref={ref}
      style={{ transitionDelay: hidden ? undefined : `${delayMs}ms` }}
      className={`transition-[opacity,transform] duration-500 ease-[var(--ease-standard)] motion-reduce:transition-none ${
        hidden ? 'translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
      } ${className}`}
    >
      {children}
    </div>
  );
}
