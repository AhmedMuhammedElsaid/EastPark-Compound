'use client';

import * as React from 'react';

const STORAGE_KEY = 'eastpark-theme';

export type ThemeMode = 'dark' | 'light';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function applyDocumentClass(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('light', theme === 'light');
}

/**
 * Dark is the flagship default. Light is an explicit user opt-in, toggled via
 * the `.light` class on `<html>` (see globals.css). The inline script in the
 * root layout applies the persisted class before hydration to avoid a flash
 * of the wrong theme; this provider keeps React state in sync afterwards.
 */
/** Module-level store so every subscriber sees one source of truth. */
let currentTheme: ThemeMode | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemeMode {
  currentTheme ??= readStoredTheme() ?? 'dark';
  return currentTheme;
}

/**
 * Server (and hydration) snapshot. Always 'dark' so the SSR markup and the
 * hydrating client markup agree; React re-reads getSnapshot immediately after
 * hydration, at which point a stored 'light' takes effect. Reading storage in
 * a lazy useState initializer instead would desync the toggle's label from the
 * server HTML and produce a hydration mismatch.
 */
function getServerSnapshot(): ThemeMode {
  return 'dark';
}

function emit(next: ThemeMode): void {
  currentTheme = next;
  for (const listener of listeners) listener();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = React.useCallback((next: ThemeMode) => {
    emit(next);
    applyDocumentClass(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore write failures
      }
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  React.useEffect(() => {
    applyDocumentClass(theme);
  }, [theme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
