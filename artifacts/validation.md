# SqueekQuest Web3 validation

Worker review completed 2026-11-07. This is a record of local checks, not an independent certification. The existing game was extended directly. The final production export is `dist/`; publication is performed by the assignment's publisher after submission. No site-publish command or blockchain deployment was run.

## Result

| Area | Actual result |
| --- | --- |
| Existing game | Preserved; 19/19 interaction scenarios in Chromium and 19/19 in WebKit |
| Web3 interactions | 9/9 in Chromium and 9/9 in WebKit |
| Unit/security checks | 68/68 passed |
| Live official API schemas | 9/9 passed, HTTP 200 |
| Static export | 44 files, 2,389,314 bytes; 28 document/CSS references checked; no missing or root-absolute assets |
| Pinned taste probe | 16/16 passed |
| Automated accessibility | 48 existing-game views + 28 wallet/Web3 views; zero reported WCAG violations or overflow |
| Focus, font, contrast, text reflow | 9/9 quality checks passed; 200% text enlargement at 320, 390, 768 and 1440 |
| SDK rebuild | Exact dependency graph rebuilt successfully; runtime assets byte-identical |
| Delivery size | Below 8,388,608 bytes; exact final count in `submission-budget.json` |

No fabricated players, chain activity, NFT ownership, transaction confirmation, token reward or eligibility result is shipped. Controlled transport/provider scenarios are explicitly test-only. The site offers a real public on-chain activity leaderboard; global game-score rankings and several requested attribution/eligibility features are unavailable from the official services.

## Scope and implementation decisions

The existing Next.js/React/TypeScript project, top-down pixel renderer, Forest, Ancient Ruins, Wilderness, Underground Cave, combat, Root Warden, resource gathering, crafting, building, daily/story quests, skills, minigame, migration and local saves remain. The world/physics/progression implementations were not replaced. The API adapter changed only to accept a documented optional issuance field on confirmed settlements.

Official Squeekchain documentation and deployment/API/ABI records were inspected before implementation. The supported release is Sepolia chain 11155111, `core-sepolia-20261103`, revision 7. References and contract pins are in `INTEGRATIONS-WEB3.md`; public examples and read results are in `VERIFIED-EXAMPLES.md` and `web3-live-examples.json`.

The protected root package manifest, lockfile and existing build configuration were left unchanged. Dependencies were installed in a disposable mirror under `test/scratch/build`; the existing typecheck/build commands ran there, and its final clean export was copied to `dist/`. Source equality and hashes are recorded in `build-check.json`. Wallet SDK assets have a separate reproducible browser build and exact dependency graph, without a vendored registry or dependency archive. No root `node_modules`, private configuration, service credential, submodule or ignore-file change is delivered.

## Requirement coverage

