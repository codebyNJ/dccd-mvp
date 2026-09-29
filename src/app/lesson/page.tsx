import { Suspense } from "react";
import { LessonScreen } from "@/components/child/LessonScreen";
import { S } from "@/config/strings";

export const metadata = { title: `${S.child.lessons} · ${S.appName}` };

// The lesson id and step live in the query string (?id=can&step=practise), read on the client.
export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-ink-soft">{S.loading}</div>}>
      <LessonScreen />
    </Suspense>
  );
}
