# Pyth Guard

`Pyth Guard` is a real-time execution trust copilot powered by Pyth Pro.

It answers a different question than a normal trading dashboard:

`Is this market trustworthy enough to execute right now?`

## Project Status

Early build stage.

This public repository will contain only the product itself and public-facing project materials.

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
