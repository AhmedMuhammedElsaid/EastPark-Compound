'use client';

import * as React from 'react';

import { translate } from './resolve';
import { DEFAULT_LANG, translations } from './translations';
import type { TranslationKey, TranslationVars } from './types';
import type { Lang } from './translations';

const STORAGE_KEY = 'eastpark-lang';

type Dir = 'rtl' | 'ltr';

type LanguageContextValue = {
  lang: Lang;
  dir: Dir;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey | string, vars?: TranslationVars) => string;
};

const LanguageContext = React.createContext<LanguageContextValue | undefined>(undefined);

function dirForLang(lang: Lang): Dir {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

function readStoredLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'ar' ? stored : null;
  } catch {
    return null;
  }
}

function applyDocumentAttrs(lang: Lang, dir: Dir): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

/** Module-level store so every subscriber sees one source of truth. */
let currentLang: Lang | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Lang {
  currentLang ??= readStoredLang() ?? DEFAULT_LANG;
  return currentLang;
}

/**
 * Server (and hydration) snapshot — always the default. The SSR markup and the
 * hydrating client markup must agree; React re-reads getSnapshot right after
 * hydration, so a stored language applies a tick later. Reading localStorage
 * in a lazy useState initializer instead would render different text on the
 * client than the server sent, which is a hydration mismatch.
 */
function getServerSnapshot(): Lang {
  return DEFAULT_LANG;
}

function emit(next: Lang): void {
  currentLang = next;
  for (const listener of listeners) listener();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = React.useCallback((next: Lang) => {
    emit(next);
    applyDocumentAttrs(next, dirForLang(next));
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore write failures (private browsing, quota, etc.)
      }
    }
  }, []);

  React.useEffect(() => {
    applyDocumentAttrs(lang, dirForLang(lang));
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore write failures (private browsing, quota, etc.)
    }
  }, [lang]);

  const dir = dirForLang(lang);

  const t = React.useCallback(
    (key: TranslationKey | string, vars?: TranslationVars) =>
      translate(translations[lang], key, vars),
    [lang],
  );

  const value = React.useMemo<LanguageContextValue>(
    () => ({ lang, dir, setLang, t }),
    [lang, dir, setLang, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
