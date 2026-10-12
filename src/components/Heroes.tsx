"use client";

import { useMemo, useState } from "react";
import { FACTIONS, PARAGON_GATES, SUPREME_PLUS, TIERS, grade, startTier, type Faction, type Hero } from "@/lib/data";
import {
  available,
  costTo,
  countAtLeast,
  heroState,
  nextStep,
  type AppState,
  type HeroState,
  type Step,
} from "@/lib/state";
import type { Update } from "./Tracker";

type Owned = "all" | "owned" | "unowned";
type Sort = "name" | "tier" | "ready";

const UNIT: Record<Step["kind"], string> = {
  sigils: "sigils",
  soulstones: "soulstones",
  acorns: "acorns",
};

function gateFor(state: AppState, heroes: Hero[], tier: number) {
  const gate = PARAGON_GATES.find((g) => g.tier === tier);
  if (!gate) return null;
  const have = countAtLeast(state, heroes, gate.from);
  return have >= gate.needs ? null : { have, ...gate };
}

export default function Heroes({ state, update, heroes }: { state: AppState; update: Update; heroes: Hero[] }) {
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState<Faction | null>(null);
  const [owned, setOwned] = useState<Owned>("all");
  const [sort, setSort] = useState<Sort>("tier");

  const ownedCount = heroes.filter((h) => heroState(state, h.name).tier >= 0).length;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ratio = (h: Hero) => {
      const hs = heroState(state, h.name);
      const step = nextStep(h, hs);
      return step ? available(state, h, hs, step.kind) / step.amount : -1;
    };
    return heroes.filter((h) => {
      const tier = heroState(state, h.name).tier;
      if (q && !h.name.toLowerCase().includes(q)) return false;
      if (faction && h.faction !== faction) return false;
      if (owned === "owned" && tier < 0) return false;
      if (owned === "unowned" && tier >= 0) return false;
      return true;
    }).sort((a, b) => {
      if (sort === "tier") {
        const d = heroState(state, b.name).tier - heroState(state, a.name).tier;
        if (d) return d;
      }
      if (sort === "ready") {
        const d = ratio(b) - ratio(a);
        if (d) return d;
      }
      return a.name.localeCompare(b.name);
    });
  }, [state, heroes, query, faction, owned, sort]);

  function setHero(name: string, patch: Partial<HeroState>) {
    update((s) => ({ ...s, heroes: { ...s.heroes, [name]: { ...heroState(s, name), ...patch } } }));
  }

  function setNum(field: "acorns" | "soulstonesA" | "soulstonesS", value: number) {
    update((s) => ({ ...s, [field]: Math.max(0, value || 0) }));
  }

  function ascend(hero: Hero, step: Step) {
    update((s) => {
      const hs = heroState(s, hero.name);
      const next = { ...s, heroes: { ...s.heroes, [hero.name]: { ...hs, tier: step.tier } } };
      if (step.kind === "acorns") next.acorns = Math.max(0, s.acorns - step.amount);
      else if (step.kind === "soulstones") {
        const field = hero.costs === "A" ? "soulstonesA" : "soulstonesS";
        next[field] = Math.max(0, s[field] - step.amount);
      } else next.heroes[hero.name].sigils = Math.max(0, hs.sigils - step.amount);
      return next;
    });
  }

  const supremePlus = countAtLeast(state, heroes, SUPREME_PLUS);
  const nextGate = PARAGON_GATES.find((g) => countAtLeast(state, heroes, g.from) < g.needs);

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat">
          <span className="label">Owned</span>
          <span className="value">
            {ownedCount}/{heroes.length}
          </span>
        </div>
        <div className="stat">
          <span className="label">Supreme+ or higher</span>
          <span className="value">{supremePlus}</span>
          {nextGate && (
            <span className="small muted">
              {TIERS[nextGate.tier]}: {countAtLeast(state, heroes, nextGate.from)}/{nextGate.needs} at {TIERS[nextGate.from]}
            </span>
          )}
        </div>
        <label className="stat">
          <span className="label">Omni-Acorns</span>
          <input type="number" min={0} value={state.acorns} onChange={(e) => setNum("acorns", +e.target.value)} />
        </label>
        <label className="stat">
          <span className="label">Soulstones (A)</span>
          <input
            type="number"
            min={0}
            value={state.soulstonesA}
            onChange={(e) => setNum("soulstonesA", +e.target.value)}
          />
        </label>
        <label className="stat">
          <span className="label">Soulstones (S)</span>
          <input
            type="number"
            min={0}
            value={state.soulstonesS}
            onChange={(e) => setNum("soulstonesS", +e.target.value)}
          />
        </label>
      </div>

      <div className="filters">
        <input type="search" placeholder="Search heroes" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={owned} onChange={(e) => setOwned(e.target.value as Owned)}>
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="unowned">Not owned</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="tier">Sort: tier</option>
          <option value="ready">Sort: closest to ascend</option>
          <option value="name">Sort: name</option>
        </select>
      </div>
      <div className="filters">
        <button className={`chip ${faction === null ? "active" : ""}`} onClick={() => setFaction(null)}>
          All factions
        </button>
        {FACTIONS.map((f) => (
          <button
            key={f}
            className={`chip ${faction === f ? "active" : ""}`}
            onClick={() => setFaction(faction === f ? null : f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="heroes">
        {list.map((h) => (
          <HeroRow key={h.name} hero={h} heroes={heroes} state={state} setHero={setHero} ascend={ascend} />
        ))}
        {list.length === 0 && <p className="muted">No heroes match.</p>}
      </div>
    </div>
  );
}

function HeroRow({
  hero,
  heroes,
  state,
  setHero,
  ascend,
}: {
  hero: Hero;
  heroes: Hero[];
  state: AppState;
  setHero: (name: string, patch: Partial<HeroState>) => void;
  ascend: (hero: Hero, step: Step) => void;
}) {
  const hs = heroState(state, hero.name);
  const step = nextStep(hero, hs);
  const have = step ? available(state, hero, hs, step.kind) : 0;
  const gate = step ? gateFor(state, heroes, step.tier) : null;
  const ready = step && have >= step.amount && !gate;
  const goal = hs.target !== undefined && hs.target > hs.tier ? costTo(hero, hs, hs.target) : null;
  const goalUnit = hs.soulstones ? "soulstones" : "sigils";
  const tiers = TIERS.map((t, i) => ({ t, i })).filter(({ i }) => i >= startTier(hero));

  return (
    <div
      className={`hero ${hs.tier < 0 ? "unowned" : ""}`}
      style={{ "--faction": `var(--${hero.faction.toLowerCase()})` } as React.CSSProperties}
    >
      <div>
        <div className="name">{hero.name}</div>
        <div className="meta">
          {hero.faction} · {grade(hero)}-level
        </div>
      </div>

      <select
        value={hs.tier}
        onChange={(e) => setHero(hero.name, { tier: +e.target.value })}
        aria-label={`${hero.name} tier`}
      >
        <option value={-1}>Not owned</option>
        {tiers.map(({ t, i }) => (
          <option key={t} value={i}>
            {t}
          </option>
        ))}
      </select>

      <div className="stepper" title={hs.soulstones ? "Uses shared soulstones" : "Soul Sigils on hand"}>
        <button onClick={() => setHero(hero.name, { sigils: Math.max(0, hs.sigils - 1) })} disabled={hs.soulstones}>
          −
        </button>
        <input
          type="number"
          min={0}
          value={hs.sigils}
          disabled={hs.soulstones}
          onChange={(e) => setHero(hero.name, { sigils: Math.max(0, +e.target.value || 0) })}
          aria-label={`${hero.name} sigils`}
        />
        <button onClick={() => setHero(hero.name, { sigils: hs.sigils + 1 })} disabled={hs.soulstones}>
          +
        </button>
      </div>

      <div className="next">
        {step ? (
          <>
            <div className="line">
              <span>
                → {TIERS[step.tier]}: {Math.min(have, step.amount)}/{step.amount} {UNIT[step.kind]}
              </span>
              {gate ? (
                <span className="locked small">
                  Needs {gate.needs} at {TIERS[gate.from]} ({gate.have})
                </span>
              ) : ready ? (
                <button className="primary small" onClick={() => ascend(hero, step)}>
                  {hs.tier < 0 ? "Unlock" : "Ascend"}
                </button>
              ) : null}
            </div>
            <div className={`progress ${ready ? "ready" : ""}`}>
              <div style={{ width: `${Math.min(100, (have / step.amount) * 100)}%` }} />
            </div>
          </>
        ) : (
          <span className="ready-text">Max tier</span>
        )}
      </div>

      {hs.tier >= 0 && (
      <div className="extra">
        <label className="row">
          Goal
          <select
            value={hs.target ?? ""}
            onChange={(e) => setHero(hero.name, { target: e.target.value === "" ? undefined : +e.target.value })}
          >
            <option value="">None</option>
            {tiers
              .filter(({ i }) => i > hs.tier)
              .map(({ t, i }) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
          </select>
        </label>
        {goal && (
          <span>
            Needs {Math.max(0, goal.sigils - (hs.soulstones ? 0 : hs.sigils))} more {goalUnit}
            {goal.acorns > 0 && ` + ${goal.acorns} acorns`}
          </span>
        )}
        {hero.crossover && (
          <label className="row">
            <input
              type="checkbox"
              checked={!!hs.soulstones}
              onChange={(e) => setHero(hero.name, { soulstones: e.target.checked })}
            />
            Banner ended (uses soulstones)
          </label>
        )}
      </div>
      )}
    </div>
  );
}
