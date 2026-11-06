# SqueekChain integration record

All production reads use the official [API](https://api.squeekchain.com/v1/status). No RPC or signing call is made. The app follows the [published deployment](https://docs.squeekchain.com/developers/) on Ethereum Sepolia (11155111), release `core-sepolia-20261103`, revision 7, protocol `staged-launch-1`, reward model `funded-stream-q128-1`.

## Deployment pins

These are documented public contracts, not deployment parameters supplied by the worker.

| Component | Sepolia address |
| --- | --- |
| SqueekCore | `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4` |
| SqueekNFT | `0xc4c7982657f00509548f3a3a41db7fa439a6856b` |
| SqueekToken | `0xd78a3956cf63164d1fa1c622ad3c66623162fa1e` |
| SqueekMining | `0x2dccb11fcc2defdd188555e45acb52231e82e218` |
| SqueekStaking | `0x50fd1780526c3186a0c037c7622203bc4fb611ca` |

The source of truth is `src/lib/api.ts`. A deployment change deliberately fails closed until a maintainer reviews the new official release and updates the pins and validation fixtures.

## Reads and validation

| Read | Expected schema | Consumed data and checks |
| --- | --- | --- |
| `GET /status` | 1 | Expected installation, ISO timestamps, numeric device measurements, recognized freshness/provenance/core states, oracle state |
| `GET /core` | 1 | Sepolia, at least 12 reported confirmations, expected Core identity, unsigned work/height/round strings, block progress below 1 billion |
| `GET /measurement/blocks` | `game-block-projection.v1` | Expected Core and Sepolia, recognized freshness, typed anchor/projection, unsigned projected heights and work thresholds |
| `GET /measurement/stats?range=7d` | 1 | Expected installation, typed totals/days, bounded coverage basis points, exact unsigned work units |
| `GET /events?limit=20` | 4 | Release, installation and deployment pins; safe chain sources; supported contract addresses; source block no greater than the safe frontier; typed hashes/log indices and payload |
| `GET /economy/state` | 3 | Deployment/release/chain pins, SQK token address and 18 decimals, unsigned supply/staking/NFT totals |
| `GET /settlements?range=24h` | 3 | Expected installation/chain, safe confirmations/frontier, typed transaction/hash/issuance data and consistent completed block ranges |
| `GET /squeeks/{id}` | 3 | ID 1–9999, response ID equals request, supported deployment/chain/release, owner format, level/power, recognized metadata shape and trait types |

Validation covers consumed fields through Zod projections. It is not presented as full validation against every upstream JSON Schema. Safe source fields and contract pins are provenance claims from the official API; the application does not independently fetch receipts, bytecode or state proofs. Transaction and Ethereum block links let a visitor inspect the public record in Blockscout.

Chain and token integers remain decimal strings until converted to `BigInt`. SQK formatting divides by 10^18 and truncates the displayed fractional part without floating-point conversion. Bounded ratios and hardware display readings use ordinary numbers.

## Mission evidence

| Quest | Required action | Persisted evidence | Local XP |
| --- | --- | --- | --- |
| A pocketful of sunshine | Complete a playable forage and return home | Actual seeds collected and active run seconds | 80/day |
| Follow the wheel | Reach Wheel works and inspect a validated recent settlement | Full transaction hash, log index, completed Squeek block range | 120/day |
| A signal in the valley | Reach the Signal station and inspect a validated safe event | Full transaction hash, log index, event type | 150/day |
| Make a Squeek friend | Reach Squeek grove and look up an actual Squeek | Token ID, safe Ethereum block, owner | 100/day |
| A balanced little day | Finish a forage plus at least one chain discovery | Local completion record | 50/day |

Station visits are an in-session gameplay prerequisite. A reload keeps earned progress but requires another station visit before another chain claim. Settlement/event claims require a successful resource check within 90 seconds with no current error, and the inspected record must still be in the current validated response. NFT observations require a response generated within 90 seconds. The game awards no token or financial entitlement. Discovery quests can inspect an already-existing real record; they do not claim to cause that chain event or mint a new block.

## Refresh, failure and persistence

`useChain` fetches the seven shared data sources in parallel and keeps endpoint errors independent. It polls fast sources at 30-second intervals while the document is visible and statistics every 120 seconds. Requests use 12-second abort timeouts. The client caches fast responses for at least 5 seconds, statistics for 60 seconds, uses exposed ETags, and respects bounded `Retry-After` cooldowns for 429/503 responses. Manual retry is available; repeated clicks cannot bypass the cooldown.

HTTP-200 `status: unavailable`, wrong versions, malformed payloads and unsupported deployments are errors, never zeros. A prior successful response is retained as stale and cannot unlock a chain quest. Provisional blocks are displayed only as optimistic projections. Missing chart coverage is explicitly hatched/labeled. The chart's device days start at 12:00 UTC, independently of the game's 00:00 UTC daily reset.

Game state is stored as `squeekquest.v1` in localStorage. Parsing is bounded and schema-validated; invalid state starts a fresh local explorer. Storage failure displays a notice and play continues in memory. Saves retain 50 runs and 1,000 receipts, preserve archived lifetime XP and permanent achievement IDs, and can be downloaded as JSON. Nothing is sent to a leaderboard service or user account endpoint.

## Live evidence and remaining scope

`artifacts/api-check.json` records eight actual successful requests and application validation results. Browser checks also load real responses and exercise settlement, event and NFT quest claims. Offline fixture tests use captured 2026-11-06 responses; fixtures are not bundled into the website. A separate browser context injects a 503 outage only for a labeled error-handling test.

The application is a community exploration tool, not an official SqueekChain application. It has no shared backend, account authentication, independent chain verifier, trading, minting, staking transaction or reward distribution mechanism. The static deployment and public source URL are publication handoffs, not URLs invented by this delivery.
