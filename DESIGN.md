# SqueekQuest design system

## Overview

SqueekQuest is a desktop hamster survival adventure with responsive action controls. The existing forest-and-oat identity, rounded Nunito Sans, hamster illustrations and original foraging game remain. The new combat, cave and Chain Pulse systems belong to the same visual language. Pixel artwork carries the world; clear native controls carry inventory, progression and live-data explanations.

The style source of truth is `src/styles/globals.css`, followed by the active survival overrides in `src/styles/survival.css`; `_app.tsx` imports them in that order. The game and Start/Continue action precede supporting content at 390px. The compact Chain Pulse control sits immediately above the world, beside the health/stamina context rather than in a separate dashboard.

## Colors

Reuse the existing hexadecimal semantic tokens. `html[data-theme='dark']` changes the interface; world art retains its location palette.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--page` | `#f7f8f2` | `#17231d` | Page background |
| `--surface` | `#fffefa` | `#213028` | HUD, controls, menu, dialogs |
| `--surface-alt` | `#edf1e4` | `#2a3b30` | Tracks and neutral grouping |
| `--ink` | `#293729` | `#edf1e3` | Main text |
| `--muted` | `#646e5d` | `#b1bdab` | Secondary text |
| `--line` | `#dfe5d7` | `#3e5140` | Separators |
| `--control-line` | `#87927c` | `#81947d` | Control borders |
| `--accent` | `#2f5b3e` | `#c2d59b` | Primary action and progress |
| `--accent-hover` | `#244b31` | `#d0dfa9` | Action hover |
| `--on-accent` | `#fffefa` | `#223820` | Filled action text |
| `--accent-soft` | `#e9efdb` | `#344a31` | Selected and next-step surfaces |
| `--warm` | `#f3ecd9` | `#3a3827` | Recovery/API notice surface |
| `--warm-ink` | `#725a32` | `#e5d2a2` | Requirements and warm labels |
| `--focus` | `#456d36` | `#d2dfa5` | Keyboard focus |
| `--error` | `#934330` | `#f6b29b` | Save errors and missing materials |
| `--health` | `#a5534b` | `#e6a69b` | Health |
| `--stamina` | `#8c7938` | `#d8c37d` | Stamina fill |

`--scene-frame` is `#293f32`. Scene labels use `#f9f4df` on solid `#2d4736`; the canvas focus ring is `#f3dda3`. `PALETTES` in `survival-map.tsx` owns location art: forest green, weathered ruin stone, cool wilderness greens, and cave ground `#3d4952` with pale mineral highlights. The cave vignette is artwork, not a text surface. Enemy telegraphs have a visible circular outline as well as warm danger fill. Pulse marker shapes distinguish encounters.

Measured foreground/background pairs are in `artifacts/contrast.json`. Their scope is actual opaque DOM backgrounds; the design probe does not establish arbitrary canvas-pixel contrast.

## Typography

The local `public/fonts/nunito-sans-latin.woff2` is declared by `public/fonts/nunito.css`, with normal weights 400–800 and `font-display: swap`. The stack is `'Nunito Sans', ui-sans-serif, system-ui, sans-serif`. The interface uses weights 400, 600 and 800.

| Token | Size | Role |
| --- | --- | --- |
| `--text-xs` | 0.75rem / 12px | Counts, freshness, keys and compact labels |
| `--text-sm` | 0.875rem / 14px | Buttons and supporting copy |
| `--text-base` | 1rem / 16px | Body, inputs and recipe/quest titles |
| `--text-lg` | 1.25rem / 20px | Section headings and narrow menu/dialog titles |
| `--text-xl` | 1.75rem / 28px | Menu/dialog headings and narrow page title |
| `--text-display` | 2.5rem / 40px | Wide page title |

Body line-height is 1.5; descriptions use 1.4–1.6. Headings are tighter and balance where supported. The wide display title uses −0.045em tracking, relaxed on narrow layouts. Content uses natural casing; API enum values and keyboard keys are data. Inputs remain 16px. Dynamic counters use tabular figures. The survival keys use the same sans family. Monospace is limited to receipt IDs, whose containers wrap rather than clip.

## Layout

The header and page share a 1440px maximum width and 42px wide-screen side insets. `.adventure-layout` uses `minmax(0, 1fr) 290px`, separated by 32px. The scene remains dominant. The sidebar starts with the next useful step, then supplies, daily progress and the preserved minigame. An unnecessary duplicate Chain Pulse summary was removed so it cannot leave an empty phone grid column.

The spacing rhythm uses 4/8/12/16/20/24/28/32px steps with existing optical adjustments. Health, stamina and XP sit above the compact live panel and scene. Gathering, Attack, Dodge and Sprint follow the scene; food/equipment status and five panel controls remain in document flow. Save warnings sit before the game, with export recovery adjacent.

The existing 1180px breakpoint reduces side insets to 28px and the sidebar to 250px. At 960px the game becomes one main column, with a 460px scene and supporting grid below. At 640px, 16px page insets, compact header, 350px scene, compact toolbar, stacked panel layouts and viewport-sized dialogs take over. At 360px, insets become 12px and the existing compact header/HUD tighten further.

The adventure extension adds a 600px breakpoint: the Pulse strip uses up to three columns with a 6rem minimum that adapts to enlarged text; action controls become a two-row grid with four proportional movement targets, a wide context action, Attack, Dodge and Sprint. Pulse readings become two columns; quest, skill and receipt rows wrap their actions. There is no fixed text width on IDs or error copy. The 320/390/768/1440 layouts and 200% text enlargement are covered by validation. Native zoom, physical devices and localized RTL layouts are not claimed as verified.

