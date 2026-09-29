import type { CharacterId } from "./characters.ts";

/**
 * DCCD's "Can't" deck. `answer` is always the character who CAN'T.
 * Answers are inferred from the deck — change them here if DCCD disagrees.
 */
export const DCCD_DECK: { verb: string; optionA: CharacterId; optionB: CharacterId; answer: CharacterId }[] = [
  { verb: "swim", optionA: "baby", optionB: "swimmer", answer: "baby" },
  { verb: "walk", optionA: "dog", optionB: "snake", answer: "snake" },
  { verb: "fly", optionA: "snake", optionB: "bird", answer: "snake" },
  { verb: "bark", optionA: "dog", optionB: "cat", answer: "cat" },
  { verb: "climb a tree", optionA: "monkey", optionB: "lion", answer: "lion" },
  { verb: "ride a bike", optionA: "boy", optionB: "cat", answer: "cat" },
  { verb: "see in the morning", optionA: "swimmer", optionB: "bat", answer: "bat" },
  { verb: "sing", optionA: "bird", optionB: "lion", answer: "lion" },
  { verb: "go to school", optionA: "toddler", optionB: "monkey", answer: "monkey" },
  { verb: "roar", optionA: "lion", optionB: "monkey", answer: "monkey" },
];

export const LESSON_IDS = { can: "can", cant: "cant" } as const;
