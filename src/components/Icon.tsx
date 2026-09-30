/** Simple line icons, always paired with a word (or an aria-label when icon-only). */
const PATHS = {
  home: "M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  soundOn: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  soundOff: "M4 9h4l5-4v14l-5-4H4zM17 9.5l5 5M22 9.5l-5 5",
  pause: "M5 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2H5zM5 9v5a7 7 0 0 0 14 0V9M19 11h1.5a2.5 2.5 0 0 1 0 5H19",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  hand: "M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-3 0-4.5-1.6-6-4.2L3 13a1.5 1.5 0 0 1 2.4-1.8L8 14",
  check: "M4 12.5 9.5 18 20 6.5",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7z",
  star: "m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8L3.5 9.7l5.9-.9z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  replay: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5",
  download: "M12 4v11M7 10.5l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 13.5l5-5 5 5M5 4h14",
  print: "M7 9V4h10v5M7 17H4.5v-6.5A1.5 1.5 0 0 1 6 9h12a1.5 1.5 0 0 1 1.5 1.5V17H17M7 14h10v6H7z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.3 2.4 3.6 5.2",
  chart: "M4 4v16h16M8 15l3.5-4 3 2.5L19 8",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  archive: "M3.5 4h17v4h-17zM5 8v12h14V8M10 12h4",
  sticker: "M12 3.5a8.5 8.5 0 1 0 8.5 8.5h-5a3.5 3.5 0 0 1-3.5-3.5z M12 3.5 20.5 12",
  close: "M6 6l12 12M18 6 6 18",
  book: "M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5v13",
  snail: "M2.5 19H17a3 3 0 0 0 3-3V9.5M20 9.5 21.5 6M20 9.5 18.5 6M9.5 19a5.5 5.5 0 1 1 5.5-5.5 3.2 3.2 0 0 1-3.2 3.2 1.8 1.8 0 0 1-1.8-1.8",
  walk: "M13 4.5a1.5 1.5 0 1 0 0 .01M10 21l2.5-6.5L15 17v4M12.5 14.5 13 9l-3.5 2-1 3.5M13 9l2.5 3.5 3 1",
  rabbit: "M8.5 11.5V4.5a1.5 1.5 0 0 1 3 0v6M12.5 10.5v-6a1.5 1.5 0 0 1 3 0v7M6 16a6 5 0 1 0 12 0 6 5 0 1 0-12 0M10 15.5h.01M14 15.5h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
