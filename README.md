# SqueekQuest

A complete, local-first hamster survival adventure built on the existing Next.js, React and TypeScript project. Explore the Forest, Ancient Ruins, Wilderness and Underground Cave; gather, fight, craft and build a home. Real, confirmed Squeekchain blocks create **Chain Pulse** encounters. The finished static export is in **`dist/`**.

The existing art, local Nunito font, themes, sound, gathering, buildings, daily quests, save migration and Sunflower scramble minigame remain. Ancient Ruins continues the previous Abandoned Village map; Wilderness remains as an extra area. No wallet, signature, transaction, paid service, backend or database is needed.

## Install, preview and rebuild

Use Node.js 22 or 24 and npm. The existing package manifest, lockfile, dependencies and Next build configuration are unchanged. No credentials or environment file are needed.

```sh
npm ci
npm run preview
```

Open **http://localhost:4173/preview/**. To preview the included export without installing dependencies, run `node scripts/preview.mjs` directly. Any static server can serve `dist/`.

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run check:export
```

The production build uses the existing `output: 'export'` and `assetPrefix: '.'` configuration. `scripts/export.mjs` copies the Next export to `dist/`, removes source maps, and rebases document-owned URLs. All required images, fonts, scripts and styles are local. The single page uses dialogs, so static hosting needs no route rewriting. Deliver the contents of `dist/`; hosting and publishing are outside this assignment.

## Play

Select **Start adventure** or **Continue adventure**. Desktop browsers are the main target; narrow layouts include movement and action buttons.

| Control | Action |
| --- | --- |
| WASD / arrows | Move with collision |
| Select ground / resource | Walk around obstacles; gather on arrival |
| E | Gather, collect a drop, use a trail marker or complete a nearby Pulse |
| Space / Attack | Swing the equipped weapon; uses 5 stamina |
| Q / Dodge | Dodge with brief damage protection; uses 20 stamina |
| Shift / Sprint | Move faster while spending stamina |
| R / Eat berries | Restore health, stamina and food |
| I / C / B / J / M | Inventory / crafting / building / quests / map |
| Escape | Pause or close a panel |

Gather trees, stone, plants and ore. Resource patches regrow after 75 active seconds. Craft an axe for more wood, a pickaxe for stone and ore, blades for combat, bark armor for 35% less combat damage, and a lantern for the cave. The inventory lets you switch weapons, toggle armor, use supplies and discard individual items. Capacity starts at 60; a pack and storage chest increase it.

Enemies pursue you and warn before striking. Leave the warning ring or dodge, then attack. Defeated enemies give XP and physical item drops. The Root Warden has 420 health and becomes faster below half health. Its defeat and the final story quest complete the main adventure. Up to 150 uncollected enemy drops are retained; newer drops replace the oldest beyond that limit.

Food decreases only while playing. At zero food, health declines. Berries and trail mix restore food; bandages heal. A shelter provides rest and a campfire heals nearby. At zero health, choose **Recover at burrow**; supplies remain and recovery costs up to 20 XP. New game has a separate confirmation.

Build at the forest burrow clearing. Four fixed building sites have three upgrade levels, exact material costs, visible world changes and actual benefits:

| Building | Benefits |
| --- | --- |
| Shelter | Rest; level 2 adds 20 stamina; level 3 also adds 20 health |
| Campfire | Heal 2 / 4 / 6 health per active second nearby |
| Chest | Add 40 / 80 / 120 shared inventory capacity |
| Garden | Harvest 4 / 8 / 12 berries after 90 active seconds |

Every 250 XP adds a level and one skill point. Spend points in **Explorer profile** on vitality (+15 maximum health), combat (+6 damage) or foraging (+1 resource per gather), each up to rank three. Ancient Ruins opens at level 2. The Underground Cave requires level 3, a pickaxe and a lantern. Previously visited areas remain accessible when migrating an existing save.

The journal contains four main quests, two side quests, three UTC daily quests, and ten achievements. Claim completed rewards once. Hidden caches reward exploration. **Sunflower scramble** remains playable: collect five seeds, return home and claim its daily quest reward. Its latest 50 local run records remain in the profile. Nothing is a shared leaderboard.

## Chain Pulse

The browser reads only these five official endpoints during normal play:

- `https://api.squeekchain.com/v1/status`
- `https://api.squeekchain.com/v1/core`
- `https://api.squeekchain.com/v1/measurement/blocks`
- `https://api.squeekchain.com/v1/events?category=measurement&limit=40`
- `https://api.squeekchain.com/v1/measurement/stats?range=7d`

The existing deployment validators remain in `src/lib/api.ts`. They check installation, Sepolia chain, supported core identity, response schemas and safe confirmations. Core source blocks must be at or below `safeThroughBlock`; when supplied, cumulative block units must agree with the settled height. The projection endpoint is informational and cannot trigger rewards.

On first successful connection, the settled height becomes the baseline. Each higher confirmed height schedules one uniquely identified forest encounter: a supply cache, enemy wave, secret glade portal or wandering herbalist. There are at most 12 active markers; four queued heights are materialized per successful poll until caught up. No heights are skipped. Repeated or regressing snapshots give no duplicate encounters or rewards. Interact at the marker to complete its effect. Everything awarded is **local game XP or items**, never tokens or blockchain rewards.

The persistent height cursor, resolved events and receipt claims survive refresh, new game and older-save import. Retired journal rows cannot be resurrected by importing an old save. Web Locks serialize reward actions where supported. This is local deduplication, not cross-device anti-cheat; clearing all browser data also clears the ledger.

