import { atom } from "jotai";
import { globalStore } from "./store";

export const loadingAtom = atom<boolean>(false);

/**
 * Set loading state from outside React components
 */
export function setLoading(loading: boolean) {
  globalStore.set(loadingAtom, loading);
}

/**
 * Get current loading state
 */
export function getLoading() {
  return globalStore.get(loadingAtom);
}
