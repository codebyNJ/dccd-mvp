import { VOICE } from "../config/strings.ts";
import { DCCD_DECK } from "../data/deck.ts";
import { instructionLine, praiseLine, teachLine, correctCharacter } from "./templates.ts";
import type { Item, Polarity } from "./schema.ts";

/** Every line the app can speak for the shipped deck (used by scripts/generate-audio.mjs). */
export function allVoiceLines(): string[] {
  const lines = new Set<string>(Object.values(VOICE));
  DCCD_DECK.forEach((row, i) => {
    const item: Item = { id: `dccd-${i + 1}`, ...row, status: "approved" };
    for (const p of ["can", "cant"] as Polarity[]) {
      lines.add(instructionLine(item, p));
      lines.add(teachLine(item, p));
      lines.add(praiseLine(item, p, correctCharacter(item, p)));
    }
  });
  return [...lines];
}
