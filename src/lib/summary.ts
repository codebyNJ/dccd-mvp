import { characterName, type CharacterId } from "@/data/characters";
import type { Lesson, Session } from "./schema";
import { correctCharacter, CANT } from "./templates";
import { isIndependent } from "./trial";

/**
 * Plain-language summary over the last few sessions, e.g.
 * "Answers the lion questions independently; still needs help with who can’t roar."
 */
export function plainSummary(lesson: Lesson, sessions: Session[], lastN = 3): string {
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, lastN);
  const firstTries = recent.flatMap((s) => s.trials).filter((r) => !r.correction);
  if (firstTries.length === 0) return "No trial data yet.";
  // Independence is measured in Check; fall back to Practise only when there is no Check data.
  const probe = firstTries.filter((r) => r.step === "check" || r.step === "review");
  const data = probe.length ? probe : firstTries;

  const q = (verb: string) => `who ${lesson.polarity === "cant" ? CANT : "can"} ${verb}`;
  const strong: { verb: string; who: CharacterId }[] = [];
  const weak: string[] = [];
  for (const item of lesson.items) {
    const rs = data.filter((r) => r.itemId === item.id);
    if (rs.length < 2) continue;
    const rate = rs.filter(isIndependent).length / rs.length;
    if (rate >= 0.8) strong.push({ verb: item.verb, who: correctCharacter(item, lesson.polarity) });
    else if (rate < 0.5) weak.push(q(item.verb));
  }

  // Group strong items by the character who is the answer ("the lion questions").
  const byWho = new Map<CharacterId, string[]>();
  for (const s of strong) byWho.set(s.who, [...(byWho.get(s.who) ?? []), s.verb]);
  const parts: string[] = [];
  for (const [who, verbs] of byWho) {
    if (verbs.length >= 2) parts.push(`the ${characterName(who)} questions`);
    else parts.push(q(verbs[0]));
  }

  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const good = parts.length ? `Answers ${list(parts)} independently` : "Not answering independently yet";
  const help = weak.length ? `still needs help with ${list(weak)}` : parts.length ? "no items need extra help right now" : "keep prompting";
  return `${good}; ${help}.`;
}
