# SqueekQuest survival validation

Worker validation, 2026-11-06. This report describes the current source and committed static export, not an independent certification. Earlier API evidence and old exploration screenshots retained in this repository describe the previous version only.

## Result

| Area | Final result |
| --- | --- |
| Gameplay and requested local systems | Implemented; 7 priority groups covered |
| Production build / standalone typecheck | Passed |
| Unit tests | 24 passed, 0 failed, 0 skipped |
| Chromium interaction walkthrough | 18 passed, 0 failed |
| Browser script / local resource / external request errors | 0 / 0 / 0 |
| Automated accessibility and panel overflow | 44 states checked; 0 axe violations; 0 overflow cases |
| Pinned taste@1 probe | 16 / 16 passed |
| Focus, rendered contrast and text enlargement | 8 / 8 checks passed |
| Product and primary action on the first 390px screen | Yes, inspected in a rendered screenshot |
| Share metadata | Title, description, favicon, og:title and local og:image present |
| WebKit / Safari | Not run: browser launch refused for missing system libraries |
| Submission budget | Passed; exact bytes in `submission-budget.json` |

## Scope and implementation

This extends the existing Next.js Pages Router project. Original art, local font, themes, sound, native dialog, legacy save logic and foraging mini-game remain. The main page now composes a local survival adventure. Earlier API modules and fixtures are retained as dormant source history; the browser walkthrough observed no external request. No dependency, lockfile, build configuration, ignore file, submodule, environment file or protected repository path was changed.

The seven requested priority groups are implemented:

1. **Gameplay:** frame-based normalized movement, follow camera, WASD/arrows, collision-aware click paths, touch direction controls, sprint stamina, proximity gathering, healing consumables, hazards, pause and safe respawn. Collision and actual movement along paths to every resource and exit were exercised by the unit suite.
2. **World:** Forest, Abandoned Village and Wilderness are connected by bidirectional interaction markers. Each has resource nodes, hazards and a one-time hidden cache. Water, tree trunks and ruined walls block paths. Mud slows movement; thorns deal real damage.
3. **Inventory/crafting:** 10 stackable item types, capacity, category filtering, item selection/use/drop, exact resource deductions, axe, pickaxe, bandages, trail mix, planks and explorer pack. Tools equip once; the pack requires the home workbench.
4. **Base:** four structures at fixed burrow sites, each with three levels and exact costs. Shelter rest and maximum-stat increases, campfire healing, shared satchel expansion and timed garden harvests have implemented effects. Unit tests cover every upgrade level; browser tests cover building, upgrading and resting.
5. **Progression:** three daily quests, UTC rollover, single claim per quest/day, real gathering/crafting counts, XP, levels, seven achievements and the preserved playable seed-foraging mini-game. The browser completed an actual five-seed return run and saved it.
6. **UI:** menu, Continue/New game, HUD, inventory, crafting, base, quest journal, map, help and profile. Responsive layouts, two themes, optional sound, native dialogs, visible material requirements and persistent status messages. Every enabled action is connected; unavailable recipes and rewards explain their requirements nearby.
7. **Save:** validated local storage for world state, resources, tools, structures, cooldowns, quests, XP, statistics and preferences. Autosave, pause/page-hide save, valid version 1 migration, JSON export/import, corrupt-input recovery and denied/full-storage feedback are implemented.

The static export, relative assets, metadata, source, existing manifest/lockfile, README and final-source DESIGN.md are included. No required gameplay system is a placeholder. The chosen scope is a compact local game with fixed building sites and environmental hazards; it is not a shared leaderboard or competitive save system.

## Commands and actual results

Dependencies were installed in disposable `test/scratch/build/` using exact copies of the existing manifest and lockfile, because this assignment prohibits modifying root dependency paths. Source, public assets, scripts, tests and existing configuration were copied there before build/typecheck. The resulting export was synchronized back to `dist/`, removing obsolete generated chunks. No dependency installation or browser engine is included in the submission.

