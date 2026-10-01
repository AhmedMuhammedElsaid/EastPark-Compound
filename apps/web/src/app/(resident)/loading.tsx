import { Container } from '@/components/Container';
import { PendingMark } from '@/components/PendingMark';

export default function ResidentLoading() {
  return (
    <Container className="py-8 sm:py-12">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="mx-auto max-w-5xl"
      >
        <span className="sr-only">Loading</span>
        <span className="mb-6 inline-flex text-primary">
          <PendingMark size={48} />
        </span>
        <div className="h-3 w-24 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-3 h-8 w-56 max-w-2/3 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-4 h-5 w-full max-w-lg animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-h-36 animate-pulse rounded-md border border-border bg-card p-5 motion-reduce:animate-none"
            >
              <div className="size-10 rounded-md bg-muted" />
              <div className="mt-5 h-5 w-2/3 rounded-sm bg-muted" />
              <div className="mt-3 h-4 w-full rounded-sm bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}