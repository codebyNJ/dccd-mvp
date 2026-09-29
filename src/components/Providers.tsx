"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { S } from "@/config/strings";
import { quotaStore } from "@/lib/storage";
import { applyMute, loadManifest, unlockAudio, useSpeech } from "@/lib/voice";
import { useActiveLearner, useApp } from "@/store/app";
import { downloadBackup } from "@/lib/backup-file";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useApp((s) => s.hydrated);
  const muted = useApp((s) => s.muted);
  const learner = useActiveLearner();

  useEffect(() => {
    void useApp.persist.rehydrate();
    void loadManifest();
    // No audio before the first tap: this only unlocks, it plays nothing audible.
    const first = () => unlockAudio();
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => {
      window.removeEventListener("pointerdown", first);
      window.removeEventListener("keydown", first);
    };
  }, []);

  useEffect(() => applyMute(muted), [muted]);

  // Calm mode (per learner, on by default) forces reduced motion; otherwise follow the OS setting.
  const calm = learner?.settings.calmMode ?? false;

  return (
    <MotionConfig reducedMotion={calm ? "always" : "user"}>
      <StorageWarnings />
      {hydrated ? children : <Loading />}
      <SpokenLine />
    </MotionConfig>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center text-ink-soft" role="status" aria-live="polite">
      {S.loading}
    </div>
  );
}

/** Screen readers hear every spoken line. */
function SpokenLine() {
  const text = useSpeech((s) => s.current?.text ?? "");
  return (
    <div aria-live="polite" className="sr-only">
      {text}
    </div>
  );
}

function StorageWarnings() {
  const full = useSyncExternalStore(quotaStore.subscribe, quotaStore.get, quotaStore.getServer);
  const loadError = useApp((s) => s.loadError);
  if (!full && !loadError) return null;
  return (
    <div role="alert" className="adult no-print fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-3 border-b border-coral-300 bg-coral-50 px-4 py-3 text-coral-ink">
      <p className="flex-1">
        {full
          ? S.grownUp.backup.quota
          : `Saved data couldn’t be read, so the app started fresh. A copy was kept in this browser. (${loadError})`}
      </p>
      {full && (
        <button className="adult-btn" onClick={() => downloadBackup(useApp.getState())}>
          {S.grownUp.backup.export}
        </button>
      )}
    </div>
  );
}
