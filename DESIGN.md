# SqueekQuest design system

## Overview

SqueekQuest is a relaxed exploration game for the SqueekChain community. The interface pairs a hand-drawn woodland valley with a restrained field-station dashboard: oat paper, forest ink, rounded typography, small line icons and generous whitespace. The game is the first product surface, followed by quests and verifiable network data. This direction was inferred from the hamster adventure brief.

The map is original SVG artwork in `public/art/valley.svg`; the movable hamster is the `Hamster` component in `src/components/icons.tsx`. The valley remains daylight artwork in both themes. Dark mode changes the surrounding application surfaces and controls, preserving the artwork's identity.

## Colors

Canonical semantic tokens are in `src/styles/globals.css`, in `:root` and `:root[data-theme='dark']`. Components use these role names. The Tailwind theme in the same file supplies the Nunito Sans family and supporting forest/oat values; semantic tokens are the component styling boundary.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--page` | `#f7f8f2` | `#17231d` | Page canvas |
| `--surface` | `#fffefa` | `#213028` | Header, game shell, panels and dialogs |
| `--surface-alt` | `#edf1e4` | `#2a3b30` | Secondary controls and quiet grouped areas |
| `--ink` | `#293729` | `#edf1e3` | Main text |
| `--muted` | `#646e5d` | `#b1bdab` | Descriptions and secondary data |
| `--line` | `#dfe5d7` | `#3e5140` | Structural separators, not control boundaries |
| `--control-line` | `#87927c` | `#81947d` | Input and select boundaries |
| `--accent` | `#2f5b3e` | `#c2d59b` | Primary action, selected navigation, progress |
| `--accent-hover` | `#244b31` | `#d0dfa9` | Primary action hover |
| `--on-accent` | `#fffefa` | `#223820` | Text on a filled primary control |
| `--accent-soft` | `#e9efdb` | `#344a31` | Selected and completed state surfaces |
| `--warm` | `#f3ecd9` | `#3a3827` | Daily challenge and notice surfaces |
| `--warm-ink` | `#725a32` | `#e5d2a2` | Text and icons on warm surfaces |
| `--focus` | `#456d36` | `#d2dfa5` | Keyboard focus ring |
| `--error` | `#934330` | `#f6b29b` | Form errors |
| `--scene-ink` | `#3e5034` | same | Focus on the daylight game map |

Map labels have opaque `#fbf9ed` backgrounds and `#3e5034` text so their readability does not depend on the drawing underneath. The welcome message uses opaque `#fffbed` and `#34462d`; game seeds use `#f5d882` and `#8d5e25`. These belong to the illustrated game rather than the application theme.

Statuses pair color with text or icons. A filled accent button gives one action primary emphasis within its task area. Secondary actions are tonal or text controls. The final automated contrast checks and their limits are recorded in `artifacts/validation.md`; colors over art are not asserted to have universal measured contrast.

## Typography

`public/fonts/nunito.css` loads local `nunito-sans-latin.woff2` with `font-display: swap` and a variable weight range of 400–800. The Latin font file is distributed with its OFL notice. The fallback stack is `ui-sans-serif, system-ui, sans-serif`. The browser check confirms the intended font loads in the export.

The application uses three weights: 400 for prose, 600 for labels, and 800 for headings and emphasis. System monospace is reserved for hashes, addresses, JSON and keyboard hints.

| Token | Size | Used for |
| --- | --- | --- |
| `--text-xs` | 12px / 0.75rem | Captions, source information, compact map controls |
| `--text-sm` | 14px / 0.875rem | Buttons, navigation, dense descriptions |
| `--text-base` | 16px / 1rem | Body, input text, small headings |
| `--text-lg` | 20px / 1.25rem | Section headings and compact metrics |
| `--text-xl` | 28px / 1.75rem | Mobile page title, desktop metrics |
| `--text-display` | 40px / 2.5rem | Wide-screen page title |

Body line-height is 1.5; the display title uses 1.15 and `-0.045em` tracking, compact headings 1.3–1.35 and slightly tighter tracking. Mobile titles use 1.2 and `-0.035em`. Headings balance their lines; paragraphs use pretty wrapping where supported. Form controls stay at 16px on mobile. Changing numbers use tabular figures. Critical identifiers wrap with `overflow-wrap: anywhere`; they are never ellipsized.

## Layout

The header is centered inside 1,392px; the main wrapper is 1,312px including its 40px inline padding, leaving a 1,232px content area. Shared edges align the page introduction, game and dashboard. The desktop adventure grid has a flexible game column, 328px quest sidebar and 28px gap. The explorer is a single flat surface with progressive disclosure for raw details.

Spacing mostly follows 4px steps: 8–12px inside control groups, 16–24px within sections and 28–44px between major groups. Optical insets such as 18px or 22px are implemented exceptions. CSS uses logical margins/padding for content flow; physical positioning is reserved for actual map geometry and fixed visual anchors.

