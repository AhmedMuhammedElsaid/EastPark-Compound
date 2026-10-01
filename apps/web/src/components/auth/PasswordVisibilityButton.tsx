'use client';

import { Eye, EyeOff } from 'lucide-react';

export function PasswordVisibilityButton({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  const Icon = visible ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      title={label}
      className="absolute inset-y-0 end-0 flex min-h-12 min-w-12 items-center justify-center rounded-e-md text-muted-foreground transition-colors hover:text-primary focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-500 motion-reduce:transition-none"
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}