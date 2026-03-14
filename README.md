# Pyth Guard

`Pyth Guard` is a real-time execution trust copilot powered by Pyth Pro.

It answers a different question than a normal trading dashboard:

`Is this market trustworthy enough to execute right now?`

## Project Status

Early build stage.

This public repository will contain only the product itself and public-facing project materials.

Current milestone:
- live `Pyth Guard` dashboard scaffolded in Next.js
- trust engine, flags, and execution policy wired into the main UI
- courtroom-style `Market Witness` replay mode implemented
- live `Pyth Pro` path wired with a visible warm-up and mock fallback state

## Why This Exists

Most trading tools focus on price direction.

Pyth provides richer market structure signals:
- confidence
- spread
- publisher participation
- market session context

`Pyth Guard` turns those signals into a real-time trust layer for execution decisions.

## Planned MVP

- live `Trust Score`
- risk flags:
  - `Confidence Spike`
  - `Liquidity Stress`
  - `Publisher Drop`
- concrete execution guidance
- one polished courtroom replay powered by the same trust engine

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

If you have a `Pyth Pro` key, set `PYTH_PRO_TOKEN` in `.env.local`.

The app is intentionally demo-safe:
- with a working latest-price entitlement, the dashboard shows `Pyth Pro Live`
- while the live baseline is still calibrating, it shows `Pyth Pro Warm-up`
- if the key is missing or latest-price access is unavailable, it falls back to the local scenario stream and stays usable for demos

## Pyth Inputs

- Price Feeds:
  - `price`
  - `conf`
  - `ema_price`
  - `publish_time`
- Pyth Pro:
  - `confidence`
  - `bestBidPrice`
  - `bestAskPrice`
  - `publisherCount`
  - `marketSession`
  - `feedUpdateTimestamp`

## License

Apache 2.0. See [LICENSE](./LICENSE).
