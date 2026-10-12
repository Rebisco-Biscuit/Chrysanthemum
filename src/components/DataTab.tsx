"use client";

import { useState } from "react";
import { normalize, type AppState } from "@/lib/state";
import type { Update } from "./Tracker";

export default function DataTab({ state, update }: { state: AppState; update: Update }) {
  const [message, setMessage] = useState("");

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `afkj-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!confirm("Replace all current data with this backup?")) return;
      update(() => data);
      setMessage("Backup imported.");
    } catch {
      setMessage("That file isn't a valid backup.");
    }
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Backup</h2>
        <p className="muted small">
          Your data is saved to the server and syncs to any device you log in from. Export a copy now and then
          in case you want to restore it.
        </p>
        <div className="row">
          <button onClick={exportJson}>Export JSON</button>
          <label className="row" style={{ cursor: "pointer" }}>
            <span className="small muted">Import:</span>
            <input
              type="file"
              accept="application/json"
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </label>
        </div>
        {message && <p className="small">{message}</p>}
      </section>
      <section className="card">
        <h2>Session</h2>
        <button onClick={logout}>Log out</button>
      </section>
    </div>
  );
}
