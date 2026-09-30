'use client';

import { useTranslation } from '@/lib/i18n';

/** Arabic ⇄ English. Arabic is primary; switching also flips the document dir. */
export function LanguageToggle() {
  const { lang, setLang, t } = useTranslation();
  const next = lang === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      // The label is always in the CURRENT language, describing the action.
      aria-label={t('nav.toggle_language')}
      // lang attr so a screen reader pronounces the target language correctly.
      lang={next}
      className="flex size-11 items-center justify-center text-[length:var(--text-label)] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-500 motion-reduce:transition-none"
    >
      {next === 'en' ? 'En' : 'ع'}
    </button>
  );
}
