import { atom } from "jotai";

const historyAtom = atom<string[]>([]);

export { historyAtom };
