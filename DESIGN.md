# SqueekQuest design system

## Overview

SqueekQuest is a small desktop web survival adventure with a responsive touch layout. It retains the established hamster identity, locally bundled Nunito Sans, forest greens, warm oats and quiet rounded controls. Original pixel sprites carry the survival world; the earlier illustrated valley remains in Sunflower scramble. The game and its Start/Continue action precede explanatory content, including at 390 pixels wide.

The source of truth is `src/styles/globals.css` (existing tokens, base controls and original mini-game), followed by `src/styles/survival.css` (active survival UI). `src/pages/_app.tsx` imports them in that order. No framework or dependency configuration was changed.

## Colors

Use the existing hexadecimal semantic tokens; components reference their roles rather than introducing another palette. Themes use `html[data-theme='dark']`. Scene art has a separate, intentional pixel palette and does not recolor with the page theme.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--page` | `#f7f8f2` | `#17231d` | Page background |
| `--surface` | `#fffefa` | `#213028` | HUD, controls, menu and dialogs |
| `--surface-alt` | `#edf1e4` | `#2a3b30` | Inventory tiles, neutral grouping, meter tracks |
| `--ink` | `#293729` | `#edf1e3` | Main text |
| `--muted` | `#646e5d` | `#b1bdab` | Secondary text and counts |
| `--line` | `#dfe5d7` | `#3e5140` | Separators |
| `--control-line` | `#87927c` | `#81947d` | Button and input borders |
| `--accent` | `#2f5b3e` | `#c2d59b` | Primary actions and progress |
| `--accent-hover` | `#244b31` | `#d0dfa9` | Primary action hover |
| `--on-accent` | `#fffefa` | `#223820` | Filled-action text |
| `--accent-soft` | `#e9efdb` | `#344a31` | Next-step grouping and selected support surfaces |
| `--warm` | `#f3ecd9` | `#3a3827` | Storage recovery notice |
| `--warm-ink` | `#725a32` | `#e5d2a2` | Warm labels, rewards and upgrade descriptions |
| `--focus` | `#456d36` | `#d2dfa5` | Keyboard focus |
| `--error` | `#934330` | `#f6b29b` | Missing materials, destructive action, save errors |
| `--health` | `#a5534b` | `#e6a69b` | Health label and meter |
| `--stamina` | `#8c7938` | `#d8c37d` | Stamina fill |

`--scene-frame: #293f32` frames the world. The canvas focus perimeter uses `#f3dda3`; scene labels use solid `#2d4736` behind `#f9f4df` text. `PALETTES` in `survival-map.tsx` defines each area’s ground, path, tree, foliage and trunk colors. Violet rectangular brambles identify damage; the field guide and damage feedback give a textual explanation as well.

Measured text contrast and its coverage limits are recorded in validation. Do not infer canvas-art contrast from the DOM-only design probe.

## Typography

The existing local variable WOFF2 is `public/fonts/nunito-sans-latin.woff2`, loaded by `public/fonts/nunito.css` for normal weights 400–800. The stack is `'Nunito Sans', ui-sans-serif, system-ui, sans-serif`. The survival interface uses three weights: 400, 600 and 800.

| Token | Size | Use |
| --- | --- | --- |
| `--text-xs` | `0.75rem` / 12px | Counters, captions, key hints, compact touch labels |
| `--text-sm` | `0.875rem` / 14px | Button labels, descriptions and panel copy |
| `--text-base` | `1rem` / 16px | Body, inputs, recipe/quest titles |
| `--text-lg` | `1.25rem` / 20px | Sidebar titles, mobile menu title, small dialog titles |
| `--text-xl` | `1.75rem` / 28px | Desktop menu/dialog titles and narrow page title |
| `--text-display` | `2.5rem` / 40px | Wide page title |

Body line-height is 1.5; descriptions use 1.55–1.6; headings use 1.15–1.35. The page display title tracks at −0.045em, changing to −0.025em at 960px and below. Other headings use −0.01 to −0.03em. Content uses natural case. Headings balance; paragraphs wrap with `text-wrap: pretty`. Inputs stay at 16px. Dynamic numeric values use tabular figures. Keyboard hints use the same sans family in the survival UI; the original mini-game retains its existing hints.

## Layout

`.sq-header-inner` and `.sq-page` share a maximum width of 1440px and 42px desktop side insets. The main layout is `minmax(0, 1fr) 290px` with a 32px gap, keeping the game dominant. The sidebar groups next action, current supplies, daily progress and the mini-game. Space groups content before separators; nested bordered cards are avoided.

The spacing rhythm uses 4/8/12/16/20/24/28/32px steps, with a few optical adjustments. The HUD sits directly on the scene. The scene contains the location label and a small overview map. Interaction controls and five panel controls follow it in normal document flow. Save recovery is a visible notice above the game; status feedback sits below the controls and inside open dialogs.

Implemented breakpoints:

- **1180px:** 28px page/header insets, 250px sidebar, 24px grid gap; keyboard badges leave the toolbar.
- **960px:** one main column, 460px scene, 28px page title, three-column sidebar; mini-game teaser spans the sidebar.
- **640px:** 16px insets, compact header, 350px scene, four direction buttons, compact Sprint icon and five icon/label controls; their grid adds rows when text is enlarged. The header and HUD also wrap rather than overlap. Sidebar becomes two columns with the next step spanning both. Dialogs use viewport-minus-24px width, at most 92dvh, with internal scrolling. Inventory becomes three columns and item details move below. Recipes wrap actions to a separate line. Buildings and milestones become one column. Map cards become horizontal rows. Footer stacks.
- **360px:** 12px insets, reduced header art and tighter movement/HUD spacing. Controls still meet the 24px baseline or spacing exception.

