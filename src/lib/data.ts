// Game data from https://afk-journey.fandom.com/wiki/Ascension (checked 2026-10-12).
// New releases are also picked up at runtime from the wiki; see roster.ts.

export const TIERS = [
  "Elite",
  "Elite+",
  "Epic",
  "Epic+",
  "Legendary",
  "Legendary+",
  "Mythic",
  "Mythic+",
  "Supreme",
  "Supreme+",
  "Paragon 1",
  "Paragon 2",
  "Paragon 3",
  "Paragon 4",
] as const;

export const SUPREME_PLUS = 9;
export const MAX_TIER = TIERS.length - 1;

export type Faction =
  | "Lightbearer"
  | "Mauler"
  | "Wilder"
  | "Graveborn"
  | "Celestial"
  | "Hypogean"
  | "Dimensional";

export const FACTIONS: Faction[] = [
  "Lightbearer",
  "Mauler",
  "Wilder",
  "Graveborn",
  "Celestial",
  "Hypogean",
  "Dimensional",
];

/** A = A-level, S = S-level, CH = Celestial/Hypogean (S-level with its own table). */
export type CostTable = "A" | "S" | "CH";

/** Cost to reach a tier: own Soul Sigils, or Omni-Acorns. null = not reachable by ascension. */
export type Cost = { sigils: number } | { acorns: number } | null;

const s = (n: number): Cost => ({ sigils: n });
const a = (n: number): Cost => ({ acorns: n });

// Index = target tier (see TIERS). The first non-null entry is the cost of acquiring the hero.
export const COSTS: Record<CostTable, Cost[]> = {
  A: [s(1), s(1), s(3), s(4), s(5), s(8), s(10), s(12), a(200), s(20), s(45), s(45), s(68), s(68)],
  S: [null, null, s(1), s(1), a(50), s(2), a(100), s(2), a(200), s(2), s(6), s(6), s(9), s(9)],
  CH: [null, null, s(1), s(1), s(1), s(1), s(2), s(2), s(2), s(4), s(4), s(4), s(6), s(6)],
};

/** Crossover heroes whose banner has ended use Dimensional Soulstones at this rate per sigil. */
export const SOULSTONE_RATE = 3;

/** Paragon N needs this many heroes at the tier before it, account-wide. */
export const PARAGON_GATES: { tier: number; needs: number; from: number }[] = [
  { tier: 10, needs: 25, from: 9 },
  { tier: 11, needs: 20, from: 10 },
  { tier: 12, needs: 15, from: 11 },
  { tier: 13, needs: 15, from: 12 },
];

export type Hero = {
  name: string;
  faction: Faction;
  costs: CostTable;
  /** Crossover Dimensional hero: switches to Dimensional Soulstones after the banner ends. */
  crossover?: true;
};

export const startTier = (h: Hero) => (h.costs === "A" ? 0 : 2);
export const grade = (h: Hero) => (h.costs === "A" ? "A" : "S");