| Breakpoint | Implemented behavior |
| --- | --- |
| Above 1,500px | Larger top breathing room and header insets |
| At 1,200px | Tighter header, 300px sidebar, smaller page insets |
| At 1,000px | Compact title/header, 280px sidebar, reduced game chrome |
| At 760px | Header navigation becomes an in-flow four-button section switcher; adventure stacks; quests use two columns; mobile direction controls appear during play |
| At 480px | 16px page insets, single quest column, 28px title, 1.35 map aspect ratio, compact explorer rows, stacked NFT card and mission cards |
| At 350px | Extra-tight header and map labels, simpler seed progress icon treatment |

Desktop maps use a 1.9 aspect ratio above 1,000px and 1.6 at intermediate widths. The game grid is 17 by 11; positions and station destinations come from `src/lib/game.ts`. Map clicks are converted to bounded grid positions. The absolute welcome message moves to the upper map at phone sizes to keep the burrow and station labels clear.

Measured reflow widths are 320, 390, 760, 1,024 and 1,440px across all four views. The game and its Start adventure control fit within a 390×844 first screen. Native 200% browser zoom, RTL mirroring and physical-device rendering were not verified.

## Elevation & Depth

Panels rely on tonal separation, not border-plus-shadow stacks. Thin separators divide records and sections. Map labels use a small unbordered offset shadow; the welcome message has a small ground shadow. Native dialogs use one soft shadow and a translucent blurred backdrop. Inputs use the stronger control-boundary token. Focus uses a separate 3px outline with a 4px offset; the map draws it inside the scene using `--scene-ink`.

The map is an isolated clipped scene. Its artwork, seeds, station labels, player, welcome message and pause overlay have explicit layer order. Interactive overlays never mask document content, and the notification is in normal flow rather than fixed over the game.

## Shapes

`--radius` is 20px for application surfaces. Buttons are 12px, fields and icon buttons 10px, small state tags 6px, map labels 7px, and desktop dialogs 24px (20px on phones). Avatar and achievement emblems are circular. The art uses soft organic forms; the data UI retains aligned rectangular rows.

Clipping is used for the scene, avatar artwork, progress fills and bar charts. Text containers wrap and grow naturally.

## Components

| Component/pattern | Source | Use and behavior |
| --- | --- | --- |
| `GameMap` | `src/components/game-map.tsx` | Ready, playing, paused and complete states; click/keyboard/touch movement; seed collection; station arrival; optional sound activation; announcements and replay |
| `Dialog` | `src/components/dialog.tsx` | Native modal with `title`, `onClose`, `wide` and children. Opens with `showModal`, closes with Escape, backdrop or Close, and restores trigger focus |
| `Icon`, `Hamster` | `src/components/icons.tsx` | One decorative SVG icon system at 1.7px stroke and a reusable original hamster illustration |
| `.button.primary` / `.secondary` | `src/styles/globals.css` | 46px minimum-height actions with hover, focus, pressed and disabled states. Labels say what the action does |
| Header, `.mobile-nav` | `src/pages/index.tsx` | Hash navigation across Adventure, Quest journal, Chain explorer and Leaderboard; active state has text plus a surface cue |
| `Metric`, `Dashboard` | `src/components/chain-views.tsx` | Stable label/value/note hierarchy, with distinct unavailable or stale descriptions |
| `Notice`, `Source` | same | Loading, retryable error, stale-read state, public source link, check time and optional safe block |
| `Explorer` | same | Section controls above their content, search/category filter, pagination, no-results recovery and record inspection |
| `SettlementDetail`, `EventDetail` | same | Full hashes, provenance, structured facts, explorer links and disclosed raw event payload |
| `NftLookup` | same | Visible ID label, submit validation, focus on invalid input, loading/error/success, full ownership information and optional quest logging |
| Quest, achievement and run rows | `src/pages/index.tsx` | Local completion and locked states, readable evidence, sorting, editing and progress export |

Keyboard focus is visible. Icon-only controls have names. The sound toggle has a stable name and `aria-pressed` state. A stable live region reports game progress and a separate stable region reports app updates. Source notices use routine status announcements. Native controls handle ordinary form and navigation interaction.

Motion is opt-in under `prefers-reduced-motion: no-preference`: 120ms movement, a 240ms small player scurry during travel, a 3s seed wiggle during play, and a loading icon rotation. Reduced motion removes animations and transitions, while keeping static progress cues. Controls transition only named properties for 150ms and scale to 0.96 on press. Theme changes suppress transitions for an immediate swap. Audio is off by default and never blocks play.

## Do's and Don'ts

- Start a new view inside `.page-wrap`; retain the single page title and shared navigation.
- Use semantic colors, one of the six type sizes, and the existing button/notice/source patterns. Keep data provenance near the data it explains.
- Put a clear recovery action next to unavailable data. Preserve the distinction between optimistic work, safe chain records, and local game XP.
- Use flat record rows for comparable data, with the same column order and labels. Disclose raw data in native `details`.
- Keep all identifiers available in full. Preserve 16px mobile inputs and the 3px keyboard focus ring.
- Do not introduce unrelated gradients, glow effects, new fonts, extra heading kickers, nested decorative cards or a second icon system.
- Do not turn local records into a claimed global leaderboard, or game XP into a token balance.

To add another explorer surface, extend the typed API boundary, supply a validated `Resource`, then reuse `Notice`, `Source`, `Metric` and a flat row/detail pattern. Add it to the existing explorer section group and check both themes and narrow reflow before documenting the new behavior.