| Brief requirement | Implemented result / honest boundary |
| --- | --- |
| Connect / disconnect wallet | EIP-6963 discovery, generic browser fallback, phone app links, Coinbase SDK and passkey option; connection/address/status, rejection recovery and reconnect |
| Network detection and switching | Sepolia mismatch state; switch request and add-chain fallback with published RPC/explorer metadata |
| Ownership verification | Explicit origin/path-bound message, random nonce, chain, issue/expiry times; ten-minute in-memory proof, cleared on address/network changes or reload |
| Real hamster status and sensors | Existing validated telemetry, freshness and provenance preserved; Unknown on missing/stale/error; no optimistic projection rewards |
| Settlements and transaction evidence | Safe official settlement history, canonical receipts, typed official event decoding, complete parties/block/time/hash and explorer links |
| Player profile | Wallet, hamster avatar, local name/level/XP/game achievements/story quests, verified field notes, public history and real NFT counts; another wallet's private game progress is unavailable |
| Global leaderboard | Public safe account actions and unique transactions; daily UTC, Monday-based weekly and available all-time windows; ranks, avatars, short addresses, profile links and minute refreshes; partial scan coverage disclosed |
| XP / level / quest / run / settlement game rankings | No official shared game-score authority or player ownership of hamster work. Game view shows only the local record and explains the unavailable global rankings |
| Transaction checker | Hash and wallet search; Pending, Confirmed, Failed and Not found; 12-confirmation gate; canonical block identity; event details; pending refresh; independent reward recheck |
| Duplicate reward protection | Separate durable hash journal, global across wallets on this device; Web Locks when available; survives new games/imported older game saves; no score from this journal enters on-chain rankings |
| Quest categories and achievements | Game, Hamster and On-chain journal entries; real evidence links; once-per-receipt local XP/stamina; settlement/active-round badges |
| Official quest transactions or token rewards | No official SqueekQuest quest contract exists. No token reward, NFT mint or new contract is invented or deployed |
| NFTs | Official account custody pagination and Squeek metadata; wallet and Staking custody distinguished |
| Genesis eligibility | Requires the official authenticated Community account; game score/signature cannot establish it. Official Genesis link provided; no eligibility certificate or authorization fabricated |
| Desktop/mobile UI | Original visual identity retained; first-screen game and Start/Connect actions at 390; responsive tools, hash profile routes and native modals |
| Security | Public reads and voluntary message signing only. No private-key/seed inputs, stored signatures, token approvals or transaction broadcast; no paid services or upgrades |
| Public delivery | Complete relative static export ready for the publisher; this session did not change the hosted version itself |

## Commands and evidence

Final production-source changes were followed by `npm run typecheck` and `npm run build` in the isolated build mirror: both exited 0. The production build also ran Next's TypeScript check and completed static page export. `node scripts/check-export.mjs` exited 0 against the final root export.

| Command | Evidence | Outcome |
| --- | --- | --- |
| `node scripts/check-unit.mjs` | `unit-tests.json` | 68 tests, no failures |
| `npm run test:api` | `api-check.json` | All nine official endpoint validators passed |
| `node scripts/check-browser.mjs` | `browser-chromium.json` | 19/19, no page errors or missing local resources |
| `node scripts/check-browser.mjs --webkit` | `browser-webkit.json` | 19/19, no page errors or missing local resources |
| `node scripts/check-web3.mjs` | `web3-chromium.json` | 9/9; real safe settlement reward and reload deduplication, NFT custody, rankings, adverse states and simulated wallet flows |
| `node scripts/check-web3.mjs --webkit` | `web3-webkit.json` | 9/9 against the same production export |
| `node scripts/check-accessibility.mjs` | `accessibility.json` | 48 views, zero violations/overflow |
| `node scripts/check-web3-accessibility.mjs` | `web3-accessibility.json` | 28 views, zero violations/overflow |
| `node scripts/check-quality.mjs` | `quality.json`, `contrast.json` | Font, keyboard/modal focus, 16 measured color pairs and four text-enlargement widths passed |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | `taste.json` | All 16 checks passed |
| `node scripts/rebuild-wallet.mjs` | `wallet-rebuild.json` | Exit 0; byte-identical SDK runtime |
| `node scripts/check-budget.mjs` | `submission-budget.json` | Complete deliverable below 8 MiB; no archives, generated dependency directories or symlinks |

Compatible locally installed browser executables/modules were selected for this machine. The supplied browser connector could not initialize because its Chrome distribution was absent. Standalone Playwright Chromium and WebKit supplied the actual rendering and interaction evidence. Required WebKit runtime libraries were extracted only into disposable scratch space; no system/repository dependency configuration was changed.

The game browser suite exercises movement, collision, resource use/discard, crafting, equipment, all four structures, combat, boss defeat, quests/skills, cave return navigation, recovery, rename, sound/theme, map, minigame, import/export/reload/restart, storage denial, rate limits, Pulse provenance and deduplication. Chromium uses real browser time. WebKit combat advances the browser clock through full attack cooldowns because capped simulation time progresses more slowly under software rendering; game state, damage, kill and XP assertions are unchanged. This is not a physical-device performance test. Canceled document/HEAD availability requests during teardown are recorded separately from genuine missing local assets.

