"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frames, Hero } from "@/lib/data";
import { normalize, pruneDone, type AppState } from "@/lib/state";
import Dailies from "./Dailies";
import Heroes from "./Heroes";
import DataTab from "./DataTab";

const TABS = ["Dailies", "Heroes", "Data"] as const;
type Tab = (typeof TABS)[number];
type Sync = "saved" | "saving" | "error";

export type Update = (fn: (s: AppState) => AppState) => void;

export default function Tracker({ initial, heroes, frames }: { initial: AppState; heroes: Hero[]; frames: Frames }) {
  const [state, setState] = useState(() => pruneDone(initial));
  const [tab, setTab] = useState<Tab>("Dailies");
  const [sync, setSync] = useState<Sync>("saved");
  const [now, setNow] = useState(() => Date.now());
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("afkj:tab") as Tab | null;
      if (saved && TABS.includes(saved)) setTab(saved);
    } catch {}
  }, []);

  const save = useCallback(async (s: AppState) => {
    setSync("saving");
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(s),
      });
      if (res.status === 401) return void (window.location.href = "/login");
      if (!res.ok) throw new Error(String(res.status));
      const { updatedAt } = await res.json();
      setState((prev) => ({ ...prev, updatedAt }));
      dirty.current = false;
      setSync("saved");
    } catch {
      setSync("error");
      timer.current = setTimeout(() => save(s), 5000);
    }
  }, []);

  const update: Update = useCallback(
    (fn) => {
      setState((prev) => {
        const next = fn(prev);
        dirty.current = true;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save(next), 600);
        return next;
      });
    },
    [save],
  );

  // Pull changes made on other devices when this tab regains focus.
  useEffect(() => {
    async function refresh() {
      if (document.visibilityState !== "visible" || dirty.current) return;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok || dirty.current) return;
        const remote = normalize(await res.json());
        setState((prev) => (remote.updatedAt > prev.updatedAt ? pruneDone(remote) : prev));
      } catch {}
    }
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Clock for reset countdowns.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  function pickTab(t: Tab) {
    setTab(t);
    try {
      localStorage.setItem("afkj:tab", t);
    } catch {}
  }

  const syncLabel = { saved: "Synced", saving: "Saving…", error: "Offline, retrying" }[sync];

  return (
    <div className="app">
      <header className="top">
        <h1>AFKJ Tracker</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "active" : ""} onClick={() => pickTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        <span className={`sync ${sync === "error" ? "error" : ""}`}>{syncLabel}</span>
      </header>
      {tab === "Dailies" && <Dailies state={state} update={update} now={now} />}
      {tab === "Heroes" && <Heroes state={state} update={update} heroes={heroes} frames={frames} />}
      {tab === "Data" && <DataTab state={state} update={update} />}
    </div>
  );
}
