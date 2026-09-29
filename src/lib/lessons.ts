import { DCCD_DECK, LESSON_IDS } from "@/data/deck";
import type { Item, Lesson } from "./schema";
import { isTeachable } from "./csv";

export const deckItems = (): Item[] =>
  DCCD_DECK.map((row, i) => ({ id: `dccd-${String(i + 1).padStart(2, "0")}`, ...row, status: "approved" }));

/** "Can" is taught first; "Can't" comes from DCCD's deck. Both start from the same 10 items. */
export const defaultLessons = (): Lesson[] => [
  { id: LESSON_IDS.can, title: "Can", polarity: "can", items: deckItems() },
  { id: LESSON_IDS.cant, title: "Can’t", polarity: "cant", items: deckItems() },
];

/** Items a child may see. Drafts (and incomplete rows) never reach a child. */
export const teachableItems = (lesson: Lesson) => lesson.items.filter(isTeachable);

export const newItemId = () => `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
