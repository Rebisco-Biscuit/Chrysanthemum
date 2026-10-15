# <img width="26" height="26" alt="image" src="https://github.com/user-attachments/assets/b92a734c-77f6-4d57-955d-709e7fefc7b4" /> Chrysanthemum

An AFK Journey tracker for daily/weekly tasks and hero ascension (Soul Sigils, faction and Omni-Acorns, Dimensional Soulstones). It saves to a server so the same data shows on every device.

AFK Journey has no public API, so you enter all data by hand. Each resource has a "+ add" box, so you can type what you just earned instead of working out the new total.

## Features

- **Dailies:** an editable checklist. Daily tasks reset at 00:00 UTC and weekly tasks at Monday 00:00 UTC.
- **Heroes:** all 128 ascendable heroes, with portraits from the wiki. For each one, set the tier and sigils on hand to see the next ascension cost and progress. An Ascend button deducts the cost. You can set a goal tier per hero, and the app checks the Paragon unlock gates. Crossover heroes have a "banner ended" switch that moves them to soulstone costs. Acorn steps spend the hero's faction acorns (Lightbearer, Mauler, Wilder, Graveborn) first, then Omni-Acorns.
- **Data:** export or import a JSON backup.

Cost tables come from the [AFK Journey wiki](https://afk-journey.fandom.com/wiki/Ascension). They live in `src/lib/data.ts`, which is also where you add new heroes.

## Import heroes from the game (Windows)

`npm run capture` flips through your heroes in AFK Journey, reads each hero page with Windows' built-in OCR, and writes `.data/afkj-import.json`. Load that file with **Data → Import**.

1. Set AFK Journey to borderless fullscreen and open your first hero's detail page (the one with the Ascend button).
2. Run `npm run capture` in a terminal, then switch to the game within 5 seconds.
3. Keep your hands off the mouse. The script clicks the next-hero arrow every 2–3 seconds. It stops when it reaches the first hero again, or as soon as the game isn't the window in front.
4. Read the report it prints, which is also saved in `.data/capture/report.txt`. It lists anything it couldn't read, such as counts hidden behind the "Supplement" label. The script keeps your saved value for those. Frames are saved in `.data/capture/frames/` so you can check them.

The script only takes screenshots and clicks the arrow, the same as you would by hand. It's still automated input, though, so use it sparingly. To re-run only the import step on the last capture, run `npm run capture:import`.

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
