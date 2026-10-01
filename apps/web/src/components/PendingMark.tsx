import { BrandMark } from '@/components/BrandMark';

export function PendingMark({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 animate-[spin_900ms_linear_infinite] motion-reduce:animate-none"
    >
      <BrandMark size={size} />
    </span>
  );
}