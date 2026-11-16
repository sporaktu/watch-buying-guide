# Watch Brand Map

A plain-English watch buying guide: how to buy a mechanical watch without getting burned, 25 standout picks with where to buy each one, and more than 400 brands sorted by price.

It's a single static page with no build step, no tracking and no third-party requests. Fonts and photos are served from this repo. Outbound links to brand and shop sites are plain links.

## Layout

| Path | What it is |
|---|---|
| `site/index.html` | The page: masthead, the how-to-buy guide and the empty containers the script fills. |
| `site/app.js` | All the data (brand tiers, links, the 25 picks with their specs) and the code that draws the cards and the brand index. |
| `site/dials.js` | The masthead dial: thirty designs after well-known watches and clocks, all showing the reader's local time. Each page load shows a random one the visitor hasn't seen yet, and the record starts again once all thirty have been shown. The menu under the dial chooses one for the current visit, Pin keeps it on every visit, and Randomize shows another at random and removes the pin. Clicking the dial steps to the next. Add `?dial=N` to the address to see a particular one. |
| `site/style.css` | The design: one typeface (Jost), a ruled grid, and blue, red and yellow used as signals. |
| `site/img/` | Photos of the picks, plus one small `b-*.jpg` thumbnail per brand in the index. |
| `site/fonts/` | Jost, served from this repo. |
| `.github/workflows/pages.yml` | Deploys `site/` to GitHub Pages on every push to `main`. |

## Updating

Edit the files in `site/` directly, then commit and push. To add a brand thumbnail, put a square JPEG in `site/img/` and set `"img"` on that brand's entry in `LINKS` in `app.js`. Each pick's `specs` object holds its movement, case, water resistance and crystal.

Preview locally with `python3 -m http.server -d site 8000`.

## Security

- Content-Security-Policy is set in a `<meta>` tag (GitHub Pages can't send custom headers): scripts, styles, images and fonts only from this site, no forms, no outbound connections.
- The workflow runs only on pushes to `main`, uses minimal token permissions per job, and pins every action to a commit SHA.

## Credits

Font: Jost, under the SIL Open Font License 1.1. Watch photos are the brands' own images, taken from each brand's website or, where that wasn't possible, from a shop listed on the pick's card. Movement and case details come from the makers' and shops' product pages. Prices were checked in November 2026 and change often.
