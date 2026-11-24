# Model photos: work in progress (handoff)

This branch (`claude/model-photos-wip`) holds unfinished work to add a photo to each "Main models" line in the brand index. It starts from `claude/sharp-faraday-c1nt1l` (PR #15), so it already has the Main models feature and the 384 model lines in `site/models.js`. Nothing in this folder is published: `site/` only serves files under `site/`, and this folder sits outside it. Delete the folder once the photos are in.

## What's already done (on PR #15)

- `site/models.js` has `MODELS`: 3 to 6 main model lines for each of the 96 recommended brands (384 lines). Each line has `name, type, sizes, movement, price, desc, url`.
- `site/app.js` (`modelsHtml`) draws a Main models list under each brand row and in the map panel. **A line shows a 72px thumbnail when it has `pic`**, a site-relative path such as `"img/m-tudor-black-bay-58.jpg"`. CSS is in `site/style.css` under `.models`.
- The site's Content-Security-Policy allows images only from the site itself, so every photo must be a local file in `site/img/`.

## Photo status

| Source | Lines tried | Usable photo | Where |
|---|---|---|---|
| Shopify stores (`/search/suggest.json` and `/products.json`) | 101 | 61 accepted | `data/shop_final.json`, files in `pics/` |
| Plain page scrape (`og:image` on the model's page) | 323 | 44 accepted | `data/gen.json`, files in `pics/` |
| Headless-browser pass (largest product image on the page, element screenshot) | 279 | 80 captured, **not yet reviewed** | `data/browser.json`, files in `raw/` |

In `shop_final.json` and `gen.json`, each entry is keyed `"Brand|index"`, where `index` is the line's position in `MODELS[Brand]`. An entry with `"pic"` is accepted, and `pic` is the file name in `pics/` (240x240 JPEG on white). Entries with status `rejected` were checked by eye and turned down: wrong model, a strap or bracelet only, a logo, a duplicate, or a placeholder. `pics/` still holds a few rejected files, so trust the JSON, not the folder.

In `browser.json`, an entry with `"raw"` points to a screenshot in `raw/` (up to 800px). None of these has been checked yet.

About 105 of 384 lines have an accepted photo so far.

## Next steps

1. **Review the 80 browser captures.** Make each one 240x240: crop wide images to a centred square, then fit on white, as `scripts/dl.py` does for downloads. Build a contact sheet and reject bad matches (logos, lifestyle shots with a tiny watch, wrong model, straps). The browser pass picked links by matching model-name words, so check every one.
2. **Retry the misses where it's worth it.** Statuses `nolink`, `noimg`, `noog` and `ERR` mean no photo yet.
   - Several sites keep photos on image hosts this environment doesn't allow yet: `cdn.baltic-watches.com`, `cdn.sanity.io` (Furlan Marri), `cdn11.bigcommerce.com` (Formex), `image.oris.ch`, `static1.squarespace.com`, `images.ctfassets.net` (Breitling).
   - The environment's allowed-host list seems capped at about 120, and it's nearly full. To add hosts, swap out ones that aren't needed.
   - Casio, Cartier, Baume & Mercier and Habring² returned 403 (bot blocking).
   - Vostok, Jack Mason, Dekla, Straum and Selten have no site link in `LINKS`.
   - The user offered a third-party scraping service if needed. It would need its host allowed and an API key from the user.
3. **Publish.** Copy each accepted photo to `site/img/m-<brand>-<model>.jpg` (the names in `pics/` already follow this), set `"pic":"img/<file>"` on the matching line in `site/models.js`, and check the page in a browser. Run `python3 -m http.server -d site 8000`, search a brand and open Main models. Then commit, and update the README's Credits if needed. Photos are the makers' own product images, like the existing brand thumbnails.
4. **Optionally, check the model data.** The research agents ran out of web searches partway through, so some sizes and prices in `site/models.js` came from background knowledge. The research reports listed the unverified fields per brand. With the brand sites now reachable, the model pages found in `data/*.json` (`page`) are a quick way to confirm them.

## Scripts

All scripts read and write in the folder named by `WORKDIR` (default: the current folder). They expect `probe.json`, `rec.txt`, the JSON files above, and `pics/` and `pics/raw/` subfolders to sit there. To rerun, copy `data/*` into a working folder, make `pics/raw/`, and set `WORKDIR` to it. They also read `/home/user/watch-buying-guide/site/models.js` and `site/app.js` by absolute path, so change those paths if the repo lives elsewhere.

- `probe.py`: which brand sites are reachable and which run Shopify. Writes `probe.json`.
- `shopify.py`: Shopify search-suggest lookup per model. `shopify2.py`: the same against `products.json`. `combine.py`: picks the better match. Writes `shop_final.json`.
- `generic.py`: crawls each non-Shopify site's home and watch pages for a link matching the model, then takes `og:image`. Writes `gen.json`.
- `dl.py <file.json>`: downloads each `img`, makes the 240x240 JPEG in `pics/`, and draws a contact sheet `<file>_sheet.jpg`.
- `browser.js`: the Playwright pass. It renders each site, finds the model's page and screenshots its largest product image into `pics/raw/`. Writes `browser.json`. The container's preinstalled Chromium works with `require('playwright')`.

Network: this cloud environment allows the recommended brands' own sites (about 120 hosts, mostly `www.` forms) and `cdn.shopify.com`. Use `https` only: the proxy refuses plain `http`.

## Other research here

`research/micro-na.md` and `research/micro-asia.md` are notes from the microbrand scouting. Those brands are already in the index on PR #15.
