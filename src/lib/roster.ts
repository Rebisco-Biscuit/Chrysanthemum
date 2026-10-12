import "server-only";
import { FACTIONS, HEROES, TIERS, type Faction, type Frames, type Hero } from "./data";

// New heroes are picked up from the AFK Journey wiki. The built-in list in data.ts is the
// fallback and always wins for heroes it already knows, so a wiki outage or a bad edit
// can never remove or change an existing hero.

const API = "https://afk-journey.fandom.com/api.php";
const REVALIDATE = 6 * 60 * 60;

async function category(name: string): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${name}`,
      cmlimit: "500",
      cmnamespace: "0",
      format: "json",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    const res = await fetch(`${API}?${params}`, {
      headers: { "user-agent": "Mozilla/5.0 (AFKJ-T tracker)" },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) throw new Error(`wiki ${res.status}`);
    const json = await res.json();
    for (const m of json.query.categorymembers) if (!m.title.includes("/")) titles.push(m.title);
    cont = json.continue?.cmcontinue;
  } while (cont);
  return titles;
}

async function wikiHeroes(): Promise<Hero[]> {
  const [a, s, upcoming, ...factions] = await Promise.all([
    category("A-Level_Heroes"),
    category("S-Level_Heroes"),
    category("Upcoming_Heroes"),
    ...FACTIONS.map((f) => category(`${f}_Heroes`)),
  ]);
  const factionOf = new Map<string, Faction>();
  factions.forEach((names, i) => names.forEach((n) => factionOf.set(n, FACTIONS[i])));
  const unreleased = new Set(upcoming);
  const sLevel = new Set(s);

  const heroes: Hero[] = [];
  for (const name of new Set([...a, ...s])) {
    const faction = factionOf.get(name);
    if (!faction || unreleased.has(name)) continue;
    const costs = faction === "Celestial" || faction === "Hypogean" ? "CH" : sLevel.has(name) ? "S" : "A";
    // Dimensional heroes added later are crossovers (Pandora, the exception, is built in).
    heroes.push({ name, faction, costs, ...(faction === "Dimensional" ? { crossover: true as const } : {}) });
  }
  return heroes;
}

type WikiPage = {
  title: string;
  thumbnail?: { source: string };
  imageinfo?: { url: string; thumburl?: string }[];
};

/** Query the wiki for up to 50 titles at a time; returns results keyed by the title we asked for. */
async function wikiPages(titles: string[], extra: Record<string, string>): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    try {
      const params = new URLSearchParams({ action: "query", titles: batch.join("|"), format: "json", ...extra });
      const res = await fetch(`${API}?${params}`, {
        headers: { "user-agent": "Mozilla/5.0 (AFKJ-T tracker)" },
        next: { revalidate: REVALIDATE },
      });
      if (!res.ok) continue;
      const { query } = await res.json();
      // Map normalized/redirected titles back to the ones we asked for.
      const alias = new Map<string, string>(batch.map((t) => [t, t]));
      for (const step of [...(query.normalized ?? []), ...(query.redirects ?? [])])
        alias.set(step.to, alias.get(step.from) ?? step.from);
      for (const page of Object.values(query.pages) as WikiPage[]) {
        const asked = alias.get(page.title);
        if (asked) out.set(asked, page);
      }
    } catch {}
  }
  return out;
}

/** Scaled image URLs for wiki files, keyed by file name (without "File:"). */
async function fileUrls(files: string[], width: number): Promise<Record<string, string>> {
  const pages = await wikiPages(
    files.map((f) => `File:${f}`),
    { prop: "imageinfo", iiprop: "url", iiurlwidth: String(width) },
  );
  const out: Record<string, string> = {};
  for (const f of files) {
    const info = pages.get(`File:${f}`)?.imageinfo?.[0];
    if (info) out[f] = info.thumburl ?? info.url;
  }
  return out;
}

/** Card art (the wiki's Hero_<Name>.png), falling back to the hero page's main image. */
async function portraits(names: string[]): Promise<Record<string, string>> {
  const cards = await fileUrls(names.map((n) => `Hero_${n}.png`), 180);
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const n of names) {
    const url = cards[`Hero_${n}.png`];
    if (url) out[n] = url;
    else missing.push(n);
  }
  if (missing.length) {
    const pages = await wikiPages(missing, { prop: "pageimages", piprop: "thumbnail", pithumbsize: "240", redirects: "1" });
    for (const n of missing) {
      const src = pages.get(n)?.thumbnail?.source;
      if (src) out[n] = src;
    }
  }
  return out;
}

export async function getFrames(): Promise<Frames> {
  const file = (layer: string, tier: string) => `Hero_Rarity_${layer}_${tier.replace(/ /g, "_")}.png`;
  const files = TIERS.flatMap((t) => [file("Background", t), file("Foreground", t)]);
  const urls = await fileUrls(files, 300);
  return {
    background: TIERS.map((t) => urls[file("Background", t)] ?? ""),
    foreground: TIERS.map((t) => urls[file("Foreground", t)] ?? ""),
  };
}

/** Built-in heroes plus any released heroes the wiki knows about that we don't yet. */
export async function getHeroes(): Promise<{ heroes: Hero[]; added: string[] }> {
  let heroes = HEROES;
  let added: string[] = [];
  try {
    const known = new Set(HEROES.map((h) => h.name));
    const extra = (await wikiHeroes()).filter((h) => !known.has(h.name));
    heroes = [...HEROES, ...extra].sort((x, y) => x.name.localeCompare(y.name));
    added = extra.map((h) => h.name);
  } catch {}
  const pics = await portraits(heroes.map((h) => h.name));
  return { heroes: heroes.map((h) => (pics[h.name] ? { ...h, portrait: pics[h.name] } : h)), added };
}
