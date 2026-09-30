/**
 * The logo's gold diamond. Decorative — the wordmark beside it carries the
 * accessible name, so this is hidden from assistive tech.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="12"
        y="1.5"
        width="14.85"
        height="14.85"
        rx="1.5"
        transform="rotate(45 12 1.5)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="12"
        y="7"
        width="7.07"
        height="7.07"
        rx="0.75"
        transform="rotate(45 12 7)"
        fill="currentColor"
      />
    </svg>
  );
}
