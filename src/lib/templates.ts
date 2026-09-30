import { characterName, type CharacterId } from "../data/characters.ts";
import type { Item, Polarity } from "./schema.ts";

/** Typographic apostrophe, as in DCCD's deck. */
export const CANT = "can’t";

const word = (p: Polarity) => (p === "cant" ? CANT : "can");

/** The character the child should pick: the one who can't (cant lesson) or the other one (can lesson). */
export function correctCharacter(item: Item, polarity: Polarity): CharacterId {
  return polarity === "cant" ? item.answer : otherCharacter(item);
}

/** The other card in a trial: the one the child should not pick. */
export function distractorCharacter(item: Item, polarity: Polarity): CharacterId {
  return polarity === "cant" ? otherCharacter(item) : item.answer;
}

/** The character who CAN do the verb. */
export function otherCharacter(item: Item): CharacterId {
  return item.answer === item.optionA ? item.optionB : item.optionA;
}

export function instructionLine(item: Pick<Item, "verb">, polarity: Polarity): string {
  return `Who ${word(polarity)} ${item.verb}?`;
}

export function teachLine(item: Item, polarity: Polarity): string {
  const cant = characterName(item.answer);
  const can = characterName(otherCharacter(item));
  return polarity === "cant"
    ? `The ${cant} ${CANT} ${item.verb}. The ${can} can ${item.verb}.`
    : `The ${can} can ${item.verb}. The ${cant} ${CANT} ${item.verb}.`;
}

export function praiseLine(item: Item, polarity: Polarity, picked: CharacterId): string {
  return `Yes! The ${characterName(picked)} ${word(polarity)} ${item.verb}.`;
}
