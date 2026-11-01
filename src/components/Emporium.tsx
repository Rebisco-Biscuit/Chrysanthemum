"use client";

import { useMemo, useState } from "react";
import { TIERS, type Frames, type Hero } from "@/lib/data";
import { CURRENCIES, type Offer, type Offers } from "@/lib/emporium";
import { costTo, heroState, nextReset, nextStep, periodKey, type AppState } from "@/lib/state";
import { HeroCard, Pool } from "./Heroes";
import type { Update } from "./Tracker";

const fmt = (n: number) => n.toLocaleString("en-US");

function countdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

const boughtKey = (o: Offer, now: number) => `${periodKey(o.period, now)}|${o.id}`;

/** Sigils this hero still needs: for the next tier, or for their goal if that's further. */
function sigilsNeeded(hero: Hero, state: AppState) {
  const hs = heroState(state, hero.name);
  if (hs.soulstones) return { next: 0, goal: 0 }; // ascends with shared soulstones, not sigils
  const step = nextStep(hero, hs);
  const next = step?.kind === "sigils" ? Math.max(0, step.amount - hs.sigils) : 0;
  const goal = hs.target !== undefined && hs.target > hs.tier ? Math.max(0, costTo(hero, hs, hs.target).sigils - hs.sigils) : 0;
  return { next, goal };
}

type Row = { offer: Offer; hero?: Hero; left: number; next: number; goal: number; worth: number };

type Sort = "worth" | "closest" | "cheapest" | "tier" | "name";

const SORTS: Record<Sort, { label: string; compare: (a: Row, b: Row, tierOf: (r: Row) => number) => number }> = {
  worth: { label: "Most worth buying", compare: (a, b) => b.worth - a.worth || b.next - a.next },
  // Heroes who need only a few more sigils for their next tier come first.
  closest: {
    label: "Closest to next tier",
    compare: (a, b) => (a.next || Infinity) - (b.next || Infinity) || b.worth - a.worth,
  },
  cheapest: { label: "Cheapest to finish", compare: (a, b) => (a.worth * a.offer.price || Infinity) - (b.worth * b.offer.price || Infinity) },
  tier: { label: "Highest tier", compare: (a, b, tierOf) => tierOf(b) - tierOf(a) },
  name: { label: "Name", compare: () => 0 },
};

