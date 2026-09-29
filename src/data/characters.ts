/**
 * The fixed set of characters. Images live in public/images/{id}.webp
 * (originals from DCCD's deck are in assets/images/). Every image sits on a
 * white card, so white-background JPGs and transparent PNGs look the same.
 */
export type IdleStyle = "sway" | "hop" | "bob" | "breathe" | "flap" | "tilt" | "bounce" | "people";

export const CHARACTERS = {
  baby: { name: "baby", idle: "people" },
  swimmer: { name: "swimmer", idle: "people" },
  dog: { name: "dog", idle: "bounce" },
  snake: { name: "snake", idle: "sway" },
  bird: { name: "bird", idle: "hop" },
  cat: { name: "cat", idle: "tilt" },
  lion: { name: "lion", idle: "breathe" },
  monkey: { name: "monkey", idle: "bob" },
  boy: { name: "boy", idle: "people" },
  bat: { name: "bat", idle: "flap" },
  toddler: { name: "toddler", idle: "people" },
} as const satisfies Record<string, { name: string; idle: IdleStyle }>;

export type CharacterId = keyof typeof CHARACTERS;
export const CHARACTER_IDS = Object.keys(CHARACTERS) as [CharacterId, ...CharacterId[]];

export const characterName = (id: CharacterId) => CHARACTERS[id].name;
export const characterSrc = (id: CharacterId) => `/images/${id}.webp`;
