'use client';

import * as React from 'react';

/*
 * One shared floating tooltip (sample-4 `#tip`): elevated surface, gold border, multi-line text,
 * shown on hover, keyboard focus and tap, clamped to the viewport, hidden on leave / blur. Targets
 * carry `data-tip` (and stay focusable); a single delegated listener set serves every chart.
 */
const TIP_ID = 'finance-chart-tip';
let users = 0;
let tip: HTMLDivElement | null = null;
let described: Element | null = null;
let cleanup: (() => void) | null = null;

/** Props for a tooltip target. Newlines in `text` become lines. */
export function tipProps(text: string): { 'data-tip': string; tabIndex: 0 } {
  return { 'data-tip': text, tabIndex: 0 };
}

function hide() {
  if (tip) tip.style.opacity = '0';
  described?.removeAttribute('aria-describedby');
  described = null;
}

function show(e: Event) {
  const target = (e.target as Element | null)?.closest?.('[data-tip]') ?? null;
  if (!target || !tip) return hide();
  if (described && described !== target) described.removeAttribute('aria-describedby');
  described = target;
  target.setAttribute('aria-describedby', TIP_ID);
  tip.textContent = target.getAttribute('data-tip');
  tip.style.opacity = '1';
  const r = target.getBoundingClientRect();
  const m = e as MouseEvent;
  const x = typeof m.clientX === 'number' && m.clientX ? m.clientX : r.left + r.width / 2;
  const y = typeof m.clientY === 'number' && m.clientY ? m.clientY : r.top;
  tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, x - tip.offsetWidth / 2))}px`;
  tip.style.top = `${Math.max(8, y - tip.offsetHeight - 14)}px`;
}

function mount() {
  tip = document.createElement('div');
  tip.id = TIP_ID;
  tip.setAttribute('role', 'tooltip');
  Object.assign(tip.style, {
    position: 'fixed',
    zIndex: '100',
    pointerEvents: 'none',
    background: 'var(--color-muted)',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-foreground)',
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.28)',
    opacity: '0',
    maxWidth: '240px',
    whiteSpace: 'pre-line',
    top: '0',
    left: '0',
  });
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  tip.style.transition = calm ? 'none' : 'opacity 0.12s';
  document.body.appendChild(tip);
  const events: [string, EventListener][] = [
    ['mousemove', show],
    ['focusin', show],
    ['click', show],
    ['focusout', hide],
    ['scroll', hide],
  ];
  for (const [name, fn] of events) document.addEventListener(name, fn, true);
  document.documentElement.addEventListener('mouseleave', hide);
  cleanup = () => {
    for (const [name, fn] of events) document.removeEventListener(name, fn, true);
    document.documentElement.removeEventListener('mouseleave', hide);
    hide();
    tip?.remove();
    tip = null;
  };
}

/** Call once per chart component: mounts the shared tooltip while any chart is on screen. */
export function useChartTooltip(): void {
  React.useEffect(() => {
    if (users++ === 0) mount();
    return () => {
      if (--users === 0) cleanup?.();
    };
  }, []);
}
