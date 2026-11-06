# Attribution

The hamster, valley artwork, favicon, share illustration, interface and game code were created for SqueekQuest. The source is available under the root MIT license. SqueekChain is a separate project; its names, data and NFT artwork are not claimed as original SqueekQuest assets.

- Live network data and the NFT artwork shown at runtime come from [the official SqueekChain API](https://api.squeekchain.com/v1/status). Captured read responses in `tests/fixtures/` are dated 2026-11-06 and are test inputs, never a fallback data feed.
- Nunito Sans is distributed under the SIL Open Font License. The local WOFF2 is from `@fontsource-variable/nunito-sans` 5.3.0. Its notice and license are in [`public/fonts/OFL.txt`](../public/fonts/OFL.txt).
- Design guidance: Jakub Krehel's [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`, MIT. Applied to accessibility, layout, writing, typography, color, and UI review.
- Design documentation method: Paul Bakaus's [Impeccable document guide](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, Apache-2.0. The pinned, adapted guidance was used to document the implemented source. Its provided combined license text is preserved in [`licenses/design-guidance.txt`](licenses/design-guidance.txt).

The application uses Next.js, React, Zod and Tailwind CSS. Development verification uses TypeScript, tsx, Playwright and axe-core. Their packages and versions are recorded in the lockfile; package licenses remain with their respective owners.