Browser validation covers 320, 390, 768 and 1440px, with panels inspected at 390 and 1440 in both themes. See validation for 200% text enlargement and other stress-test coverage. Native browser zoom, RTL localization and physical devices are not claimed as tested.

## Elevation & Depth

Ordinary game UI uses tonal grouping and separators. The welcome/pause menu floats over a translucent green scene scrim with `0 12px 48px #1d312133`. Native dialogs use `0 18px 90px #172c3250` and a `#20352be0` backdrop with 3px blur. These elevated surfaces have no border. Buttons use borders for affordance; selected inventory tiles use a 2px accent border for state. No gradient text or decorative infinite animation is used.

The world is drawn in depth order by world Y coordinate, so the hamster can walk behind trees. Pixel shadows, roofs, water edges and ground patches belong to the art layer rather than the web surface system.

## Shapes

`--radius-control` is 10px. The game/HUD perimeter and menu use 16px desktop radii, reducing to 12px on mobile. The next-step panel uses 14px; inventory tiles and sprites use 10px; toolbar controls use 8px; key hints use 3–4px. Dialogs use 20px desktop and 16px mobile. The canvas is rectangular and clips at the scene boundary; text containers wrap rather than clip. Pixel sprites deliberately retain square edges.

## Components

- **Buttons:** `.sq-button`, `.sq-primary`, `.sq-danger`, `.sq-text-button` and `.sq-icon-button` in `survival.css`. Normal actions have a surface background and structural border. Start/Continue and the current interaction are filled. Disabled craft/build actions retain their adjacent material requirements. Targets usually have a 44px minimum height. The phone direction buttons are 30px wide (25px below 360px); this is a deliberate compact game control with a 24px baseline, not a 44px claim. Native button semantics, hover, pressed, focus and disabled states are implemented.
- **World:** `SurvivalMap` in `src/components/survival-map.tsx` renders the actual map and character via `paintWorld`, uses time-based movement, collision-aware pointer paths, camera following and proximity interactions. Canvas has a named, keyboard-focusable group while playing. Keyboard bindings and touch controls are equivalent for movement. Decorative scene overlays do not intercept input. Game pause, panel opening and tab visibility stop simulation. Reduced motion removes camera interpolation while preserving essential player movement.
- **Meters:** `Meter` in `src/pages/index.tsx` uses native labeled `meter` elements plus numeric health/stamina labels; XP and quests use labeled `progress` elements. Numbers and text supplement color.
- **Panels:** `Dialog` in `src/components/dialog.tsx` uses native `showModal()`, Escape/backdrop dismissal, a named heading and focus restoration. Survival styling adds responsive widths and scroll containment. Closing a panel restores focus to its trigger; panels opened from a canvas shortcut return to the world. The world stays paused while a panel is open.
- **Inventory:** `.inventory-slot` and `.item-detail` in the inventory panel expose item quantities, selection, description and real use/drop actions. `.sq-segmented` filters all items, materials and supplies. Empty slots retain visible names. Tools are a separate persistent row. Capacity errors explain ways to make space.
- **Craft/build:** `CostLine` displays actual owned/required quantities with item sprites. `.recipe-row` shows the recipe, effect, cost and craft/equipped state. `.building-card` separates current benefit from the next upgrade and shows real level and cost. Rest and harvest actions appear after their corresponding structure exists.
- **Quests and milestones:** `.journal-quest` exposes objective, progress, reward and claim state. Claims are disabled until ready and after claim; milestones use words and an icon to show locked/unlocked state.
- **Persistence:** recovery notices and stable `role='status'` regions expose save failures and action results. The profile’s visible name label remains after entry. New game has a consequence-specific confirmation; imports validate before replacing state; export creates a JSON download.
- **Art/icons:** reuse `Icon` and `Hamster` in `icons.tsx` for interface artwork. `ItemIcon` in `item-icon.tsx` contains original crisp local SVG pixel sprites. Avoid adding an icon or font dependency. The old `GameMap`, `valley.svg` and hamster illustration remain for the foraging mini-game. `public/survival-card.png` is a 1200×630 capture of the current product for sharing.

High-frequency button transitions name background color, transform and border color at 120ms ease-out. Press scale is 0.96. They run only with `prefers-reduced-motion: no-preference`. Theme changes temporarily suppress transitions. Focus uses the existing 3px perimeter with 4px offset; the canvas uses an inset 3px light perimeter. Forced-colors rules preserve system focus and button borders.

## Do’s and Don’ts

- Start another survival panel inside `Dialog`, use its named heading, and keep actions adjacent to the content they change.
- Reuse the existing semantic tokens, six-size scale, 400/600/800 weights and locally bundled font. Keep game art separate from text contrast roles.
- Show costs, capacity and locked requirements from actual state. Keep success feedback and disabled explanations visible.
- Keep the game and primary action in the first phone viewport. New supporting content belongs after the adventure.
- Preserve native links, buttons, labeled inputs and dialog focus behavior. Add explicit accessible names when responsive CSS hides visible labels.
- Do not put a shadow and decorative border on the same surface, animate every page change, add small tracked capital kickers, or restore a remote data dependency to this offline game.

The six-domain review, measured findings and remaining test limitations are in `artifacts/validation.md`. Guidance credits and complete license notices are preserved in `artifacts/ATTRIBUTION.md` and `artifacts/licenses/design-guidance.txt`.
