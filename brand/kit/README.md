# Lumo logo kit

A firefly seen from above: its tail is the light ("lumo"). The wordmark is "lumo" in Outfit, outlined.

## Colours

| Role | HEX | RGB | Use |
|---|---|---|---|
| Glow | `#5CC8FF` | 92, 200, 255 | the firefly's tail; the brand's light blue |
| Halo | `#D6F1FF` | 214, 241, 255 | soft glow behind the tail |
| Wing | `#9FB8CC` | 159, 184, 204 | wings |
| Navy | `#12304A` | 18, 48, 74 | body and wordmark on light backgrounds |
| Night | `#0D1B26` | 13, 27, 38 | dark background |
| Ice | `#CFE6F5` | 207, 230, 245 | body and wordmark on dark backgrounds |

Light blue is reserved for the glow. Text and the body never use it, so the light stays the one bright thing.

## Which file

| Need | File |
|---|---|
| Docs header, README, website on light backgrounds | `lumo-horizontal.svg` |
| On dark backgrounds | `lumo-horizontal-dark.svg` (or the symbol: `lumo-symbol-dark-transparent.svg`) |
| Square spaces, posters, splash screens | `lumo-stacked.svg` |
| The firefly alone | `lumo-symbol.svg` |
| 16–32 px (favicons, tabs) | `lumo-symbol-small.svg`, `favicon.ico`, `favicon.svg` |
| One colour (print, engraving, stamps) | `lumo-symbol-{black,white,navy}.svg`, `lumo-horizontal-{black,white,navy}.svg` |
| Discord server, app or extension icon | `lumo-app-icon.svg`, `icon-512.png`, `icon-192.png` |
| Android adaptive icon | `maskable-512.png` (keeps the bug inside the 80% safe zone) |
| Website `<head>` | `head-snippet.html` with `site.webmanifest` and the favicon files |
| The word alone | `lumo-wordmark.svg`, `lumo-wordmark-dark.svg` |

PNG renders at 1200 px sit next to each SVG (`*-1200.png`) for tools that can't take SVG.

## Clear space and minimum size

- Keep clear space around the logo equal to the height of the firefly's head (about 1/7 of the symbol's height) on every side.
- Horizontal lockup: at least 120 px wide on screen, 30 mm in print.
- Symbol: at least 24 px; below that use `lumo-symbol-small.svg` (thicker antennae and wings), down to 16 px.

## Don't

- Recolour the glow or the wordmark, or put the full-colour logo on mid-tone or busy backgrounds; use a one-colour version instead.
- Stretch, rotate, outline, add shadows or glows, or redraw the letters in another typeface.
- Rearrange the lockup or change the spacing between the firefly and the word.
- Use the full-colour symbol below 24 px.

## Type

The wordmark is Outfit SemiBold (600), converted to outlines, so the logo files need no font installed. Outfit is
licensed under the SIL Open Font License 1.1 (free for logos); the licence is in
`brand/fonts/OFL.txt`. Outfit also works for headings near the logo.

## Source

`../build_kit.py` builds every SVG here from code; `../outfit_wordmark.py` re-outlines the wordmark from the font.
Change a colour or a proportion there and rebuild, rather than editing the SVGs by hand.
Trademark clearance for the name and mark has not been checked.
