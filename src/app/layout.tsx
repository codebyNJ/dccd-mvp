import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import { S } from "@/config/strings";
import "./globals.css";

// Self-hosted Lexend (from @fontsource/lexend): no font CDN, no network calls.
const lexend = localFont({
  src: [
    { path: "./fonts/lexend-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/lexend-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/lexend-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: S.appName,
  description: `Short, structured lessons for ${S.centre}.`,
  icons: { icon: "/brand/dccd-mark.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e6eff6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lexend.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
