'use client';

import { Moon, Sun } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/** Dark/light toggle. Dark is the flagship default; light is a user preference. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const goingDark = theme !== 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      // The accessible name states the ACTION, not the current state.
      aria-label={t(goingDark ? 'nav.toggle_theme_dark' : 'nav.toggle_theme_light')}
      className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-500 motion-reduce:transition-none"
    >
      {goingDark ? <Moon aria-hidden="true" size={19} /> : <Sun aria-hidden="true" size={19} />}
    </button>
  );
}
