// Emporium stock from the AFK Journey wiki (Arena/Dream/Season/Guild/Recruitment Store pages, checked 2026-11-01).
// Every Soul Sigil purchase gives 1 sigil. Update this file when the stores rotate their heroes.

import type { AcornFaction } from "./data";
import type { Period } from "./state";

export type Gives =
  | { kind: "sigil"; hero: string }
  | { kind: "acorns"; faction: AcornFaction; amount: number }
  | { kind: "soulstones"; grade: "A" | "S"; amount: number };

export type Offer = { id: string; store: string; currency: string; price: number; stock: number; period: Period; gives: Gives };

/** Sigil offers: one row per price tier in each store. */
const SIGIL_GROUPS: { store: string; currency: string; price: number; stock: number; period: Period; heroes: string[] }[] = [
  {
    store: "Arena Store", currency: "Arena Coin", price: 9600, stock: 2, period: "monthly",
    heroes: ["Cassadee", "Hewynn", "Brutus", "Rowan", "Lumont", "Igor", "Cecia", "Granny Dahnie", "Atalanta",
      "Bryon", "Alsa", "Ludovic", "Lily May", "Mikola", "Nara", "Tasi", "Hodgkin", "Sonja", "Lorsan", "Cyran",
      "Shemira", "Indris", "Daimon", "Velara", "Zandrok", "Pang", "Ravion"],
  },
  {
    store: "Dream Store", currency: "Dream Fragment", price: 1200, stock: 16, period: "monthly",
    heroes: ["Valen", "Mirael", "Marilee", "Odie", "Seth", "Arden", "Lyca", "Lucius", "Damian", "Kruger",
      "Korin", "Kafra", "Satrana", "Niru", "Silvina", "Salazer", "Parisa", "Fay", "Viperian", "Antandra",
      "Walker", "Koko", "Soren", "Ulmus", "Lenya", "Sinbad", "Lucca", "Hugin", "Bonnie", "Valka", "Callan",
      "Gerda", "Faramor", "Thador", "Zanie"],
  },
  {
    store: "Season Store", currency: "Season Token", price: 9600, stock: 2, period: "monthly",
    heroes: ["Perseus", "Nazrik", "Galahad", "Solise", "Zorya", "Pippa", "Hepler", "Gwyneth", "Peggy", "Orion"],
  },
  {
    store: "Season Store", currency: "Season Token", price: 1200, stock: 16, period: "monthly",
    heroes: ["Isabella", "Shadewing", "Tilaya", "Kordan", "Silven", "Evie", "Nerion", "Kazim"],
  },
  {
    store: "Guild Store", currency: "Guild Medal", price: 30000, stock: 6, period: "monthly",
    heroes: ["Berial", "Scarlita", "Dionel", "Reinier", "Phraesto", "Talene", "Dunlingr", "Harak",
      "Elijah & Lailah", "Cryonaia", "Athalia", "Kulu", "Baelran", "Saida", "Aliceth", "Mehira", "Alna",
      "Aurora", "Gunnar", "Contess", "Sylphira", "Lamentis", "Rolan", "Aster", "Marene"],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const SIGIL_OFFERS: Offer[] = SIGIL_GROUPS.flatMap((g) =>
  g.heroes.map((hero) => ({
    id: `${slug(g.store)}:${slug(hero)}`,
    store: g.store, currency: g.currency, price: g.price, stock: g.stock, period: g.period,
    gives: { kind: "sigil" as const, hero },
  })),
);

const FACTIONS: AcornFaction[] = ["Lightbearer", "Mauler", "Wilder", "Graveborn"];

/** Acorn and Dimensional Soulstone offers. */
export const RESOURCE_OFFERS: Offer[] = [
  ...FACTIONS.map((faction): Offer => ({
    id: `recruitment-store:${slug(faction)}-acorn`, store: "Recruitment Store", currency: "Dolly Ticket", price: 270, stock: 99,
    period: "monthly", gives: { kind: "acorns", faction, amount: 5 },
  })),
  ...FACTIONS.map((faction): Offer => ({
    id: `guild-store:${slug(faction)}-acorn`, store: "Guild Store", currency: "Diamond", price: 180, stock: 1,
    period: "daily", gives: { kind: "acorns", faction, amount: 5 },
  })),
  { id: "recruitment-store:soulstone-a", store: "Recruitment Store", currency: "Dolly Ticket", price: 68, stock: 72, period: "monthly", gives: { kind: "soulstones", grade: "A", amount: 10 } },
  { id: "recruitment-store:soulstone-s", store: "Recruitment Store", currency: "Dolly Ticket", price: 550, stock: 12, period: "monthly", gives: { kind: "soulstones", grade: "S", amount: 10 } },
  { id: "season-store:soulstone-a", store: "Season Store", currency: "Diamond", price: 500, stock: 60, period: "monthly", gives: { kind: "soulstones", grade: "A", amount: 1 } },
  { id: "season-store:soulstone-s", store: "Season Store", currency: "Diamond", price: 4000, stock: 9, period: "monthly", gives: { kind: "soulstones", grade: "S", amount: 1 } },
];

/** Currencies in the order the Emporium tab shows them. */
export const CURRENCIES = ["Arena Coin", "Dream Fragment", "Season Token", "Guild Medal", "Dolly Ticket", "Diamond"];
