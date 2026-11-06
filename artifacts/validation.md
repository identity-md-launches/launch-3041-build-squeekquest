# SqueekQuest validation and design review

Worker checks completed on **2026-11-06**. These are actual local observations, not an independent certification. The production app is the Next.js static export in `dist/`.

## Result

| Area | Actual result |
| --- | --- |
| Production build | Passed: Next.js 16.4.5 generated `/` and `/404`, then exported `dist/` |
| TypeScript | Passed: `tsc --noEmit` |
| Unit and fixture tests | 10 passed, 0 failed |
| Live API integration | 8 successful public requests passed application validation |
| Chromium interactions | 16 passed, 0 failed; no page exceptions, console errors or failed resources in the main context |
| Responsive reflow | All four views checked at 320, 390, 760, 1,024 and 1,440px; no horizontal document overflow |
| First screen, 390×844 | Product and primary action visible; Start adventure is 167×46px, centered at y=654.86, entirely above the fold |
| Pinned taste@1 probe | 16/16 checks passed on final export |
| Automated accessibility | 16 view/theme/width combinations; 0 WCAG rule violations, 0 incomplete rules in the final run |
| Static asset integrity | 20 files, 911,067 bytes; 28 local references checked; 0 missing/root-absolute assets |
| WebKit | Not run successfully: browser runtime could not launch because required system libraries were absent |
| Public URLs | After review/publication handoff; no public repository or deployment URL was created or claimed here |

The static implementation is complete for the bounded repository scope. Cross-browser release verification and public URL publication remain outside this verified result. The leaderboard is intentionally and visibly local to the current browser, not a shared ranking.

## Scope and assumptions

The review covered Adventure, Quest journal, Chain explorer (overview, settlements, events, economy and NFT lookup), the local leaderboard, profile, help, station/discovery dialogs, both color themes, loading, empty, error, successful discovery, paused play and completed play states.

The inferred product direction is a relaxed woodland adventure with a field-station dashboard. No wallet or signing is necessary for the read-only product. All game points are local. Safe API records are verifiable by their provenance and explorer links; the worker did not claim independent RPC or cryptographic verification. Fixtures are used only by tests, not by the game.

Development dependencies and browser engines were installed in disposable scratch directories; the source and lockfile are normal npm inputs. The production build and browser scripts ran against a source copy with the same application files. The delivered `dist/` is the copied final production export, not a development-server screenshot or a hand-built substitute. Dependencies, caches and engines are not part of the submission.

## Commands and evidence

| Command | Outcome / durable evidence |
| --- | --- |
| `npm run build` | Exit 0; compiled TypeScript, optimized the app, generated static pages and wrote the export |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 10 tests covering daily idempotence, progression, corrupt save recovery, movement, history archival, actual API fixtures, unsupported provenance, invalid settlement ranges and integer precision |
| `npm run test:api` | Exit 0; [`api-check.json`](api-check.json) contains actual endpoint/version/chain results |
| `npm run test:browser` | Exit 0; [`browser-chromium.json`](browser-chromium.json) contains 16 interaction results |
| `npm run test:a11y` | Exit 0; [`accessibility.json`](accessibility.json) contains all 16 axe combinations |
| `npm run check:export` | Exit 0; [`export-check.json`](export-check.json) checks document/CSS references, metadata and export size |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | Exit 0; final results preserved as [`taste.json`](taste.json) |
| `npm run test:browser -- --webkit` | Exit 1 during browser setup; [`browser-webkit.json`](browser-webkit.json) records the missing-library limitation |

The supplied browser-tool launcher failed before navigation because of a temporary socket path-length error. A bounded foreground Playwright preview and browser were used instead. Its installed Chromium executable was selected explicitly for the local run; the pinned probe used a scratch adapter to that same engine. The normal delivered browser scripts work with a standard Playwright installation. The scripts closed their browsers and preview servers after each run.

The test network required an outbound proxy. Chromium used the runner's proxy setting for real requests to the public API; no API response was replaced in the successful integration flow. The explicitly labeled outage test used a separate context with an injected HTTP 503 response. This tested recovery while keeping live verification distinct from failure injection. No paid image or external deployment request was made.

### Primary interaction coverage

The Chromium run loaded the export at `/preview/`, checked that the local font loaded, completed a real playable forage, used arrow-key movement and Escape/pause/resume, visited all three stations, logged a safe settlement and event, looked up real Squeek #1 with its artwork, rejected an invalid NFT ID, earned the daily challenge, and verified all four quest receipts and five unlocked achievements.

It opened the discovery log, edited and validated the explorer name, sorted the run list, initiated a JSON export, reloaded to verify persistence, searched/cleared event filters, selected a category, loaded another event page, inspected a full transaction, opened block and economy views, checked the seven-day chart, switched and reloaded dark mode, and verified dialog Escape/focus return. Reduced-motion emulation reported no running animations. In an injected API outage, local play remained available while a station showed a retryable error and no chain claim button.