export default function Emporium({
  state,
  update,
  heroes,
  frames,
  offers,
  now,
}: {
  state: AppState;
  update: Update;
  heroes: Hero[];
  frames: Frames;
  offers: Offers;
  now: number;
}) {
  const SIGIL_OFFERS = offers.offers.filter((o) => o.gives.kind === "sigil");
  const RESOURCE_OFFERS = offers.offers.filter((o) => o.gives.kind !== "sigil");
  const currencyList = [...new Set([...CURRENCIES, ...offers.offers.map((o) => o.currency)])];
  const [onlyNeeded, setOnlyNeeded] = useState(true);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("worth");
  const byName = useMemo(() => new Map(heroes.map((h) => [h.name, h])), [heroes]);
  const bought = (o: Offer) => state.bought[boughtKey(o, now)] ?? 0;

  const rows: Row[] = SIGIL_OFFERS.map((offer) => {
    const name = offer.gives.kind === "sigil" ? offer.gives.hero : "";
    const hero = byName.get(name);
    const left = Math.max(0, offer.stock - bought(offer));
    const { next, goal } = hero ? sigilsNeeded(hero, state) : { next: 0, goal: 0 };
    return { offer, hero, left, next, goal, worth: Math.min(left, Math.max(next, goal)) };
  });

  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((r) => r.offer.gives.kind === "sigil" && (!q || r.offer.gives.hero.toLowerCase().includes(q)))
    .filter((r) => !onlyOwned || (r.hero && heroState(state, r.hero.name).tier >= 0))
    .filter((r) => !onlyNeeded || r.worth > 0);

  const stores = [...new Set(SIGIL_OFFERS.map((o) => o.store))];
  const heroName = (r: Row) => (r.offer.gives.kind === "sigil" ? r.offer.gives.hero : "");
  const tierOf = (r: Row) => (r.hero ? heroState(state, r.hero.name).tier : -2);

  function buy(offer: Offer, count: number) {
    if (count <= 0) return;
    update((s) => {
      const key = boughtKey(offer, now);
      const next: AppState = {
        ...s,
        bought: { ...s.bought, [key]: (s.bought[key] ?? 0) + count },
        currencies: { ...s.currencies, [offer.currency]: Math.max(0, (s.currencies[offer.currency] ?? 0) - offer.price * count) },
      };
      const g = offer.gives;
      if (g.kind === "sigil") {
        const hs = heroState(s, g.hero);
        next.heroes = { ...s.heroes, [g.hero]: { ...hs, sigils: hs.sigils + count } };
      } else if (g.kind === "acorns") {
        next.factionAcorns = { ...s.factionAcorns, [g.faction]: (s.factionAcorns[g.faction] ?? 0) + g.amount * count };
      } else {
        const field = g.grade === "A" ? "soulstonesA" : "soulstonesS";
        next[field] = s[field] + g.amount * count;
      }
      return next;
    });
  }

  function setCurrency(name: string, value: number) {
    update((s) => ({ ...s, currencies: { ...s.currencies, [name]: Math.max(0, value || 0) } }));
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Currencies</h2>
        <div className="pools">
          {currencyList.map((c) => (
            <Pool key={c} label={`${c}s`} value={state.currencies[c] ?? 0} onChange={(v) => setCurrency(c, v)} />
          ))}
        </div>
        <p className="small muted">
          Buying here adds the sigils to the hero and takes the price off these balances. Monthly stock resets in{" "}
          {countdown(nextReset("monthly", now) - now)} (1st of the month, 00:00 UTC).
        </p>
        <p className="small muted">
          Store lists come from the AFK Journey wiki and refresh every few hours, so they follow the game once the
          wiki is updated.
          {offers.builtIn.length > 0 &&
            ` Couldn't read the wiki for ${offers.builtIn.join(", ")}; showing the saved list from 1 Nov 2026 instead.`}
        </p>
      </div>

      <div className="filters">
        <input type="search" placeholder="Search heroes" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort offers">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <option key={k} value={k}>
              Sort: {SORTS[k].label.toLowerCase()}
            </option>
          ))}
        </select>
        <label className="row small">
          <input type="checkbox" checked={onlyNeeded} onChange={(e) => setOnlyNeeded(e.target.checked)} />
          Only heroes who need sigils
        </label>
        <label className="row small">
          <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} />
          Owned only
        </label>
      </div>

      {stores.map((store) => {
        const storeRows = visible
          .filter((r) => r.offer.store === store)
          .sort((a, b) => SORTS[sort].compare(a, b, tierOf) || heroName(a).localeCompare(heroName(b)));
        const all = rows.filter((r) => r.offer.store === store);
        const currencies = [...new Set(all.map((r) => r.offer.currency))];
        const worthCost = all.reduce((sum, r) => sum + r.worth * r.offer.price, 0);
        const worthCount = all.reduce((sum, r) => sum + r.worth, 0);
        const balance = state.currencies[currencies[0]] ?? 0;
        return (
          <section key={store} className="card">
            <div className="section-head">
              <h2>{store}</h2>
              <span className="small muted">
                {worthCount > 0 ? (
                  <>
                    Worth buying this month: {worthCount} sigils for{" "}
                    <span className={worthCost > balance ? "locked" : ""}>
                      {fmt(worthCost)} {currencies[0]}s
                    </span>
                  </>
                ) : (
                  "Nothing needed from here right now"
                )}
              </span>
            </div>
            {storeRows.length === 0 ? (
              <p className="small muted">No heroes match.</p>
            ) : (
              <div className="offers">
                {storeRows.map((r) => (
                  <OfferRow key={r.offer.id} row={r} state={state} frames={frames} onBuy={(n) => buy(r.offer, n)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="card">
        <h2>Acorns & soulstones</h2>
        <div className="offers">
          {RESOURCE_OFFERS.map((offer) => {
            const g = offer.gives;
            const left = Math.max(0, offer.stock - bought(offer));
            const label =
              g.kind === "acorns" ? `${g.amount} ${g.faction} Acorns` : g.kind === "soulstones" ? `${g.amount} Soulstones (${g.grade})` : "";
            return (
              <div key={offer.id} className="offer resource">
                <div>
                  <div className="name">{label}</div>
                  <div className="meta">
                    {offer.store} · {fmt(offer.price)} {offer.currency}s · {offer.period === "daily" ? "daily" : "monthly"}
                  </div>
                </div>
                <span className="small muted stock">
                  {left}/{offer.stock} left
                </span>
                <div className="buy">
                  <button onClick={() => buy(offer, 1)} disabled={left === 0}>
                    Buy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="small muted">
          Buying adds to your acorn and soulstone totals on the Heroes tab. Guild Store acorns reset daily in{" "}
          {countdown(nextReset("daily", now) - now)}.
        </p>
      </section>
    </div>
  );
}

function OfferRow({ row, state, frames, onBuy }: { row: Row; state: AppState; frames: Frames; onBuy: (n: number) => void }) {
  const { offer, hero, left, next, goal, worth } = row;
  const name = offer.gives.kind === "sigil" ? offer.gives.hero : "";
  const hs = hero ? heroState(state, hero.name) : null;
  return (
    <div className={`offer ${hs && hs.tier < 0 ? "unowned" : ""}`}>
      <div className="who">
        {hero ? <HeroCard hero={hero} tier={hs!.tier} frames={frames} /> : <div className="hero-card placeholder" />}
        <div>
          <div className="name">{name}</div>
          <div className="meta">
            {hs ? (hs.tier >= 0 ? TIERS[hs.tier] : "Not owned") : "Not in the tracker"}
            {hs && !hs.soulstones && ` · ${hs.sigils} sigils`}
            {hs?.soulstones && " · uses soulstones"}
          </div>
        </div>
      </div>
      <div className="need small">
        {next > 0 && <div>Next tier needs {next} more</div>}
        {goal > next && <div className="muted">Goal needs {goal} more</div>}
        {next === 0 && goal === 0 && <div className="muted">{hs?.soulstones ? "Sigils not used" : "Nothing needed"}</div>}
      </div>
      <span className="small muted stock">
        {fmt(offer.price)} {offer.currency}s · {left}/{offer.stock} left
      </span>
      <div className="buy">
        <button onClick={() => onBuy(1)} disabled={left === 0}>
          Buy 1
        </button>
        {worth > 1 && (
          <button className="primary" onClick={() => onBuy(worth)}>
            Buy {worth}
          </button>
        )}
      </div>
    </div>
  );
}
