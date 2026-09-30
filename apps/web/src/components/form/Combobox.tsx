'use client';

import * as React from 'react';

import type { Option } from '@/config/compound';
import { useTranslation } from '@/lib/i18n';

import { CONTROL_CLASS, controlBorder } from './Field';

/**
 * Searchable single-select following the WAI-ARIA combobox/listbox pattern.
 * Fully keyboard operable: type to filter, Up/Down to move, Enter to select,
 * Escape to close (focus stays on the input), Tab to leave.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  disabledHint,
  hasError,
  ariaDescribedBy,
  ariaRequired,
  labelFor,
}: {
  id: string;
  options: readonly Option<string>[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder: string;
  disabledHint: string;
  hasError: boolean;
  ariaDescribedBy?: string;
  ariaRequired?: boolean;
  /** 'en' | 'ar' — picks which label field to display. */
  labelFor: 'en' | 'ar';
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const labelOf = React.useCallback(
    (option: Option<string>) => (labelFor === 'ar' ? option.labelAr : option.labelEn),
    [labelFor],
  );

  const selected = options.find((option) => option.value === value);

  // While closed the input shows the selection; while open it shows what the
  // user is typing, so filtering never fights the displayed value.
  const filtered = React.useMemo(() => {
    if (!open || query === '') return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => labelOf(option).toLowerCase().includes(needle));
  }, [open, query, options, labelOf]);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Clamp during render rather than in an effect: filtering can shrink the
  // list below the stored index, and correcting that in an effect would render
  // one frame with an out-of-range aria-activedescendant pointing at nothing.
  const safeIndex = activeIndex < filtered.length ? activeIndex : 0;

  function commit(option: Option<string>) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((safeIndex + delta + filtered.length) % filtered.length);
      return;
    }

    if (event.key === 'Enter') {
      if (!open) return;
      // Only swallow Enter when it actually selects something, so it can still
      // submit the form otherwise.
      const option = filtered[safeIndex];
      if (option) {
        event.preventDefault();
        commit(option);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery('');
      }
      return;
    }

    if (event.key === 'Tab' && open) {
      setOpen(false);
      setQuery('');
    }
  }

  const listboxId = `${id}-listbox`;
  const activeId =
    open && filtered[safeIndex] ? `${id}-option-${filtered[safeIndex].value}` : undefined;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        disabled={disabled}
        // aria-expanded must reflect the real popup state for AT to announce it.
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={hasError}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        placeholder={disabled ? disabledHint : placeholder}
        value={open ? query : selected ? labelOf(selected) : ''}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`${CONTROL_CLASS} ${controlBorder(hasError)} pe-10`}
      />

      {/* Caret sits on the trailing edge, which mirrors automatically in RTL. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="m3 5 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {open && !disabled ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-gold-deep"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-[length:var(--text-body)] text-muted-foreground">
              {t('a11y.no_matches')}
            </li>
          ) : (
            filtered.map((option, index) => {
              const isActive = index === safeIndex;
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${id}-option-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  // onMouseDown, not onClick — the input's blur would otherwise
                  // close the list before the click landed.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commit(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-between px-4 text-[length:var(--text-body-lg)] ${
                    isActive ? 'bg-primary/15 text-foreground' : 'text-card-foreground'
                  }`}
                >
                  <span>{labelOf(option)}</span>
                  {isSelected ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="m3.5 8.5 3 3 6-7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      />
                    </svg>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
