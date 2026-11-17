# Watch Brand Map

A plain-English watch buying guide: how to buy a mechanical watch without getting burned, 25 standout picks with where to buy each one, and more than 400 brands rated for fame, value, credibility and character, shown on a map and in a list, with sorting and filters to find the good ones.

It's a single static page with no build step, no tracking and no third-party requests. Fonts and photos are served from this repo. Outbound links to brand and shop sites are plain links.

## Layout

| Path | What it is |
|---|---|
| `site/index.html` | The page: masthead, the how-to-buy guide and the empty containers the script fills. |
| `site/app.js` | All the data (brand tiers, links, the 25 picks with their specs) and the code that draws the cards and the brand index. |
| `site/ratings.js` | One line per brand: four 1–5 ratings (known, value, cred, cool), an approximate count of model lines and an "unusual" flag. All opinion. "Worth a look" is worked out in `app.js` from value, cred and cool, never from fame. |
| `site/map.js` | The brand map above the index: every brand as a dot, placed by cost, desirability (cred plus cool) and value. There are three views, and each puts two of the three on the axes and shows the third as colour. Picks have a yellow ring, and brands that mostly sell a logo are hollow. It's a hand-drawn SVG chart with no library. It reads the brands and the current filters from `app.js`, so the filters work on the map and the list together, and the list is the same data as a table. Choosing a dot shows that brand under the chart, with a button that finds it in the list. The Hide map button is remembered between visits. |
| `site/dials.js` | The masthead dial: thirty designs after well-known watches and clocks, all showing the reader's local time. Each page load shows a random one the visitor hasn't seen yet, and the record starts again once all thirty have been shown. The menu under the dial chooses one for the current visit, Pin keeps it on every visit, and Randomize shows another at random and removes the pin. Clicking the dial steps to the next. Add `?dial=N` to the address to see a particular one. Each design is described once as a list of parts, and the same list feeds the lit renderer and a flat canvas drawing that is used when WebGL is not available. How each part is finished (polished, brushed and in which direction, blasted, lacquer, matte, lume) is set in the design's `fin` field. For testing, `?time=HH:MM:SS` fixes the hands, `?light=x,y` fixes the lamp, `?gl=0` forces the flat drawing and `?debug` exposes `window.__wbmDial`. |
| `site/dial3d.js` | The lit renderer for the dials, hand-written WebGL with no library. It turns a design's parts into height, colour and finish maps, then shades them with a lamp that follows the pointer (on a phone, the lamp follows how the phone is tilted instead, rests a little to the right for a right thumb, and on iOS starts after a first tap, which asks permission for motion; the dial is full width and centred there), so polished, brushed and matte surfaces catch the light differently. The lists of finishes and of default finishes per part are at the top of the file. |
| `site/style.css` | The design: one typeface (Jost), a ruled grid, and blue, red and yellow used as signals. |
| `site/img/` | Photos of the picks, plus one small `b-*.jpg` thumbnail per brand in the index. |
| `site/fonts/` | Jost, served from this repo. |
| `research/dial-finishes/` | The research behind the dial finishes: one `design-NN.json` per dial, numbered as in the dial menu. Each names the real watch or clock it follows and lists every surface seen from the front with its material, its finish, the direction of any brushing, a confidence level and a source. It also notes how the piece catches light and which mistakes to avoid. It is not part of the published site. `site/dials.js` holds the finishes actually used, in each design's `fin` field. |
| `.github/workflows/pages.yml` | Deploys `site/` to GitHub Pages on every push to `main`. |

## Updating

Edit the files in `site/` directly, then commit and push. Every brand in `TIERS` needs a line in `ratings.js` under the same name. A pick's `brandKey` is the name of its brand in `TIERS`; where the two are spelled differently, add the pair to `PICK_ROW` in `app.js`. The map needs no upkeep: it draws whatever is in the index. To add a brand thumbnail, put a square JPEG in `site/img/` and set `"img"` on that brand's entry in `LINKS` in `app.js`. Each pick's `specs` object holds its movement, case, water resistance and crystal.

Preview locally with `python3 -m http.server -d site 8000`.

## Security

- Content-Security-Policy is set in a `<meta>` tag (GitHub Pages can't send custom headers): scripts, styles, images and fonts only from this site, no forms, no outbound connections.
- The workflow runs only on pushes to `main`, uses minimal token permissions per job, and pins every action to a commit SHA.

## Credits

Font: Jost, under the SIL Open Font License 1.1. Watch photos are the brands' own images, taken from each brand's website or, where that wasn't possible, from a shop listed on the pick's card. Movement and case details come from the makers' and shops' product pages. Prices were checked in November 2026 and change often.
