import { Suspense } from "react";
import { GrownUp } from "@/components/grown-up/GrownUp";
import { S } from "@/config/strings";

export const metadata = { title: `${S.grownUp.area} · ${S.appName}` };

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-ink-soft">{S.loading}</div>}>
      <GrownUp />
    </Suspense>
  );
}
