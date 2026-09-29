"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { downloadBackup } from "@/lib/backup-file";
import { migrateState } from "@/lib/migrate";
import { closeDangling, trimHistory } from "@/lib/session";
import { useApp } from "@/store/app";

const B = S.grownUp.backup;

export function BackupTab() {
  const replaceAll = useApp((s) => s.replaceAll);
  const loadDemo = useApp((s) => s.loadDemo);
  const clearAll = useApp((s) => s.clearAll);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const importFile = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setMsg({ ok: false, text: `${B.importBad} not JSON.` });
    }
    const r = migrateState(raw);
    if (!r.ok) return setMsg({ ok: false, text: `${B.importBad} ${r.error}` });
    if (!confirm(B.importConfirm)) return;
    replaceAll({ ...r.state, sessions: trimHistory(closeDangling(r.state.sessions)) });
    setMsg({ ok: true, text: B.imported });
  };

  return (
    <>
      <h2 className="text-lg font-semibold">{B.title}</h2>
      <section className="panel flex flex-wrap gap-3">
        <button className="adult-btn primary" onClick={() => downloadBackup(useApp.getState())}>
          <Icon name="download" />
          {B.export}
        </button>
        <label className="adult-btn cursor-pointer">
          <Icon name="upload" />
          {B.import}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            data-testid="backup-import"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importFile(f);
            }}
          />
        </label>
      </section>

      <section className="panel flex flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          <button
            className="adult-btn"
            onClick={() => {
              if (!confirm(B.demoConfirm)) return;
              loadDemo();
              setMsg({ ok: true, text: B.demoLoaded });
            }}
          >
            <Icon name="users" />
            {B.demo}
          </button>
          <button
            className="adult-btn danger"
            onClick={() => {
              if (!confirm(B.clearConfirm)) return;
              clearAll();
              setMsg({ ok: true, text: B.cleared });
            }}
          >
            <Icon name="trash" />
            {B.clear}
          </button>
        </div>
        <p className="text-sm text-ink-muted">{B.demoHelp}</p>
      </section>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`panel ${msg.ok ? "text-blue-800" : "text-coral-ink"} whitespace-pre-line font-medium`}>
          {msg.text}
        </p>
      )}

      <section className="panel">
        <ul className="list-disc space-y-1 pl-5 text-ink-soft">
          {B.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
