#!/usr/bin/env python3
"""Turn the Watch Brand Map artifact export into a self-contained static site.

Usage: python3 -I build_site.py <artifact.html> <images_dir> <fonts_dir> <out_dir>

- moves every inline <style> into style.css and every inline <script> into app.js,
  so the page runs under a strict Content-Security-Policy (script-src 'self'),
  which is set with a <meta> tag because GitHub Pages can't send custom headers
- drops the Google Fonts links and points at self-hosted fonts (fonts/fonts.css)
- copies img/*.jpg next to index.html (the page already uses relative img/ paths)
- fails loudly if the page starts loading anything else from another host
"""
import re, shutil, sys, pathlib

src, imgs, fonts, out = map(pathlib.Path, sys.argv[1:5])
html = src.read_text(encoding="utf-8")

styles = re.findall(r"<style>(.*?)</style>", html, flags=re.S)
scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
if not scripts:
    sys.exit("no inline script found; page layout changed, check by hand")
if re.search(r"<script[^>]+src=", html):
    sys.exit("page now loads an external script; review before hosting")

body = re.sub(r"<style>.*?</style>", "", html, flags=re.S)
body = re.sub(r"<script>.*?</script>", "", body, flags=re.S)
body = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*', "", body)
body = re.sub(r'<meta name="claude:[^"]*"[^>]*>\s*', "", body)
title_m = re.search(r"<title>(.*?)</title>", body, flags=re.S)
title = title_m.group(1).strip() if title_m else "Watch Brand Map"
body = re.sub(r"<title>.*?</title>\s*", "", body, flags=re.S)
inner = re.search(r"<body>(.*)</body>", body, flags=re.S)
inner = inner.group(1).strip() if inner else body

# anything still pointing off-site other than plain <a href> links?
for m in re.finditer(r'<(img|link|iframe|source|video|audio)[^>]+(src|href)="(https?:)?//', inner):
    sys.exit(f"external resource still referenced: {m.group(0)[:120]}")

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="A plain-English watch buying guide: how to buy without getting burned, standout picks, and a brand index by price.">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests">
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
{inner}
<script src="app.js" defer></script>
</body>
</html>
"""

if out.exists():
    shutil.rmtree(out)
(out / "img").mkdir(parents=True)
(out / "index.html").write_text(page, encoding="utf-8")
(out / "style.css").write_text("\n".join(s.strip() for s in styles) + "\n", encoding="utf-8")
(out / "app.js").write_text("\n".join(s.strip() for s in scripts) + "\n", encoding="utf-8")
for f in sorted(imgs.glob("*")):
    if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
        shutil.copy2(f, out / "img" / f.name)
shutil.copytree(fonts, out / "fonts")

# every img/... the script refers to must exist
missing = [p for p in re.findall(r'"img": "(img/[^"]+)"', "\n".join(scripts)) if not (out / p).exists()]
if missing:
    sys.exit(f"missing images: {missing}")
print(f"built {out}: {sum(f.stat().st_size for f in out.rglob('*') if f.is_file())} bytes")