Accepted measurement receipts have a separate parser. Recording a validated receipt grants 45 local XP once per ID. These are dated historical field notes, not new settled blocks. The current public receipt schema does not supply hardware provenance; these receipts are shown as **provenance not supplied**, rather than inferred to be hardware.

The compact panel shows hamster status, RPM, settled height and measurement age. Hardware, simulated, replay and derived values retain their reported labels. Stale, missing, failed or unvalidated values are **Unknown**, never manufactured zeroes. Seven-day summaries are explicitly derived and disclose partial coverage. Status/core/events/projections refresh every 30 seconds while visible; stats every two minutes. Requests time out after 12 seconds, honor rate-limit cooldowns, retry on the polling schedule and reconnect on an online event or the Reconnect button. Fresh core responses expire after 90 seconds; telemetry also respects its API-provided observation deadline.

Gameplay continues when the API is offline. The static page itself must first be loaded; this release does not install a service worker for offline page downloads.

## Saves and recovery

The validated save remains under `squeekquest.survival.v2`. New combat, equipment and Pulse fields default during migration of prior version 2 saves. Original version 1 profiles retain name, XP, achievements, settings and foraging records.

Progress saves every five seconds, after successful actions, when pausing/opening panels and on page hide. Combat, inventory, structures, quests, XP, food, resource cooldowns, location, drops and settings persist. `squeekquest.chain-pulse.v1` separately preserves the monotonic Pulse ledger across restarts/imports. Play one active adventure tab at a time; the ledger serializes reward claims, but the whole game save is not a collaborative multi-tab document.

**Export save** creates a JSON backup. **Settings → Import save** restores a validated file up to 2 MB and replaces the local adventure; export first to retain both. Malformed imports leave progress unchanged. Invalid stored data is not silently overwritten before a player chooses to start again. If storage is denied/full, the game explains the failure, allows play and export, and pauses new Pulse processing. Private browsing or clearing browser data can remove progress.

## Verification and limitations

The worker runs checks against the production export, served under `/preview/`. In this assignment, dependencies and a build copy were installed only in disposable `test/scratch/` to leave the protected root dependency directory untouched; the unchanged project scripts were used there. No generated dependency directories or browser downloads are delivered.

```sh
npm run typecheck
node scripts/check-unit.mjs
npm run build
npm run check:export
npm run test:api
npx playwright install chromium
npm run test:browser
npm run test:a11y
node scripts/check-quality.mjs
node scripts/check-budget.mjs
```

`check-unit.mjs` runs the same test files as `npm test` and records actual counts. Browser tests cover real controls, movement/collision, combat and boss defeat, crafting/building, quests/skills, save/refresh/export/import, restart, denied storage, rate limits, responsive layouts and Pulse deduplication. Controlled saves and deliberately changed fixture heights are **test scaffolding only** and are not runtime fallback data.

Final commands, counts, screenshots, the eleven acceptance checks, the pinned design probe and the six-domain Better Interface review are recorded in [artifacts/validation.md](artifacts/validation.md). [DESIGN.md](DESIGN.md) documents the implemented design system. [Integration notes](artifacts/INTEGRATIONS.md) explain the evidence boundary.

Concrete environment limitations: the supplied browser connector failed with **“Socket path too long”**. Standalone Chromium works. Direct browser requests to the official API returned **`net::ERR_EMPTY_RESPONSE`**, although actual Node/curl requests succeeded with HTTP 200 and valid schemas. A separate test-only transport adapter forwards unchanged official responses into Chromium to verify parsing/rendering; **no adapter, backend or synthetic API response is shipped in the game**. Direct end-user browser transport remains unverified here. WebKit could not launch because required runtime libraries are unavailable. Physical devices, screen-reader sessions, native 200% browser zoom and an organically occurring new settlement were not verified. New settlement behavior is verified with explicitly synthetic test transitions, not claimed as an observed live block.

No missing live data, transaction, measurement, API response or blockchain reward was fabricated. Successful API responses and controlled-test evidence are identified separately.

## Source and licenses

- `src/lib/survival.ts`: worlds, resources, recipes, buildings, collision/pathfinding and save migration.
- `src/lib/adventure-state.ts` / `adventure.ts`: validated combat state, AI, drops, survival, skills, quests and encounters.
- `src/lib/chain-pulse.ts`: safe-height processing, monotonic deduplication, measurement receipts and freshness.
- `src/hooks/use-chain.ts` / `src/lib/api.ts`: official API polling, validation, caching and retry cooldowns.
- `src/components/survival-map.tsx`: original pixel rendering, camera, controls, minimap, enemy telegraphs and effects.
- `src/components/chain-pulse.tsx`: live panel, receipt journal, source links and honest offline states.
- `src/pages/index.tsx`: game lifecycle, dialogs, settings, persistence and audio.
- `src/components/game-map.tsx` / `src/lib/game.ts`: preserved original minigame and legacy support.

See [attribution](artifacts/ATTRIBUTION.md) and the retained MIT, font and design-guidance notices. The final bundle includes complete source, the existing manifest/lockfile, `dist/`, runtime assets and documentation. The unchanged ignore file excludes generated files at every nesting level. The final complete-tree budget is in [artifacts/submission-budget.json](artifacts/submission-budget.json), against **8,388,608 bytes**. No submodule, vendored registry or unnecessary dependency archive is added.