The NFT validation and quest claims used actual official responses. The activity chart correctly showed partial historical coverage, and the provisional endpoint actually returned zero projected blocks in the recorded API checks. That zero is an observed response, not an invented fallback.

## Better Interface coverage

All six core domains of the pinned guide were read and applied during implementation. Source review alone was not treated as rendered evidence.

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native links/buttons/forms/dialogs, explicit names, bound labels, invalid-input focus, keyboard game movement, dialog Escape/focus return, stable live regions, reduced motion, 3px focus styling, axe review of all four main views in both themes. No actual screen-reader or physical-device session; not a conformance claim. |
| Layout | Checked | Shared edges and grouping, primary game before supporting data, responsive reflow in five widths, first-screen 390 screenshot and measured action bounds, flat comparable data rows, full identifiers and no horizontal overflow. Native 200% zoom, RTL mirror and pseudo-localization were not tested. |
| Writing | Checked | Verb actions, instructions beside the game, short product title/plain explanation, truthful local XP/ranking labels, separate stale/unavailable states, retry instructions, empty-filter recovery, consistent quest/discovery vocabulary. No placeholder or fake chain claims. |
| Typography | Checked | Local font loaded; six-size source scale, three weights, bounded measures and natural case; changing numbers use tabular figures and identifiers wrap. The final probe observed 5 total sizes at 390 and 6 at 1,440. No real OS text-enlargement session. |
| Colors | Checked | Semantic light/dark tokens, status text alongside color, source token review, rendered solid-pair measurements, automated contrast review. Texture/illustration pixels and every possible third-party NFT image are not claimed to have fully measured contrast. |
| UI | Checked | Ready/play/pause/complete, selected/completed/locked, hover/focus/active/disabled/loading/empty/error/success states in source and browser flows; one icon set, restrained motion, flat panels and named transition properties. No slow-motion replay in a browser Animations panel; no manual listening session for audio output. |

Wallet connectors are not applicable: the game reads public data and never requests a signature. Wallet guidance was read; no unnecessary wallet dependency, connect flow or project ID was added.

### Measured colors

[`contrast.json`](contrast.json) records browser-computed text/background colors after exercising the actual theme control and allowing styles to settle. The WCAG sRGB luminance method was used.

| Pair | Light | Dark |
| --- | --- | --- |
| Page title / page | 11.76:1 | 14.13:1 |
| Page description / page | 5.00:1 | 8.29:1 |
| Enabled primary action text / fill | 7.74:1 | 8.03:1 |
| Quest description / surface | 5.29:1 | 7.07:1 |
| Daily challenge text / warm surface | 5.52:1 | 7.93:1 |
| Map station text / opaque label | 8.27:1 | 8.27:1 |
| Input boundary / input surface | 3.23:1 | 4.26:1 |

The probe additionally reports 13 text boxes over images/graphics as not measured by its solid-background resolver. This is retained as a limitation even though the automated axe run had no incomplete rules after the decorative map captions were removed.

## Consolidated findings and fixes

All listed findings were addressed in the final application source. The final probe has no failed checks. Repeated symptoms are grouped by their root cause.

1. **High, bug: exported font URL resolved under the stylesheet directory.**
   - Source: `src/pages/_document.tsx:8`, `public/fonts/nunito.css:1`.
   - Now: the production document loads a local font stylesheet whose WOFF2 URL is relative to its own directory.
   - Changed from: a CSS-module asset prefix that produced a nested `_next/static/css/_next/static/media/...` 404.
   - Why/evidence: first rendered run and probe reported a missing local font; the final browser font-load assertion passes and the final export has no missing resources.

2. **High, layout: map labels overlapped at phone width.**
   - Source: `src/components/game-map.tsx:207`, `src/styles/globals.css` `.map-welcome` phone rule.
   - Now: the Squeek grove label uses a smaller vertical offset; the welcome message is above the station row on phones. Decorative coordinate text was removed without leaving a layout gap.
   - Changed from: the welcome label covering the burrow and the grove label crossing coordinate text.
   - Why/evidence: the first 390 probe reported three overlapping text boxes across 390/1,440. Final screenshots were viewed, and the final probe reports no overlap, floating obstruction or clipped text at 320/390/1,440.

3. **Medium, writing: failed first reads could be described as stale readings.**
   - Source: `src/components/chain-views.tsx:123` and the shared dashboard metric notes.
   - Now: a retained prior value says “Last reading · stale”; a first-read failure says “API unavailable”. `Notice` exposes an endpoint-specific recovery action.
   - Changed from: labeling an absent reading as a last reading.
   - Why/evidence: source review of outage states found the distinction; the injected 503 browser flow passes and shows no chain reward action.

