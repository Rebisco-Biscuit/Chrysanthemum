// Turns .data/capture/raw.json (from afkj-capture.ps1) into .data/afkj-import.json,
// a backup you load with Data > Import. Your current save (.data/state.json) is the base:
// tasks, checkmarks, goals and anything the capture couldn't read are kept as they are.
//
// Usage: node scripts/afkj-import.mjs [raw.json] [state.json] [out.json]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COSTS, HEROES, SOULSTONE_RATE, TIERS, startTier } from "../src/lib/data.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [rawPath = join(root, ".data/capture/raw.json"), statePath = join(root, ".data/state.json"), outPath = join(root, ".data/afkj-import.json")] =
  process.argv.slice(2);

const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const raw = readJson(rawPath);
const state = existsSync(statePath) ? readJson(statePath) : { heroes: {}, tasks: [], done: {} };
const list = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]).filter((s) => typeof s === "string" && s.trim());

// --- Fuzzy matching -----------------------------------------------------------------------
const letters = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}
const similarity = (a, b) => (a && b ? 1 - distance(a, b) / Math.max(a.length, b.length) : 0);

function bestMatch(reads, options, key = (o) => o) {
  let best = null;
  for (const r of reads)
    for (const o of options) {
      const score = similarity(letters(r), letters(key(o)));
      if (!best || score > best.score) best = { option: o, score };
    }
  return best;
}

// --- Rules --------------------------------------------------------------------------------
// Heroes the tracker knows: built-in roster plus anything already in your save (e.g. wiki additions).
const roster = new Map(HEROES.map((h) => [h.name, h]));
const SKIP = ["Hammie", "Chippy"]; // Rare heroes, can't be ascended
const PARAGON = TIERS.map((t, i) => (t.startsWith("Paragon") ? i : -1)).filter((i) => i >= 0);

// Cost of the step *into* tier t, as shown under the Ascend button.
function stepCost(hero, t, soulstones) {
  const c = COSTS[hero.costs][t];
  if (!c) return null;
  if ("acorns" in c) return { kind: "acorns", amount: c.acorns };
  return soulstones ? { kind: "soulstones", amount: c.sigils * SOULSTONE_RATE } : { kind: "sigils", amount: c.sigils };
}

// Tier crystal colours, measured from the hero page (identical for every hero). Some tiers look
// alike (Mythic+ vs Supreme), so this only chooses among tiers the badge and cost already allow.
// Elite, Elite+, Paragon 3 and Paragon 4 haven't been measured yet.
const CRYSTAL = {
  2: [207, 139, 81],
  3: [209, 107, 78],
  4: [198, 82, 80],
  5: [213, 161, 179],
  6: [223, 204, 230],
  7: [193, 175, 185],
  8: [192, 173, 185],
  9: [196, 162, 152],
  10: [227, 124, 197],
  11: [248, 203, 114],
};
function crystalTiers(rgb) {
  if (!Array.isArray(rgb)) return [];
  return Object.entries(CRYSTAL)
    .filter(([, ref]) => Math.hypot(...ref.map((v, i) => v - rgb[i])) < 12)
    .map(([tier]) => Number(tier));
}

// Badge text family: "Su reme+" -> Supreme, "ParagonW" -> Paragon, etc.
const FAMILIES = ["Elite", "Epic", "Legendary", "Mythic", "Supreme", "Paragon", "Rare"];
function badgeFamily(reads) {
  const m = bestMatch(reads.map((r) => r.replace(/\+/g, "")), FAMILIES);
  return m && m.score >= 0.6 ? m.option : null;
}

function readCounter(reads) {
  const votes = new Map();
  for (const r of reads) {
    const m = r.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").match(/(\d+)\s*\/\s*(\d+)/);
    if (m) votes.set(`${+m[1]}/${+m[2]}`, (votes.get(`${+m[1]}/${+m[2]}`) ?? 0) + 1);
  }
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const [have, need] = top[0].split("/").map(Number);
  return { have, need };
}

// --- Read each frame ------------------------------------------------------------------------
const results = [];
const notes = [];
const seen = new Set();
const pools = { soulstonesA: null, soulstonesS: null };
const acornTotals = {};

