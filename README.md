# Watch Brand Map

A plain-English watch buying guide: how to buy a mechanical watch without getting burned, 25 standout picks with where to buy each one, and about 130 brands sorted by price.

It's a single static page with no build step, no tracking and no third-party requests. Fonts and photos are served from this repo. Outbound links to brand and shop sites are plain links.

## Layout

| Path | What it is |
|---|---|
| `site/` | The published page: `index.html`, `app.js`, `style.css`, `favicon.svg`, `favicon.ico`, `img/`, `fonts/`. |
| `tools/build_site.py` | Rebuilds `site/` from a single-file HTML export: moves inline script and styles into files, swaps hosted fonts for `tools/fonts/`, copies the favicon from `tools/`, adds the Content-Security-Policy. |
| `.github/workflows/pages.yml` | Deploys `site/` to GitHub Pages on every push to `main`. |

## Updating

```
python3 -I tools/build_site.py <export.html> <images-dir> tools/fonts site
git commit -am "Update guide" && git push
```

The build replaces `site/` entirely, so pass an images directory that holds every photo in `site/img/`, and make sure each pick in the export has its `img` path set.

Preview locally with `python3 -m http.server -d site 8000`.

## Security

- Content-Security-Policy is set in a `<meta>` tag (GitHub Pages can't send custom headers): scripts, styles, images and fonts only from this site, no forms, no outbound connections.
- The workflow runs only on pushes to `main`, uses minimal token permissions per job, and pins every action to a commit SHA.

## Credits

Fonts: Bodoni Moda, Inter and JetBrains Mono, under the SIL Open Font License 1.1. Watch photos are the brands' own product images, taken from each brand's website or, where that wasn't possible, from a shop listed on the pick's card. Prices were checked in November 2026 and change often.