## Elevation & Depth

Ordinary UI uses tonal grouping and separators. The welcome/pause menu has a green translucent scene scrim and `0 12px 48px #1d312133` shadow, with no border. Native dialogs retain their original shadow and backdrop, without nested decorative cards. Buttons have structural borders; selected inventory/equipment has an accent state. The Pulse strip is a flat action row with separators.

The canvas sorts characters, nodes, enemies and drops by world Y. Pixel shadows, foliage, cave lighting, weapon arcs, dodge trails and boss telegraphs belong to that art layer. The boss health bar is an actual DOM progress control above the scene. Essential simulation can be paused; decorative bobbing, particle motion and interpolated camera following stop under reduced motion.

## Shapes

`--radius-control` is 10px. The game/HUD and menu use 16px radii, reduced to 12px on mobile. Next-step grouping is 14px. Inventory and sprite frames use 10px, toolbar controls 8px, key hints 3–4px, and dialogs 20px desktop / 16px mobile. Pixel art intentionally keeps square edges. Text reflows instead of being clipped to art geometry.

## Components

- **Buttons:** `.sq-button`, `.sq-primary`, `.sq-danger`, `.sq-text-button` and `.sq-icon-button` in `survival.css`. Start/Continue and the context action are emphasized. Attack/Dodge are neutral peers. Controls expose disabled, pressed, focus and hover states. Craft costs and locked requirements remain visible beside unavailable actions. Most actions have 44px minimum height; narrow direction targets meet the 24px baseline, without claiming all are 44px wide.
- **World:** `SurvivalMap` in `src/components/survival-map.tsx` accepts the live state ref, running state and action callbacks. `paintWorld` draws actual saved world state. Keyboard, pointer paths and direction buttons share collision. Space attacks, Q dodges, R eats and E interacts. The named canvas is focusable during play. Panels, pause, hidden tabs and defeat stop simulation.
- **Meters:** `Meter` in `index.tsx` uses labeled native meters, with numeric health/stamina. XP, quests and boss health use labeled progress elements. The food number and equipment summary supplement the world view.
- **Dialogs:** `Dialog` in `dialog.tsx` uses native `showModal()`, a named heading, Escape/backdrop dismissal, focus trapping and restoration. The existing responsive panel styling supplies scroll containment and viewport limits. Panels reached by a canvas shortcut return focus to the canvas.
- **Inventory/equipment:** Item slots expose counts, selection, use/drop actions and three real filters. Equipment buttons call `equip`; armor has a pressed toggle. Crafting a weapon equips it automatically, while the crafting row says Crafted once owned. The tool row includes axe, pickaxe, pack and lantern.
- **Craft/build:** `CostLine` presents actual available/required materials. Recipe and building rows show real effects, levels and costs. Rest/harvest appear with their structures. Building has fixed, visible world sites.
- **Progression:** Story/side/daily quest rows show their objectives and claim states. `learn` spends a real earned skill point, up to three ranks. Achievements derive from game state. The next-step panel points from tools and shelter toward the cave and boss.
- **Chain Pulse:** `PulseStrip` exposes connection, hamster status, RPM, reported provenance, settled height and explicitly labeled wheel-data age in one button. `PulseDetails` displays source links, pending encounters, transaction snapshot evidence, measurement receipts, derived activity/coverage and reconnect. Unknown is explicit; historical field notes retain their dates and do not imply hardware provenance. Find encounter starts an actual forest path, and Record is disabled after its one receipt reward.
- **Persistence/recovery:** Stable status regions expose action/save feedback. New game has a consequence-specific confirmation. Imports validate before replacing progress; invalid imports preserve it. Export is an actual local JSON download. Storage errors keep recovery guidance visible.
- **Art:** `Icon`, `Hamster`, `ItemIcon`, original canvas drawing functions and the preserved valley illustration are the reuse points. Added blade, armor and lantern sprites are original local SVGs. The local 1200×630 survival share card retains the established game branding; favicon and metadata remain in `_document.tsx`.

High-frequency transitions name their properties and use approximately 120ms ease-out. Press feedback uses scale 0.96 only when motion is permitted. Theme switches temporarily suppress transitions. Existing global focus is a 3px perimeter with 4px offset; the canvas uses an inset light ring. Forced-colors styling retains system focus and control borders.

## Do’s and Don’ts

- Add a panel through `Dialog`, the six-size scale and semantic surface/text tokens. Keep actions beside the state they change.
- Keep world art and UI roles separate; use the pixel renderer for world effects and native elements for readable controls.
- Preserve the game and Start/Continue on the first phone screen. New explanations belong in the guide or journal.
- Derive counts, costs, unlocks and rewards from state. Distinguish reported hardware, simulated, replay, derived and unknown provenance.
- Keep Unknown and retry/export recovery visible when data or persistence fails. Never substitute plausible measurements.
- Preserve native controls, labels, dialog focus and reduced-motion behavior. Avoid decorative badges, redundant summaries, tracked capital kickers and extra font/icon dependencies.

The six-domain review, source findings, fixes, measured checks and remaining limitations are in `artifacts/validation.md`. Better Interface and Impeccable guidance credits and licenses are retained in `artifacts/ATTRIBUTION.md` and `artifacts/licenses/design-guidance.txt`.