The Web3 suite uses unchanged responses from the real official services for settlements, explorer receipts, profiles, NFTs and rankings. Its adverse-state cases deliberately alter captured RPC responses and are labeled controlled. Its EIP-6963 provider and signer are test-only: the signer is generated in memory, no private key is written, and no real transaction is submitted. Connect rejection, chain add/switch, proof signing/recovery, account-change invalidation, disconnect, phone link rows, Escape/focus return and pending auto-refresh are exercised. A backend, relay, test-response adapter or fixture is not included in the runtime export.

## Better Interface review

Visual idea: a pixel-art hamster survival world, with the existing forest-and-oat controls carrying both the adventure and verifiable public wheel evidence.

The pinned workflow and the core principles of all six domains were applied during implementation. The review used the final source, the served production export at `/preview/`, screenshots, actual interactions and the pinned measurements.

| Domain | Coverage | Limits |
| --- | --- | --- |
| Accessibility | Checked: native controls/dialogs, unique heading IDs, visible form labels, announced errors/status, keyboard flow, Escape/focus return, reduced motion, 76 axe views | No screen-reader session, physical touch-device session or accessibility certification |
| Layout | Checked: first 390 screen, 320/390/768/1440 reflow, wide/mobile tools, long addresses/hashes, pending/error/empty/success states, 200% text enlargement | Not native browser zoom or localized RTL |
| Writing | Checked: actions name their purpose, unknown/pending/confirmed distinctions, local reward labels, partial ranking coverage, honest missing-service states, official source labels | Vendor wallet popup copy is outside this app |
| Typography | Checked: locally loaded Nunito Sans, six existing size tokens, weights 400/600/800, numeric stability, wrapping data; probe passed | No added localization/font variants |
| Colors | Checked: existing semantic tokens, light/dark views, 16 computed solid-background text pairs; measured minimum 4.54:1 among those pairs | Canvas/image/gradient pixels are not universally measured; probe reports 11 such first-screen text boxes unmeasured |
| UI | Checked: shared surfaces/icons/buttons, first-screen actions, responsive wallet sheet, selected/disabled/loading/empty/error/success states and reduced motion | Hover/pressed rules were source-reviewed; no slow-motion animation-panel review or native wallet/passkey enrollment |

The first 390 screenshot visibly contains the product, the game scene, Start adventure and Connect wallet. The final probe measured 23 first-screen prose words, no horizontal overflow or text overlap at 320/390/1440, no clipped text, no failing target-spacing check, and complete share metadata. Six sizes and three weights remain in the established system. Sixteen targets are below the comfortable 44px size but meet the probe's WCAG baseline/spacing test; they are not reported as 44px targets.

### Findings fixed

| Severity / source | Before / impact | Fix and recheck |
| --- | --- | --- |
| High functional bug · `src/pages/_document.tsx:7`, `src/web3/runtime.ts:40` | Next normalized away the static subpath's trailing slash; lazy wallet imports reached HTML at the wrong directory | Capture the initial document directory in a base element before hydration. Wallet tools load at `/preview/`; both browser suites and export/probe checks pass |
| High integration bug · `scripts/rebuild-wallet.mjs:10`, `src/web3/sdk-entry.mjs:31` | Coinbase's connector has an optional SDK peer; installing only the connector left that path unresolved | Explicit Coinbase Wallet SDK 4.4.0, full local bundle and exact dependency graph. Browser rows load; reproducible rebuild is byte-identical. Native passkey enrollment remains untested |
| High data bug · `src/lib/api.ts:225` | A real safe settlement omitted issuance enrichment while Mining caught up, causing the whole history to fail validation | `sqkMintedBaseUnits` is optional/nullable. All safety/range checks remain. Actual capture retained in `settlement-before-issuance.json`; unit regression, nine live endpoint checks and live settlement rewards now pass |
| Medium layout bug · `src/styles/web3.css:12` | At 768px with 200% text, the new header expanded the document to 1031px | Allow natural header wrapping and mobile utility rows. Recheck measures document width 768px; 320/390/1440 and the final probe also pass |
| Medium accessibility/label bug · `src/components/web3-hub.tsx:854` | Wrapping select labels included option text in their accessible name | Explicit `for`/ID pairs for Period and Rank by. Both browser filter flows and axe views pass |
| Anti-cheat hardening · `src/web3/service.ts:529` | Hexadecimal casing could give the same log/transaction more than one deduplication key | Normalize hash identity before counting. Duplicate and mixed-case log fixtures count once; client XP/measurement/unsafe/wrong-snapshot cases are rejected |

