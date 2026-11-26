#!/usr/bin/env bash
# Shoot the six views of a 3D watch at a frozen time, for comparing before and after a change.
#
#   tools/watch3d-shots.sh <base-url> <dial-slug> <out-dir>
#   e.g. tools/watch3d-shots.sh http://127.0.0.1:8773/site/ slide-rule-chronograph /tmp/watch3d-now/navitimer
#
# Writes hero.png front.png side.png back.png clasp.png bracelet.png into <out-dir>: the whole page at a 1440 by 900
# window, with the watch showing in the masthead (?full=1) and its hands at 10:08:30. Each shot gets a fresh profile,
# so nothing a visit stores changes the next one.
#
# Renderer: headless Chromium draws on the graphics card (--enable-gpu) unless WATCH3D_RENDERER=software is set, which
# uses SwiftShader, Chromium's software renderer, instead. Use it when the graphics card cannot give WebGL (the check
# below then fails every view). The two renderers draw differently, so compare only sets shot with the same one. The
# script prints which it used and writes it to <out-dir>/renderer, which watch3d-compare.py checks.
#
# Each view is loaded twice: once for the picture, and once with --dump-dom to check that the 3D watch really was on
# screen (the stage has the class full and is not loading, and the watch's canvas is there and not hidden). Without
# that check a missing WebGL, or a build slower than the 20-second virtual time budget, would give a picture of the
# flat dial or of "Building the watch", and two such sets compare as identical. Each Chromium run has 90 seconds of
# wall-clock time. The script stops with an error when a run takes longer, a view fails the check or no picture is
# written. A face with no 3D watch of its own opens the default watch, as the page does; the label printed after each
# view names the watch that was shot.
# Compare two sets with tools/watch3d-compare.py.
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "usage: $0 <base-url> <dial-slug> <out-dir>" >&2
  exit 2
fi
base=$1 slug=$2 out=$3

chrome=""
for c in chromium chromium-browser google-chrome google-chrome-stable chrome; do
  if command -v "$c" >/dev/null 2>&1; then chrome=$(command -v "$c"); break; fi
done
if [ -z "$chrome" ]; then echo "no Chromium or Chrome found on PATH" >&2; exit 1; fi

case "${WATCH3D_RENDERER:-gpu}" in
  gpu) render=(--enable-gpu); echo "renderer: graphics card (--enable-gpu)" ;;
  software) render=(--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader)
    echo "renderer: software (SwiftShader)" ;;
  *) echo "WATCH3D_RENDERER must be gpu or software, not ${WATCH3D_RENDERER}" >&2; exit 2 ;;
esac
limit=90   # seconds of wall-clock time for one Chromium run

mkdir -p "$out"
echo "${WATCH3D_RENDERER:-gpu}" >"$out/renderer"   # read by watch3d-compare.py, which compares only like with like
profile=$(mktemp -d)
trap 'rm -rf "$profile" "$profile.dom"' EXIT

run() {   # run <view> <url> <extra flags...>: headless Chromium on a fresh profile, stopped after $limit seconds
  local v=$1 url=$2 code=0; shift 2
  rm -rf "$profile"/*
  timeout -k 5 "$limit" "$chrome" --headless=new --no-sandbox "${render[@]}" --hide-scrollbars --no-first-run \
    --no-default-browser-check --user-data-dir="$profile" --window-size=1440,900 --virtual-time-budget=20000 \
    "$@" "$url" 2>/dev/null || code=$?
  if [ "$code" = 124 ] || [ "$code" = 137 ]; then
    rm -f "$out/$v.png"
    echo "$v: Chromium did not finish within $limit seconds and was stopped" >&2
    exit 1
  fi
}

# Reads the page's DOM on stdin; prints the watch canvas's label and exits 0 only if the 3D watch is showing.
check='
import sys
from html.parser import HTMLParser
class P(HTMLParser):
    stage = canvas = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id") == "dialStage": self.stage = a
        if tag == "canvas" and "watch3d" in (a.get("class") or "").split(): self.canvas = a
p = P(); p.feed(sys.stdin.read())
cls = (p.stage or {}).get("class", "").split() if p.stage else []
if not p.stage: sys.exit("no #dialStage in the page")
if "full" not in cls or "loading" in cls: sys.exit("the stage is not showing the 3D watch (class: %s)" % " ".join(cls))
if not p.canvas: sys.exit("no 3D watch canvas in the page")
if "hidden" in p.canvas: sys.exit("the 3D watch canvas is hidden")
print(p.canvas.get("aria-label") or "(no label)")
'

for v in hero front side back clasp bracelet; do
  url="${base}?dial=${slug}&full=1&time=10:08:30"
  [ "$v" != hero ] && url="${base}?dial=${slug}&full=1&view=${v}&time=10:08:30"
  rm -f "$out/$v.png"   # a picture left from an earlier run must not pass for this one
  run "$v" "$url" --screenshot="$out/$v.png" >/dev/null
  [ -s "$out/$v.png" ] || { echo "$v: no picture was written" >&2; exit 1; }
  run "$v" "$url" --dump-dom >"$profile.dom"
  if ! label=$(python3 -c "$check" <"$profile.dom" 2>&1); then
    rm -f "$out/$v.png"
    echo "$v: the 3D watch was not on screen: $label" >&2
    exit 1
  fi
  echo "$v: $out/$v.png ($label)"
done