for (const page of raw.heroes ?? []) {
  const names = list(page.name);
  const frame = page.frame;
  const skip = bestMatch(names, SKIP);
  if (skip && skip.score >= 0.8) continue;
  const match = bestMatch(names, [...new Set([...roster.keys(), ...Object.keys(state.heroes ?? {})])]);
  if (!match || match.score < 0.6) {
    notes.push(`${frame}: couldn't read the hero name (${names.join(" / ") || "nothing"}) - check this one by hand`);
    continue;
  }
  const name = match.option;
  if (seen.has(name)) continue;
  seen.add(name);
  const hero = roster.get(name) ?? { name, costs: "S", faction: "?" };
  const counter = readCounter(list(page.ascend));
  const family = badgeFamily(list(page.badge));
  const crystal = crystalTiers(page.crystal);

  // Tiers consistent with the badge family (both the plain and "+" tier).
  const familyTiers = family
    ? TIERS.map((t, i) => (t.replace("+", "").replace(/ \d$/, "") === family ? i : -1)).filter((i) => i >= 0)
    : TIERS.map((_, i) => i);
  let candidates = familyTiers.filter((t) => t >= startTier(hero));

  // Narrow by the cost of the next step, trying sigils and (for crossovers) soulstones.
  let soulstones = false;
  if (counter) {
    const fits = (t, ss) => {
      const c = stepCost(hero, t + 1, ss);
      return c && c.amount === counter.need;
    };
    const bySigils = candidates.filter((t) => fits(t, false));
    const byStones = hero.crossover ? candidates.filter((t) => fits(t, true)) : [];
    if (byStones.length && !bySigils.length) {
      candidates = byStones;
      soulstones = true;
    } else if (bySigils.length) candidates = bySigils;
  }
  const byCrystal = candidates.filter((t) => crystal.includes(t));
  if (candidates.length > 1 && byCrystal.length) candidates = byCrystal;
  // Plain vs "+" tier from the badge text, when OCR caught it.
  if (candidates.length > 1 && family !== "Paragon") {
    const badge = list(page.badge).filter((r) => letters(r).length >= 3);
    const plus = badge.some((r) => r.includes("+"));
    const narrowed = candidates.filter((t) => TIERS[t].endsWith("+") === plus);
    if (badge.length && narrowed.length) candidates = narrowed;
  }

  const tier = candidates.length ? candidates[0] : null;
  if (tier === null) {
    notes.push(`${name}: couldn't work out the tier (badge "${list(page.badge).join(" / ")}") - check by hand`);
    continue;
  }
  if (candidates.length > 1)
    notes.push(`${name}: could be ${candidates.map((t) => TIERS[t]).join(" or ")} - set to ${TIERS[tier]}, please check`);

  const step = stepCost(hero, tier + 1, soulstones);
  let sigils = null;
  if (!counter) {
    const why = list(page.ascend).some((r) => /suppl/i.test(r)) ? "hidden behind the Supplement label" : "unreadable";
    notes.push(`${name}: sigil count ${why} - kept your saved value`);
  } else if (step?.kind === "acorns") {
    acornTotals[hero.faction] = counter.have;
  } else if (step?.kind === "soulstones") {
    pools[hero.costs === "A" ? "soulstonesA" : "soulstonesS"] = counter.have;
  } else sigils = counter.have;

  results.push({ name, tier, sigils, soulstones, crossover: !!hero.crossover });
}

// --- Merge into the save ------------------------------------------------------------------
const out = structuredClone(state);
out.heroes ??= {};
for (const r of results) {
  const old = out.heroes[r.name] ?? { tier: -1, sigils: 0 };
  const next = { ...old, tier: r.tier, sigils: r.sigils ?? old.sigils ?? 0 };
  if (r.crossover) next.soulstones = r.soulstones;
  out.heroes[r.name] = next;
}
for (const [k, v] of Object.entries(pools)) if (v !== null) out[k] = v;
out.updatedAt = Date.now();

const missing = Object.entries(state.heroes ?? {})
  .filter(([n, h]) => h.tier >= 0 && !seen.has(n))
  .map(([n]) => n);
if (missing.length) notes.push(`In your save but not seen in the game (left unchanged): ${missing.join(", ")}`);
for (const [faction, total] of Object.entries(acornTotals))
  notes.push(`${faction} acorns + Omni-Acorns = ${total} (the game shows them combined; set the split in Resources)`);

writeFileSync(outPath, JSON.stringify(out, null, 2));
const report = [`Read ${results.length} heroes -> ${outPath}`, "Load it with Data > Import in the tracker.", ...(notes.length ? ["", "Check these:", ...notes.map((n) => `  - ${n}`)] : [])].join("\n");
writeFileSync(join(dirname(rawPath), "report.txt"), report + "\n");
console.log(report);
