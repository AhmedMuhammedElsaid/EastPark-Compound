/**
 * Imperative API for the in-app confirm dialog (replaces native `Alert.alert`
 * confirms, which ignore the theme, the font and the RTL title alignment).
 *
 *   if (await showConfirm({ title, message, confirmLabel, destructive: true }))
 *     doIt();
 *
 * `<ConfirmDialogHost />` (mounted once in the root layout) renders the
 * request at the head of the queue. Requests made while one is open wait
 * their turn. With no host mounted (e.g. a unit test that renders a screen
 * alone) the request resolves `false` straight away: nothing is confirmed
 * without a visible dialog.
 */
export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the confirming (last) button. */
  confirmLabel: string;
  /** Label of the dismissing (first) button. Defaults to `common.cancel`. */
  cancelLabel?: string;
  /** Paints the confirming button in the error colour. */
  destructive?: boolean;
};

export type ConfirmRequest = ConfirmOptions & { id: number };

type Pending = ConfirmRequest & { resolve: (confirmed: boolean) => void };

let queue: Pending[] = [];
let nextId = 1;
let hosts = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  if (hosts === 0)
    return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { ...options, id: nextId++, resolve }];
    emit();
  });
}

/** The request on screen, or null. Stable between changes (useSyncExternalStore). */
export function getActiveConfirm(): ConfirmRequest | null {
  return queue[0] ?? null;
}

/** Hides the request first, then resolves its promise. Unknown ids are ignored. */
export function settleConfirm(id: number, confirmed: boolean): void {
  const request = queue.find(r => r.id === id);
  if (!request)
    return;
  queue = queue.filter(r => r.id !== id);
  emit();
  request.resolve(confirmed);
}

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Called by the host on mount. The returned function unregisters it; when the
 * last host goes away, open requests resolve `false`.
 */
export function registerConfirmHost(): () => void {
  hosts += 1;
  return () => {
    hosts = Math.max(0, hosts - 1);
    if (hosts > 0)
      return;
    const open = queue;
    queue = [];
    emit();
    open.forEach(r => r.resolve(false));
  };
}
