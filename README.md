# The Market Witness

`The Market Witness` is a courtroom-style trade analysis app powered by `Pyth Pro / Lazer`.

The product asks one simple question:

`Did this trade deserve to be opened, held, or closed under the actual market conditions?`

## Core Flow

1. Pick a `Pyth` feed by ticker or symbol
2. Choose `buy` or `sell`
3. Enter open time and optional close time
4. Start the trial
5. Watch a courtroom hearing built on `Pyth` evidence
6. Receive the final verdict and share it

## What Makes It Different

- courtroom presentation instead of another trading dashboard
- `Pyth Pro` evidence is the mechanic, not decoration
- entry and close legs are judged separately
- AI only improves the dialogue layer; verdict logic stays deterministic

## Pyth Integration

This project currently uses `Pyth Pro / Pyth Lazer` directly:

- `getSymbols()` for feed discovery
- `getLatestPrice()` for live current-position context
- `getPrice()` for historical entry / close reconstruction

The trial engine judges trades with:

- confidence
- spread
- publisher participation
- session context
- freshness / timing
- execution-quality context

Important behavior:

- the hearing does **not** open on mock fallback data
- if required `Pyth Pro` records are unavailable, the user gets a hard stop instead of a fake trial
- the intake screen now probes historical coverage and warns when a selected date is outside the detected range for that feed

## AI Layer

`OpenRouter` is optional.

When `OPENROUTER_API_KEY` is present:

- dialogue lines are rewritten into more game-like courtroom copy
- final verdict copy is polished for readability and tone

If it is missing, the product falls back to deterministic built-in dialogue.

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required env vars:

- `PYTH_PRO_TOKEN` for real live and historical `Pyth` evidence

Optional env vars:

- `OPENROUTER_API_KEY` for AI dialogue polish
- `OPENROUTER_DIALOGUE_MODEL` to override the default model

## Production Status

- production URL: `https://market-witness-pyth-trial.vercel.app`
- `npm run typecheck` passes
- `npm run build` passes

## License

Apache 2.0. See [LICENSE](./LICENSE).
