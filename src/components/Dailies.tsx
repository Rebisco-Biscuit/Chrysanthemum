"use client";

import { useState } from "react";
import { ACTIVITY_GOAL, defaultTasks, nextReset, periodKey, type AppState, type Period } from "@/lib/state";
import type { Update } from "./Tracker";

function countdown(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}

export default function Dailies({ state, update, now }: { state: AppState; update: Update; now: number }) {
  return (
    <div className="stack">
      <Section title="Daily" period="daily" state={state} update={update} now={now} />
      <Section title="Weekly" period="weekly" state={state} update={update} now={now} />
    </div>
  );
}

function Section({
  title,
  period,
  state,
  update,
  now,
}: {
  title: string;
  period: Period;
  state: AppState;
  update: Update;
  now: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const key = periodKey(period, now);
  const done = new Set(state.done[key] ?? []);
  const tasks = state.tasks.filter((t) => t.period === period);
  const count = tasks.filter((t) => done.has(t.id)).length;
  const tracksActivity = tasks.some((t) => t.activity);
  const activity = tasks.reduce((sum, t) => sum + (done.has(t.id) ? (t.activity ?? 0) : 0), 0);

  function toggle(id: string) {
    update((s) => {
      const cur = new Set(s.done[key] ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...s, done: { ...s.done, [key]: [...cur] } };
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const id = `t${Date.now().toString(36)}`;
    update((s) => ({ ...s, tasks: [...s.tasks, { id, name, period }] }));
    setDraft("");
  }

  function rename(id: string, name: string) {
    update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, name } : t)) }));
  }

  function setActivity(id: string, value: number) {
    const activity = value > 0 ? value : undefined;
    update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, activity } : t)) }));
  }

  function restoreDefaults() {
    if (!confirm(`Replace your ${period} tasks with the default list?`)) return;
    update((s) => ({
      ...s,
      tasks: [...s.tasks.filter((t) => t.period !== period), ...defaultTasks().filter((t) => t.period === period)],
    }));
  }

  function remove(id: string) {
    update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }

  function move(id: string, dir: -1 | 1) {
    update((s) => {
      const list = [...s.tasks];
      const i = list.findIndex((t) => t.id === id);
      let j = i + dir;
      while (j >= 0 && j < list.length && list[j].period !== period) j += dir;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, tasks: list };
    });
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>
          {title} <span className="muted small">{count}/{tasks.length}</span>
          {tracksActivity && (
            <span className={`small ${activity >= ACTIVITY_GOAL ? "ready-text" : "muted"}`}>
              {" "}· Activity {activity}/{ACTIVITY_GOAL}
            </span>
          )}
        </h2>
        <div className="row">
          <span className="muted small">Resets in {countdown(nextReset(period, now) - now)}</span>
          <button className="ghost small" onClick={() => setEditing(!editing)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>
      <div className="progress" style={{ marginBottom: 12 }}>
        <div style={{ width: `${tasks.length ? (count / tasks.length) * 100 : 0}%` }} />
      </div>
      {tasks.length === 0 && !editing && <p className="muted small">No {period} tasks. Use Edit to add some.</p>}
      <ul className="tasks">
        {tasks.map((t) =>
          editing ? (
            <li key={t.id} className="task">
              <input
                style={{ flex: 1 }}
                defaultValue={t.name}
                onBlur={(e) => e.target.value.trim() && rename(t.id, e.target.value.trim())}
              />
              <input
                type="number"
                min={0}
                placeholder="Activity"
                title="Daily Quest activity points (optional)"
                style={{ width: 84 }}
                defaultValue={t.activity ?? ""}
                onBlur={(e) => setActivity(t.id, +e.target.value)}
              />
              <button className="ghost" onClick={() => move(t.id, -1)} aria-label="Move up">
                ↑
              </button>
              <button className="ghost" onClick={() => move(t.id, 1)} aria-label="Move down">
                ↓
              </button>
              <button className="ghost" onClick={() => remove(t.id)} aria-label="Delete">
                ✕
              </button>
            </li>
          ) : (
            <li key={t.id} className={`task ${done.has(t.id) ? "done" : ""}`}>
              <label>
                <input type="checkbox" checked={done.has(t.id)} onChange={() => toggle(t.id)} />
                <span>{t.name}</span>
                {t.activity ? <em className="muted small">+{t.activity}</em> : null}
              </label>
            </li>
          ),
        )}
      </ul>
      {editing && (
        <form className="row" onSubmit={add} style={{ marginTop: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder={`New ${period} task`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="primary" disabled={!draft.trim()}>
            Add
          </button>
          <button type="button" className="ghost small" onClick={restoreDefaults}>
            Restore defaults
          </button>
        </form>
      )}
    </section>
  );
}
