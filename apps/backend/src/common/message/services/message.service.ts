import { Injectable } from '@nestjs/common';

interface TranslateOptions {
    defaultValue?: string;
    args?: Record<string, unknown>;
}

/**
 * Minimal MessageService — pass-through for Phase 1.
 * Returns the key itself (or defaultValue) without i18n.
 * Replace with a real i18n implementation in Phase 7 (Polish).
 */
@Injectable()
export class MessageService {
    translate(key: string, options?: TranslateOptions): string {
        return options?.defaultValue ?? key;
    }

    translateKey(
        parts: (string | number)[],
        options?: TranslateOptions
    ): string {
        return this.translate(parts.join('.'), options);
    }

    translateBulk(
        items: Array<{ key: string; defaultValue?: string }>,
        _lang?: string
    ): string[] {
        return items.map(item =>
            this.translate(item.key, { defaultValue: item.defaultValue })
        );
    }

    getCurrentLanguage(): string {
        return 'en';
    }
}