| Command run | Result |
| --- | --- |
| `npm ci --prefix test/scratch/build --cache test/scratch/npm-cache --no-audit --no-fund` | Passed; existing locked dependencies installed |
| `npm run typecheck --prefix test/scratch/build` | Passed, including final app source |
| `npm test --prefix test/scratch/build` | 24 passed; 14 survival tests and 10 preserved legacy/API validator tests |
| `npm run build --prefix test/scratch/build` | Passed after final app changes; static Pages Router export |
| `node scripts/check-export.mjs` | Passed; 21 export files, 26 checked local references, no missing or root-absolute assets |
| `npm run test:browser --prefix test/scratch/build` | Passed all 18 scenarios against the production export under `/preview/` |
| `npm run test:a11y --prefix test/scratch/build` | Passed all 44 states in Chromium |
| `node test/scratch/build/scripts/check-quality.mjs` | Passed 8 checks; reusable delivered source is `scripts/check-quality.mjs` |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16/16 passed; worker supplied `IMD_PLAYWRIGHT` pointing to the scratch installation and a scratch browser-download location |
| `npm run test:browser --prefix test/scratch/build -- --webkit` | Browser could not launch: missing GTK/GStreamer and other required system libraries. No Safari behavior claimed |
| `git diff --check` | Passed |
| `node scripts/check-budget.mjs` | Passed; complete file-byte accounting and critical hashes in its report |

Build/typecheck were not replaced by the design probe. The browser and accessibility commands used a locally installed Chromium through Playwright. The provided browser connector itself failed to initialize because its Chromium profile socket path was too long; direct Playwright successfully rendered and exercised the export. No live API or RPC was needed for this task.

## Better Interface coverage

Pinned Better Interface workflow and core principles in all six domains were read and applied while extending the existing design. The pinned design-critic reference and taste script were read and used. Wallet guidance is not applicable: this game has no wallet, chain or transaction flow.

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility | Checked: native buttons/inputs/dialogs; names on icon controls; keyboard movement and panels; modal focus containment, Escape and trigger restoration; visible keyboard focus screenshot; reduced-motion preference; automated axe checks on all 11 representative states at 390/1440 in both themes | No real screen-reader session, physical assistive input or full compliance claim. Native browser chrome can receive focus; background page controls stayed inert during modal tabbing |
| Layout | Checked: 320/390/768/1440 normal layouts; 44 panel/theme/width states with no horizontal overflow; 200% text enlargement of the page and inventory at four widths; final screenshots reviewed | Text enlargement is not native browser zoom. No translated/RTL layout or physical device test |
| Writing | Checked: verb actions, consistent gather/craft/build/claim terms, real costs, current versus next upgrade benefit, recoverable save errors, explicit local-only progression and records | Historical API documentation is clearly marked inactive rather than presented as current runtime |
| Typography | Checked: local font loads, six defined sizes, three weights, natural case/tracking, numeric stability and enlarged-text wrapping. Probe reports one active font family and 3–4 repeated sizes per measured width | No cross-platform font rendering comparison |
| Colors | Checked: axe and taste on actual rendered themes; eight solid-background text pairs measured per theme. Minimum measured pair is the light next-step description at 4.54:1; Start/Continue is 7.74:1 light and 8.03:1 dark | Canvas pixels and translucent/image-backed text are not certified by these measurements; taste explicitly leaves 11 such boxes unmeasured |
| UI | Checked: primary action, pressed Sprint, disabled recipes, equipped tools, active filters, costs, claim state, storage error, modal scrolling, dark theme, loading/continue/new-game states and reduced motion. Source review confirms explicit 120ms transition properties and no endless decorative animation | No physical touch hardware or animation-panel slow replay. Sound is optional synthesized feedback; no full audio-device matrix |

## Findings, fixes and rechecks

