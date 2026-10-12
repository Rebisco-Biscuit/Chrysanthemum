import { COSTS, MAX_TIER, SOULSTONE_RATE, hasFactionAcorn, type AcornFaction, type Hero } from "./data";

export type HeroState = {
  /** Index into TIERS, or -1 if not owned. */
  tier: number;
  /** Own Soul Sigils on hand. */
  sigils: number;
  /** Optional goal tier. */
  target?: number;
  /** Crossover banner has ended: ascend with Dimensional Soulstones instead of sigils. */
  soulstones?: boolean;
};

export type Period = "daily" | "weekly";

/** activity: Daily Quest activity points this task gives, if any (entered by the user). */
export type Task = { id: string; name: string; period: Period; activity?: number };

/** Daily Quest chest target. */
export const ACTIVITY_GOAL = 100;

export type AppState = {
  updatedAt: number;
  heroes: Record<string, HeroState>;
  /** Omni-Acorns: usable for any faction. */
  acorns: number;
  /** Faction acorns: usable only for heroes of that faction. */
  factionAcorns: Partial<Record<AcornFaction, number>>;
  soulstonesA: number;
  soulstonesS: number;
  tasks: Task[];
  /** Completed task ids, keyed by period key (see periodKey). */
  done: Record<string, string[]>;
};

/** Weekly tasks reset at this UTC weekday (1 = Monday). */
export const WEEKLY_RESET_DAY = 1;

const DEFAULT_TASKS: [string, Period][] = [
  ["AFK Stage", "daily"],
  ["Claim instant AFK rewards", "daily"],
  ["Arcane Labyrinth", "daily"],
  ["Arena", "daily"],
  ["Dream Realm", "daily"],
  ["Dura's Trials", "daily"],
  ["Honor Duel", "daily"],
  ["Legend Arena", "daily"],
  ["Supreme Arena", "daily"],
  ["Supreme League", "daily"],
  ["Send/receive friendship points", "daily"],
];

export const defaultTasks = (): Task[] =>
  DEFAULT_TASKS.map(([name, period], i) => ({ id: `t${i}`, name, period }));

export function defaultState(): AppState {
  return {
    updatedAt: 0,
    heroes: {},
    acorns: 0,
    factionAcorns: {},
    soulstonesA: 0,
    soulstonesS: 0,
    tasks: defaultTasks(),
    done: {},
  };
}

/** Fill in fields missing from older or partial saves. */
export function normalize(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return { ...base, ...(raw as Partial<AppState>) };
}

const DAY = 86_400_000;
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);

function periodStart(period: Period, now: number) {
  const day = Math.floor(now / DAY) * DAY;
  if (period === "daily") return day;
  const back = (new Date(day).getUTCDay() - WEEKLY_RESET_DAY + 7) % 7;
  return day - back * DAY;
}

export const periodKey = (period: Period, now = Date.now()) =>
  `${period[0]}:${isoDate(periodStart(period, now))}`;

export const nextReset = (period: Period, now = Date.now()) =>
  periodStart(period, now) + (period === "daily" ? DAY : 7 * DAY);

/** Drop completion records that are no longer current. */
export function pruneDone(state: AppState, now = Date.now()): AppState {
  const keep = new Set([periodKey("daily", now), periodKey("weekly", now)]);
  const done = Object.fromEntries(Object.entries(state.done).filter(([k]) => keep.has(k)));
  return { ...state, done };
}

export const heroState = (state: AppState, name: string): HeroState =>
  state.heroes[name] ?? { tier: -1, sigils: 0 };

export type Step = { tier: number; kind: "sigils" | "soulstones" | "acorns"; amount: number };

/** Cost of going from the hero's current tier to the next one, or null at max. */
export function nextStep(hero: Hero, hs: HeroState): Step | null {
  const table = COSTS[hero.costs];
  let tier = hs.tier + 1;
  if (hs.tier < 0) tier = table.findIndex((c) => c !== null);
  if (tier > MAX_TIER) return null;
  const cost = table[tier];
  if (!cost) return null;
  if ("acorns" in cost) return { tier, kind: "acorns", amount: cost.acorns };
  if (hs.soulstones) return { tier, kind: "soulstones", amount: cost.sigils * SOULSTONE_RATE };
  return { tier, kind: "sigils", amount: cost.sigils };
}

/** Total sigil (or soulstone) and acorn cost from the current tier up to `target`. */
export function costTo(hero: Hero, hs: HeroState, target: number) {
  const table = COSTS[hero.costs];
  let sigils = 0;
  let acorns = 0;
  for (let t = Math.max(hs.tier + 1, 0); t <= target; t++) {
    const c = table[t];
    if (!c) continue;
    if ("acorns" in c) acorns += c.acorns;
    else sigils += c.sigils * (hs.soulstones ? SOULSTONE_RATE : 1);
  }
  return { sigils, acorns };
}

/** How many of the shared resource a step can draw on. */
export function available(state: AppState, hero: Hero, hs: HeroState, kind: Step["kind"]) {
  if (kind === "acorns") return state.acorns + factionAcorns(state, hero);
  if (kind === "soulstones") return hero.costs === "A" ? state.soulstonesA : state.soulstonesS;
  return hs.sigils;
}

export const factionAcorns = (state: AppState, hero: Hero) =>
  hasFactionAcorn(hero.faction) ? (state.factionAcorns[hero.faction] ?? 0) : 0;

/** Pay an acorn cost for this hero: faction acorns first, then Omni-Acorns. */
export function spendAcorns(state: AppState, hero: Hero, amount: number): AppState {
  const own = Math.min(factionAcorns(state, hero), amount);
  const next = { ...state, acorns: Math.max(0, state.acorns - (amount - own)) };
  if (own > 0 && hasFactionAcorn(hero.faction))
    next.factionAcorns = { ...state.factionAcorns, [hero.faction]: factionAcorns(state, hero) - own };
  return next;
}

export const countAtLeast = (state: AppState, heroes: Hero[], tier: number) =>
  heroes.filter((h) => heroState(state, h.name).tier >= tier).length;
