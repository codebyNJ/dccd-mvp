import Papa from "papaparse";
import { CHARACTER_IDS, type CharacterId } from "@/data/characters";
import type { Item } from "./schema";

export const CSV_HEADER = ["verb", "optionA", "optionB", "answer", "status"] as const;
const REQUIRED = ["verb", "optionA", "optionB", "answer"] as const;

export interface CsvRow {
  line: number;
  values: Record<string, string>;
  item: Omit<Item, "id"> | null;
  errors: string[];
}

export interface CsvResult {
  headerError: string | null;
  rows: CsvRow[];
}

const isCharacter = (v: string): v is CharacterId => (CHARACTER_IDS as string[]).includes(v);

export function parseItemsCsv(text: string): CsvResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => {
      const t = h.trim();
      return CSV_HEADER.find((c) => c.toLowerCase() === t.toLowerCase()) ?? t;
    },
  });
  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED.filter((c) => !fields.includes(c));
  if (!text.trim()) return { headerError: "Paste some CSV first.", rows: [] };
  if (missing.length) {
    return { headerError: `The first line must be the header ${CSV_HEADER.join(",")}. Missing: ${missing.join(", ")}.`, rows: [] };
  }

  const rows = parsed.data.map((raw, i): CsvRow => {
    const v = (k: string) => (raw[k] ?? "").trim();
    const values = Object.fromEntries(CSV_HEADER.map((k) => [k, v(k)]));
    const errors: string[] = [];
    const verb = v("verb").replace(/\s+/g, " ");
    const [a, b, ans] = [v("optionA"), v("optionB"), v("answer")].map((x) => x.toLowerCase());
    const statusRaw = v("status").toLowerCase();

    if (!verb) errors.push("Missing verb.");
    for (const [col, val] of [["optionA", a], ["optionB", b], ["answer", ans]] as const) {
      if (!val) errors.push(`Missing ${col}.`);
      else if (!isCharacter(val)) errors.push(`Unknown image "${val}" in ${col}. Use one of: ${CHARACTER_IDS.join(", ")}.`);
    }
    if (a && b && a === b) errors.push("optionA and optionB are the same character.");
    if (ans && a && b && ans !== a && ans !== b) errors.push(`Answer "${ans}" is neither optionA nor optionB.`);
    if (statusRaw && statusRaw !== "approved" && statusRaw !== "draft") errors.push(`Status must be "approved" or "draft" (or left empty for draft).`);

    const item =
      errors.length === 0 && isCharacter(a) && isCharacter(b) && isCharacter(ans)
        ? { verb, optionA: a, optionB: b, answer: ans, status: statusRaw === "approved" ? ("approved" as const) : ("draft" as const) }
        : null;
    return { line: i + 2, values, item, errors };
  });
  return { headerError: null, rows };
}

/** An item a child may see: approved, with a verb, two different characters, and a valid answer. */
export function isTeachable(item: Item): boolean {
  return (
    item.status === "approved" &&
    item.verb.trim().length > 0 &&
    item.optionA !== item.optionB &&
    (item.answer === item.optionA || item.answer === item.optionB)
  );
}
