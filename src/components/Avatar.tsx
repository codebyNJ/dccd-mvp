import type { AvatarId } from "@/lib/schema";

export const AVATARS: AvatarId[] = ["sun", "leaf", "kite", "boat", "moon", "flower"];

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const ART: Record<AvatarId, { bg: string; paths: { d: string; fill?: string; stroke?: string }[] }> = {
  sun: {
    bg: "var(--amber-100)",
    paths: [
      { d: "M32 20a12 12 0 1 1 0 24 12 12 0 0 1 0-24z", fill: "var(--amber-400)", stroke: "var(--amber-600)" },
      { d: "M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M49 15l-4 4M19 45l-4 4", stroke: "var(--amber-600)" },
    ],
  },
  leaf: {
    bg: "#e3f2e6",
    paths: [
      { d: "M14 50C14 26 30 14 52 12c0 24-12 40-38 38z", fill: "#9ccfa6", stroke: "#3f7a4b" },
      { d: "M14 50 40 24", stroke: "#3f7a4b" },
    ],
  },
  kite: {
    bg: "var(--blue-50)",
    paths: [
      { d: "M32 8 48 28 32 44 16 28z", fill: "var(--blue-300)", stroke: "var(--blue-700)" },
      { d: "M32 8v36M16 28h32M32 44c-2 6 4 8 0 14", stroke: "var(--blue-700)" },
    ],
  },
  boat: {
    bg: "var(--blue-50)",
    paths: [
      { d: "M12 40h40l-6 10H18z", fill: "var(--coral-300)", stroke: "var(--coral-600)" },
      { d: "M32 12v28M32 14l14 22H32z", fill: "var(--surface)", stroke: "var(--blue-700)" },
    ],
  },
  moon: {
    bg: "#e7e6f5",
    paths: [{ d: "M40 12a20 20 0 1 0 12 30A16 16 0 0 1 40 12z", fill: "#c9c5ec", stroke: "#4c4695" }],
  },
  flower: {
    bg: "var(--coral-50)",
    paths: [
      {
        d: [circle(32, 19, 8), circle(20, 29, 8), circle(44, 29, 8), circle(25, 43, 8), circle(39, 43, 8)].join(""),
        fill: "var(--coral-300)",
        stroke: "var(--coral-600)",
      },
      { d: circle(32, 33, 6), fill: "var(--amber-400)", stroke: "var(--amber-600)" },
    ],
  },
};

/** A calm picture instead of a photo: learners are identified by nickname and avatar only. */
export function Avatar({ id, size = 64, className = "" }: { id: AvatarId; size?: number; className?: string }) {
  const a = ART[id];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden focusable="false">
      <circle cx="32" cy="32" r="31" fill={a.bg} />
      {a.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
