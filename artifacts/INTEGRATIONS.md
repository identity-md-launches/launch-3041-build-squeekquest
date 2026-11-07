# Squeekchain integration evidence

The current wallet, NFT, ranking and receipt integration is documented in [INTEGRATIONS-WEB3.md](INTEGRATIONS-WEB3.md). The notes below describe the preserved Chain Pulse game adapter. Earlier transport observations are historical; current browser coverage is in [validation.md](validation.md).

Runtime source: `src/lib/api.ts`, `src/hooks/use-chain.ts`, `src/lib/chain-pulse.ts`, `src/components/chain-pulse.tsx`.

The core adventure uses five public GET endpoints without requiring a wallet, token flow, private key, backend or paid service. Normal gameplay polls only status, core, blocks, measurement events and seven-day stats; the optional Web3 panels perform additional documented reads. Exact endpoint URLs, schema versions and actual validation results are in `api-check.json`.

## Settlement boundary

Only validated `/v1/core` values can advance the persistent height cursor. The installation, pinned Sepolia core identity, at least 12 safe confirmations, source block ≤ safe-through block, and available status must validate. Cumulative block units must agree with height when provided. A successful core read expires after 90 seconds. `/measurement/blocks` projected height is displayed as optimistic and is never a reward input.

First connection establishes a baseline. New heights schedule one deterministic, unique world encounter each; the durable cursor prevents re-emission. Queues are bounded to 12 active encounters, with at most four materialized per successful poll and the remaining confirmed target retained. Regressing snapshots cannot advance a queued target. Completed encounters, old imports, repeated polls, restart and display-journal pruning are covered by unit and interaction checks. A separate local ledger survives new game. Web Locks serialize reward mutations when available; the complete adventure save is intended for one active tab.

## Provenance and measurement receipts

Current telemetry preserves the official provenance label. Stale/missing/failing telemetry is Unknown, not zero. A real reported zero RPM is permitted when a fresh official reading reports it. Core heights are confirmed chain state, not proof of physical wheel movement.

The official measurement category returns `source.kind = measurement` with accepted receipt cursors, telemetry IDs and timestamps. This differs from the legacy chain-event schema and has a dedicated validator. The observed public receipts did not contain provenance; the UI says “Provenance not supplied”. Dates are retained. Record grants 45 local game XP once per receipt. It does not claim current hardware movement or create a blockchain reward. Activity summaries disclose derived provenance and incomplete coverage.

## Actual verification and transport limitation

`api-check.json` records actual public Node HTTP requests, HTTP-success schema validation and record counts. The required five endpoints were available. Curl also returned HTTP 200 and an `Access-Control-Allow-Origin: *` header. API availability was not inferred from a fixture.

Direct Chromium API traffic in this environment returned `net::ERR_EMPTY_RESPONSE`. The runtime correctly displayed Unknown and continued gameplay. A separate browser-test context forwards unchanged real official responses using Node's working HTTP transport. This confirms actual-response parsing and rendering, with requests and timestamps recorded in `browser-chromium.json`. That adapter exists only in the test script. The production site still fetches the official public API directly; no backend or adapter is shipped.

Controlled browser tests deliberately change captured fixture heights to exercise new settlements, projections, deduplication, rate limits and offline states. Those are explicitly synthetic test transitions. No organically occurring new settled block was observed during the check window, and none is claimed. No API response, measurement, transaction or blockchain reward was fabricated for the runtime or represented as live test evidence.

The supplied browser connector could not initialize (“Socket path too long”); standalone Chromium supplied rendering evidence. WebKit could not start because required runtime libraries were unavailable. These are verification limitations, not claims that the official API is down.