Native dialogs also use `useId` and retain focus handling; wallet mobile entry preserves a legacy injected provider inside wallet browsers. These integration adaptations reuse the original components and tokens. No unrelated redesign or gameplay replacement was made.

### Selected rendered evidence

- `screenshots/probe-390.png`, `screenshots/probe-1440.png`: final first-screen composition.
- `screenshots/chromium-complete-desktop.jpg`, `screenshots/chromium-complete-mobile.jpg`, `screenshots/chromium-combat.jpg`, `screenshots/chromium-building-complete.jpg`: preserved gameplay.
- `screenshots/web3-chromium-wallet-phone.jpg`, `screenshots/web3-webkit-wallet-phone.jpg`: actual phone picker layouts, not native-app handoff proof.
- `screenshots/web3-chromium-real-settlement.jpg`, `screenshots/web3-webkit-real-settlement.jpg`: real current safe receipts.
- `screenshots/web3-chromium-nft-inventory.jpg`, `screenshots/web3-webkit-leaderboard.jpg`: actual official NFT/ranking data.
- `screenshots/web3-chromium-checker-dark-mobile.jpg`, `screenshots/chromium-keyboard-focus.png`, `screenshots/chromium-text-200-mobile.png`: dark state, visible focus and text enlargement.

The harness generates additional screenshots when rerun. The bundle keeps selected current evidence and the supplied earlier artifacts within the required byte budget; no required runtime asset, source, lockfile, license, export or report is omitted.

## Remaining limits

1. The public explorer RPC returned **HTTP 429**. Its explicitly labeled REST interface remained available, with real confirmed examples. RPC verification checks historical implementation storage/code; REST verification instead requires matching safe Squeekchain history and current pinned Core identity. Historical proxy storage is not verified on that alternate path. Its recent-history limit can make an older settlement ineligible for a local field-note reward while its transaction remains visibly confirmed.
2. Direct browser API networking here returned `net::ERR_EMPTY_RESPONSE`. The live browser suites forward unchanged public response bodies through Node only in tests. HTTP checks independently confirmed `Access-Control-Allow-Origin: *` for Squeekchain and explorer reads and a 204 preflight allowing If-None-Match (`web3-cors.json`). Direct end-user browser transport is not claimed as observed in this sandbox.
3. No physical wallet extension/app, real passkey enrollment, contract-wallet signature round trip, phone universal-link handoff, screen reader, native zoom or real-device performance session was available. Simulated wallet success is labeled as such; the actual connector and official SDK are bundled.
4. Global Game XP/level/quest rankings, private cross-device game profiles, player-owned physical hamster runs/settlements, official SqueekQuest quest transactions and authenticated Genesis eligibility cannot be supplied by the documented public services. They are explained in the product and references instead of fabricated. On-chain rankings are bounded public-event rankings, not a complete game database.
5. Browser saves and local badges/XP are editable and can be cleared. The separate journal prevents normal replay on this device; it is not a global anti-cheat authority and is not included in the original game-save export. Play one active adventure tab. Only official safe source events enter on-chain ranking totals.
6. The published deployment is staging Sepolia. Future API/deployment revisions may require updating pins/ABIs. No mainnet claim, new contract, token reward, transaction submission, paid service or eligibility authorization is part of this delivery.

Complete for the technically supported implementation and static-export scope, with the unavailable services and unperformed native checks above. The complete requested global game/eligibility system is not claimed to exist. Publication follows the assignment workflow. The archived game-only report is `validation-game.md`.
