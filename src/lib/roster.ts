import "server-only";
import { FACTIONS, HEROES, type Faction, type Hero } from "./data";

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

/** Built-in heroes plus any released heroes the wiki knows about that we don't yet. */
export async function getHeroes(): Promise<{ heroes: Hero[]; added: string[] }> {
  try {
    const known = new Set(HEROES.map((h) => h.name));
    const extra = (await wikiHeroes()).filter((h) => !known.has(h.name));
    const heroes = [...HEROES, ...extra].sort((x, y) => x.name.localeCompare(y.name));
    return { heroes, added: extra.map((h) => h.name) };
  } catch {
    return { heroes: HEROES, added: [] };
  }
}
