import * as React from "react";

/** Which phase copy the Coming soon sheet shows (mirrors the web `ComingSoonFeature`). */
export type ComingSoonFeature = "market" | "governance" | "community";

type ComingSoonState = { visible: boolean; feature?: ComingSoonFeature };

// Module-level store: the sheet is global UI state that must never be persisted (redux-persist)
// and has to be reachable from tab listeners outside any screen's React tree.
let state: ComingSoonState = { visible: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** Opens the Coming soon sheet; `feature` picks the phase-specific body copy. */
export function openComingSoon(feature?: ComingSoonFeature) {
  state = { visible: true, feature };
  emit();
}

export function closeComingSoon() {
  if (!state.visible)
    return;
  state = { ...state, visible: false };
  emit();
}

export function useComingSoonState(): ComingSoonState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