4. **Medium, accessibility: subtle separators were also used as input boundaries.**
   - Source: `src/styles/globals.css:18`, `src/styles/globals.css:117`.
   - Now: fields use `--control-line`, separate from decorative `--line` separators.
   - Changed from: low-emphasis divider colors outlining blank fields.
   - Why/evidence: fields need an identifiable boundary. Actual final rendered boundary pairs measure 3.23:1 light and 4.26:1 dark; form interaction and axe checks pass.

5. **Medium, accessibility: an app update region was initially hidden from accessibility APIs.**
   - Source: `src/pages/index.tsx:720` and `src/components/game-map.tsx:351`.
   - Now: empty status regions remain mounted and update their text; the visual notification is separate. The sound control uses a stable accessible name and pressed state.
   - Changed from: relying on a display-none visual notice to announce its first update and an ambiguous changing sound-toggle name.
   - Why/evidence: source review against the pinned live-region/toggle guidance; semantic scan passes. Actual announcement behavior on a screen reader is explicitly unverified.

6. **Medium, bug: bounded history could cap lifetime progression.**
   - Source: `src/lib/game.ts:107` and `src/lib/game.ts:117`.
   - Now: discarded old receipts contribute to archived XP, and unlocked achievement IDs persist.
   - Changed from: deriving lifetime XP only from the retained receipt window.
   - Why/evidence: source review found a long-term progression edge case. A meaningful rollover unit test passes alongside daily duplicate-claim and save-recovery tests.

7. **Low, UI/contrast reviewability: decorative text sat directly on variable artwork.**
   - Source: `src/components/game-map.tsx` map composition and `src/styles/globals.css` scene rules.
   - Now: functional map labels keep opaque surfaces; decorative map-caption and coordinate overlays are removed.
   - Changed from: extra text over trees and grass with backgrounds the automated checker could not resolve.
   - Why/evidence: the removal exposes more artwork without moving controls. Final axe scans have zero incomplete rules in all 16 combinations, and the final screenshots were inspected.

## Brief coverage

| Requested requirement | Status and implemented evidence |
| --- | --- |
| “Interactive hamster game with movement, missions and rewards” | Implemented/tested: bounded tile movement, seed collection, return-home objective, local daily XP and discovery quests |
| “Live blockchain missions based on verified SqueekChain events” | Implemented/tested as validated official API discoveries with safe-source checks and evidence; no independent receipt proof claimed |
| “XP, levels, achievements and leaderboard” | Implemented/tested; leaderboard expressly ranks this device's runs |
| “Daily challenges and progress tracking” | Implemented/tested; UTC reset/idempotence and storage behavior covered |
| “Live statistics dashboard” | Implemented/tested with actual API reads and partial-coverage labels |
| “Block explorer showing real blockchain data” | Implemented/tested: settlement ranges, event filtering/pagination, record details and public explorer links |
| “Responsive design for desktop and mobile” | Implemented and Chromium-emulated at the recorded widths; physical-device validation unperformed |
| “Next.js, TypeScript, Tailwind CSS” | Implemented; production build and standalone typecheck pass |
| “Dark and light modes” | Implemented/tested, including persistence and automated scans |
| “Handle unavailable API data gracefully” | Implemented/tested with real failure handling, negative schema tests and injected outage context |
| “Public GitHub repository” / “Working deployed website” | After review/publication handoff; no public URL claimed |
| Source, lockfile, static export, README, screenshots, test results, integrations and ecosystem explanation | Included in this repository; paths linked from README |
| “Never fabricate … balances, rewards or transactions” | No token balance, transaction or monetary reward is invented; local game XP is explicitly separate |

## Remaining limitations

- WebKit could not launch due missing system libraries; no Safari/iPhone compatibility claim is made. The supplied browser tool also failed before navigation; actual rendered evidence comes from the successful local Playwright fallback.
- No physical-device, actual screen-reader, native browser zoom, RTL/pseudo-localization, human audio-listening or network-load test was performed.
- Automated accessibility checks cover the four main views in two themes and two widths, not every possible modal/data combination or future API content. API availability can change after these checks.
- Leaderboard and progress are local and editable. There is no global competition, authentication or shared persistence backend.
- API field/provenance validation is not a substitute for independent chain verification. A changed official release intentionally needs a maintainer update before its data can unlock quests.
- Public source and website URLs belong to the publication handoff. This report does not present the private preview address as a deployment.

Final screenshots are in [`screenshots/`](screenshots/). The worker viewed the mobile and desktop game, real NFT discovery and dark explorer captures. The pinned probe's scratch shots were used to confirm the overlap fix; those temporary files are not submission artifacts.
