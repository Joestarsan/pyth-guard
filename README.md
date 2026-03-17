# The Market Witness

`The Market Witness` is a courtroom-style trade analysis demo powered by Pyth evidence.

The product asks a simple question:

`Did this trade deserve to be opened or closed under the actual market conditions?`

## What It Does

The app lets a trader file a case with:
- asset
- side
- open time
- close time or current-position status
- optional size, leverage, entry price, and close price

It then stages a trial:
- `Judge Opening`
- `Prosecutor vs Defense` hearing
- `Pyth proof cards` one beat at a time
- final verdict and detailed case dossier

## Pyth Integration

This project currently uses `Pyth Pro / Pyth Lazer` in three ways:
- symbol discovery with `getSymbols()`
- live market snapshots with `getLatestPrice()`
- historical market reconstruction with `getPrice()`

The trial engine uses these inputs to judge entry and exit quality:
- confidence
- spread
- publisher participation
- market session
- feed freshness
- reference price context

If `PYTH_PRO_TOKEN` is missing or entitlements are limited, the app falls back to a demo-safe mock path so the experience stays usable.

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `PYTH_PRO_TOKEN` in `.env.local` to enable live and historical Pyth-backed evidence.

Optional:
- `OPENROUTER_API_KEY` is only needed for the portrait generation script in `scripts/generate-courtroom-portraits.mjs`

## Status

Current app state:
- court-only product flow on `/`
- historical `entry + close/current` case analysis
- pixel courtroom presentation
- character portraits and courtroom audio cues
- production build and typecheck passing

## License

Apache 2.0. See [LICENSE](./LICENSE).
