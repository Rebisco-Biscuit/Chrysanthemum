# Chrysanthemum

An AFK Journey tracker for daily/weekly tasks and hero ascension (Soul Sigils, Omni-Acorns, Dimensional Soulstones). It saves to a server so the same data shows on every device.

AFK Journey has no public API, so you enter all data by hand.

## Features

- **Dailies:** an editable checklist. Daily tasks reset at 00:00 UTC and weekly tasks at Monday 00:00 UTC.
- **Heroes:** all 128 ascendable heroes. For each one, set the tier and sigils on hand to see the next ascension cost and progress. An Ascend button deducts the cost. You can set a goal tier per hero, and the app checks the Paragon unlock gates. Crossover heroes have a "banner ended" switch that moves them to soulstone costs.
- **Data:** export or import a JSON backup.

Cost tables come from the [AFK Journey wiki](https://afk-journey.fandom.com/wiki/Ascension). They live in `src/lib/data.ts`, which is also where you add new heroes.

## Run locally

```bash
npm install
npm run dev
```

Without Redis env vars, data is stored in `.data/state.json`. If `APP_PASSWORD` is unset, there is no login.

## Deploy to Vercel

1. Import this repo in Vercel.
2. In the project's **Storage** tab, add **Upstash for Redis** from the Marketplace. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add an `APP_PASSWORD` environment variable.
4. Redeploy.
