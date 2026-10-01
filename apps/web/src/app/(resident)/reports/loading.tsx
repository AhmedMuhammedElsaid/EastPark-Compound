import { Container } from '@/components/Container';

export default function ReportsLoading() {
  return (
    <Container className="py-8 sm:py-12">
      <div role="status" aria-live="polite" aria-busy="true" className="mx-auto max-w-5xl">
        <span className="sr-only">Loading reports</span>
        <div className="h-3 w-24 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-3 h-8 w-52 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-4 h-5 w-full max-w-lg animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-10 divide-y divide-border border-y border-border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-5 py-7">
              <div className="size-12 shrink-0 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-28 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
                <div className="h-5 w-3/4 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}