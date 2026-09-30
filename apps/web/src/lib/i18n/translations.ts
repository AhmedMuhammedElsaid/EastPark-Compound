import en from '@/translations/en.json';
import ar from '@/translations/ar.json';

export type Lang = 'en' | 'ar';

export const translations = { en, ar } as const;

export const DEFAULT_LANG: Lang = 'ar';