export const HEROES: Hero[] = [
  { name: "Aliceth", faction: "Celestial", costs: "CH" },
  { name: "Alna", faction: "Celestial", costs: "CH" },
  { name: "Alsa", faction: "Mauler", costs: "S" },
  { name: "Antandra", faction: "Mauler", costs: "A" },
  { name: "Arden", faction: "Wilder", costs: "A" },
  { name: "Aster", faction: "Hypogean", costs: "CH" },
  { name: "Atalanta", faction: "Lightbearer", costs: "S" },
  { name: "Athalia", faction: "Celestial", costs: "CH" },
  { name: "Aurora", faction: "Celestial", costs: "CH" },
  { name: "Baelran", faction: "Celestial", costs: "CH" },
  { name: "Berial", faction: "Hypogean", costs: "CH" },
  { name: "Bonnie", faction: "Graveborn", costs: "A" },
  { name: "Brutus", faction: "Mauler", costs: "S" },
  { name: "Bryon", faction: "Wilder", costs: "S" },
  { name: "Callan", faction: "Graveborn", costs: "A" },
  { name: "Carolina", faction: "Graveborn", costs: "S" },
  { name: "Cassadee", faction: "Lightbearer", costs: "S" },
  { name: "Cecia", faction: "Graveborn", costs: "S" },
  { name: "Contess", faction: "Hypogean", costs: "CH" },
  { name: "Cryonaia", faction: "Hypogean", costs: "CH" },
  { name: "Cyran", faction: "Lightbearer", costs: "S" },
  { name: "Daimon", faction: "Graveborn", costs: "S" },
  { name: "Damian", faction: "Wilder", costs: "A" },
  { name: "Dionel", faction: "Celestial", costs: "CH" },
  { name: "Dunlingr", faction: "Celestial", costs: "CH" },
  { name: "Eironn", faction: "Wilder", costs: "S" },
  { name: "Elijah & Lailah", faction: "Celestial", costs: "CH" },
  { name: "Eryndor", faction: "Graveborn", costs: "S" },
  { name: "Estrilda", faction: "Lightbearer", costs: "A" },
  { name: "Evie", faction: "Lightbearer", costs: "A" },
  { name: "Faramor", faction: "Wilder", costs: "A" },
  { name: "Fay", faction: "Lightbearer", costs: "A" },
  { name: "Florabelle", faction: "Wilder", costs: "S" },
  { name: "Frieren", faction: "Dimensional", costs: "S", crossover: true },
  { name: "Galahad", faction: "Mauler", costs: "S" },
  { name: "Gerda", faction: "Mauler", costs: "A" },
  { name: "Granny Dahnie", faction: "Wilder", costs: "S" },
  { name: "Gunnar", faction: "Hypogean", costs: "CH" },
  { name: "Gwyneth", faction: "Lightbearer", costs: "S" },
  { name: "Harak", faction: "Hypogean", costs: "CH" },
  { name: "Hepler", faction: "Mauler", costs: "S" },
  { name: "Hewynn", faction: "Wilder", costs: "S" },
  { name: "Himmel", faction: "Dimensional", costs: "A", crossover: true },
  { name: "Hodgkin", faction: "Graveborn", costs: "S" },
  { name: "Hugin", faction: "Lightbearer", costs: "A" },
  { name: "Igor", faction: "Graveborn", costs: "S" },
  { name: "Indris", faction: "Wilder", costs: "S" },
  { name: "Isabella", faction: "Graveborn", costs: "A" },
  { name: "Kafra", faction: "Wilder", costs: "A" },
  { name: "Karma", faction: "Graveborn", costs: "A" },
  { name: "Kazim", faction: "Mauler", costs: "A" },
  { name: "Koko", faction: "Mauler", costs: "A" },
  { name: "Kordan", faction: "Mauler", costs: "A" },
  { name: "Korin", faction: "Lightbearer", costs: "A" },
  { name: "Kruger", faction: "Mauler", costs: "A" },
  { name: "Kulu", faction: "Hypogean", costs: "CH" },
  { name: "Laios", faction: "Dimensional", costs: "A", crossover: true },
  { name: "Lamentis", faction: "Hypogean", costs: "CH" },
  { name: "Lenya", faction: "Wilder", costs: "A" },
  { name: "Lily May", faction: "Wilder", costs: "S" },
  { name: "Lorsan", faction: "Wilder", costs: "S" },
  { name: "Lucca", faction: "Lightbearer", costs: "A" },
  { name: "Lucius", faction: "Lightbearer", costs: "A" },
  { name: "Lucy", faction: "Dimensional", costs: "A", crossover: true },
  { name: "Ludovic", faction: "Graveborn", costs: "S" },
  { name: "Lumont", faction: "Mauler", costs: "S" },
  { name: "Lyca", faction: "Wilder", costs: "A" },
  { name: "Marcille", faction: "Dimensional", costs: "S", crossover: true },
  { name: "Marilee", faction: "Lightbearer", costs: "A" },
  { name: "Mehira", faction: "Hypogean", costs: "CH" },
  { name: "Mikola", faction: "Mauler", costs: "S" },
  { name: "Mirael", faction: "Lightbearer", costs: "A" },
  { name: "Nara", faction: "Graveborn", costs: "S" },
  { name: "Natsu", faction: "Dimensional", costs: "S", crossover: true },
  { name: "Nazrik", faction: "Mauler", costs: "S" },
  { name: "Nerion", faction: "Graveborn", costs: "A" },
  { name: "Niru", faction: "Graveborn", costs: "A" },
  { name: "Odie", faction: "Mauler", costs: "A" },
  { name: "Orion", faction: "Lightbearer", costs: "S" },
  { name: "Pandora", faction: "Dimensional", costs: "S" },
  { name: "Pang", faction: "Wilder", costs: "S" },
  { name: "Parisa", faction: "Wilder", costs: "A" },
  { name: "Peggy", faction: "Lightbearer", costs: "S" },
  { name: "Perseus", faction: "Lightbearer", costs: "S" },
  { name: "Phraesto", faction: "Hypogean", costs: "CH" },
  { name: "Pippa", faction: "Wilder", costs: "S" },
  { name: "Ravion", faction: "Wilder", costs: "S" },
  { name: "Reinier", faction: "Hypogean", costs: "CH" },
  { name: "Rhys", faction: "Mauler", costs: "S" },
  { name: "Rolan", faction: "Celestial", costs: "CH" },
  { name: "Rowan", faction: "Lightbearer", costs: "S" },
  { name: "Saida", faction: "Hypogean", costs: "CH" },
  { name: "Salazer", faction: "Graveborn", costs: "A" },
  { name: "Satrana", faction: "Mauler", costs: "A" },
  { name: "Scarlita", faction: "Celestial", costs: "CH" },
  { name: "Senea", faction: "Graveborn", costs: "S" },
  { name: "Seth", faction: "Mauler", costs: "A" },
  { name: "Shadewing", faction: "Graveborn", costs: "A" },
  { name: "Shakir", faction: "Mauler", costs: "S" },
  { name: "Shemira", faction: "Graveborn", costs: "S" },
  { name: "Silven", faction: "Lightbearer", costs: "A" },
  { name: "Silvina", faction: "Graveborn", costs: "A" },
  { name: "Sinbad", faction: "Lightbearer", costs: "A" },
  { name: "Smokey & Meerky", faction: "Mauler", costs: "S" },
  { name: "Solise", faction: "Wilder", costs: "S" },
  { name: "Sonja", faction: "Lightbearer", costs: "S" },
  { name: "Soren", faction: "Mauler", costs: "A" },
  { name: "Sylphira", faction: "Celestial", costs: "CH" },
  { name: "Taichi & Agumon", faction: "Dimensional", costs: "S", crossover: true },
  { name: "Talene", faction: "Celestial", costs: "CH" },
  { name: "Tasi", faction: "Wilder", costs: "S" },
  { name: "Temesia", faction: "Lightbearer", costs: "S" },
  { name: "Thador", faction: "Wilder", costs: "A" },
  { name: "Thoran", faction: "Graveborn", costs: "S" },
  { name: "Tilaya", faction: "Wilder", costs: "A" },
  { name: "Ulmus", faction: "Wilder", costs: "A" },
  { name: "Vala", faction: "Lightbearer", costs: "S" },
  { name: "Valen", faction: "Lightbearer", costs: "A" },
  { name: "Valka", faction: "Graveborn", costs: "A" },
  { name: "Velara", faction: "Wilder", costs: "S" },
  { name: "Viperian", faction: "Graveborn", costs: "A" },
  { name: "Voracia", faction: "Mauler", costs: "S" },
  { name: "Walker", faction: "Lightbearer", costs: "A" },
  { name: "Yamato & Gabumon", faction: "Dimensional", costs: "S", crossover: true },
  { name: "Zandrok", faction: "Mauler", costs: "S" },
  { name: "Zanie", faction: "Lightbearer", costs: "A" },
  { name: "Zorya", faction: "Graveborn", costs: "S" },
];
