import { atom } from "jotai";
import { globalStore } from "./store";


interface Message {
  role: string,
  content: string
}

export const messageListAtom = atom<Message[]>([]);

/**
 * Update message list from outside React components
 * @param messages - New message list
 */
export function updateMessageList(messages: any[]) {
  globalStore.set(messageListAtom, messages);
}

/**
 * Add a message to the list from outside React components
 * @param message - Message to add
 */
export function addMessage(message: any) {
  const current = globalStore.get(messageListAtom);
  globalStore.set(messageListAtom, [...current, message]);
}

/**
 * Get current message list from outside React components
 * @returns Current message list
 */
export function getMessageList() {
  return globalStore.get(messageListAtom);
}