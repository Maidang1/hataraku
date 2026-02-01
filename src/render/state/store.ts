import { createStore } from "jotai";

/**
 * Global Jotai store that can be used outside React components
 * Use this store to update atoms from non-React code
 */
export const globalStore = createStore();