| Severity / domain | Final source location | Finding, change and evidence |
| --- | --- | --- |
| High / accessibility | `src/components/survival-map.tsx:713` | Mobile CSS hides the visible Sprint word. Axe reported an unnamed button at 390 in both themes. Added `aria-label="Sprint"` and an explanatory title. Final 44-state scan reports zero violations |
| High / layout | `src/pages/index.tsx:1176` | The file input inherited the global input width/min-height inside the profile dialog, creating a horizontal scrollbar. Replaced the visually clipped field with a truly hidden native file input inside the dialog. Final scans have no profile overflow; a real file chooser, invalid import and valid import pass |
| Medium / accessibility | `src/pages/index.tsx:279`, `src/components/dialog.tsx:16` | Closing every panel forced canvas focus, overriding the native dialog’s trigger restoration. Removed that override. Keyboard recheck restores the help trigger, while a canvas shortcut restores canvas focus |
| Medium / layout and type | `src/styles/survival.css:1899` | At 200% text size the compact header/HUD/toolbar crowded or extended the 320/390 page. Added wrapping to header/HUD labels and an adaptive control grid. Recheck: document widths equal 320/390/768/1440; inventory dialogs also fit. The enlarged HUD and header screenshot was reviewed |
| Medium / writing and UI | `src/pages/index.tsx:919`, `src/styles/survival.css:1893` | Built-structure copy showed the next level’s benefit as if already active. Current effect and “Next:” upgrade effect are now separate and costs still refer to the actual next upgrade. Browser building screenshot and cost assertions rechecked |
| Medium / product truth | `src/pages/_document.tsx:10`, `src/pages/_document.tsx:18` | Previous metadata described a live chain-connected game. Updated the description/title/share metadata and added a local capture of the current survival product. Old integration records are labeled historical. Export metadata check passes and the runtime makes zero external requests |

Additional source corrections keep the profile name field synchronized after importing a save (`src/pages/index.tsx:134`, `src/pages/index.tsx:1213`), give named control containers an explicit group role, and route each gathering tone through a single result handler. The final import check asserts both the stored name and the visible field value.

Two test-harness issues were corrected without treating them as product failures: fixture saves must be installed after the outgoing page’s page-hide autosave, and theme comparisons must use the actual theme control and wait for its state to settle. Final reports refer to the corrected harness and final export. No temporary failed report is presented as a successful result.

## Evidence

- `browser-chromium.json`: all 18 primary interaction checks, zero console/page/resource errors and zero external requests.
- `accessibility.json`: all 44 final automated states and any incomplete rule IDs, retained for honest inspection.
- `taste.json`: all 16 probe results. Probe PNGs were inspected in disposable scratch space; final product screenshots are retained below.
- `quality.json`, `contrast.json`: focus checks, 200% text enlargement widths, and measured foreground/background pairs.
- `unit-tests.json`, `export-check.json`, `submission-budget.json`: worker test summary, complete export references and size accounting.
- `screenshots/chromium-survival-mobile.webp`: inspected phone entry state; product and Start are visible in the first screen.
- `screenshots/chromium-survival-desktop.webp`, `screenshots/chromium-survival-playing.webp`, `screenshots/chromium-survival-playing-mobile.webp`: entry and active world.
- `screenshots/chromium-crafting.webp`, `screenshots/chromium-building.webp`, `screenshots/chromium-wilderness.webp`: working recipe, base and area states.
- `screenshots/chromium-sunflower-scramble.webp`, `screenshots/chromium-inventory-mobile-dark.webp`, `screenshots/chromium-storage-recovery.webp`: completed mini-game, dark satchel and denied-storage recovery.
- `screenshots/chromium-keyboard-focus.webp`, `screenshots/chromium-text-200-mobile.webp`: keyboard and enlarged-text evidence.

## Completion and limitations

**Complete for the stated local-game scope**, with the validation limits above. No known requested gameplay feature remains unfinished. All priority groups have an implementation and useful local validation. This is not a claim that every browser/device, every possible play sequence or every assistive technology has been tested.

Safari/WebKit remains untested because the browser runtime lacks required system libraries. Actual screen readers, native 200% browser zoom, physical mobile devices, RTL/localized content and long-duration save stress were not tested. Garden/cooldown timing and every structure level were checked with accelerated engine state rather than waiting for real production-length growth cycles. The autosave interval is five seconds; pause and explicit-action persistence were exercised in the browser. Offline time does not advance resource growth. The game uses editable local browser data and offers no anti-cheat or shared ranking guarantees.
