#!/usr/bin/env bash
# Shoot the six views of a 3D watch at a frozen time, for comparing before and after a change, and report for each
# what a browser's console would have shown.
#
#   tools/watch3d-shots.sh [--allow-warnings] <base-url> <dial-slug> <out-dir>
#   e.g. tools/watch3d-shots.sh http://127.0.0.1:8773/site/ slide-rule-chronograph /tmp/watch3d-now/navitimer
#
# Writes hero.png front.png side.png back.png clasp.png bracelet.png into <out-dir>: the window at 1440 by 900, with
# the watch showing in the masthead (?full=1) and its hands at 10:08:30. Each shot gets a fresh profile, so nothing a
# visit stores changes the next one.
#
# Beside each picture, <view>.json holds what tools/watch3d-shot.mjs recorded for it (it drives Chromium over the
# DevTools protocol, from plain node with no packages): the WebGL renderer string, the watch's report (the stage's
# data-watch3d-report: triangles, draw calls, warnings and the watch's own entries), console errors and warnings, page
# errors and failed requests. The same is printed after each view. The script carries on to the next view and exits
# with status 1 at the end when any view had a console error, a page error, a failed request under <base-url>, or a
# warning in the watch's report; --allow-warnings lets report warnings through (they are still printed).
#
# Renderer: headless Chromium draws on the graphics card (--enable-gpu) unless WATCH3D_RENDERER=software is set, which
# uses SwiftShader, Chromium's software renderer, instead. Use it when the graphics card cannot give WebGL (the check
# below then fails every view). The two renderers draw differently, so compare only sets shot with the same one. The
# script prints which it used and writes it to <out-dir>/renderer, which watch3d-compare.py checks; the renderer
# string in each <view>.json says what really drew it.
#
# A picture is taken only once the 3D watch is on screen (the stage has the class full and is not loading, the
# watch's canvas is there and not hidden), then three frames and 250 ms later.
# Without that check a missing WebGL or a slow build would give a picture of the flat dial or of "Building the watch",
# and two such sets compare as identical. A picture left from an earlier run is deleted first. Each Chromium run has 90
# seconds of wall-clock time. The script stops at once with an error when a run takes longer or the watch was not on
# screen. A face with no 3D watch of its own opens the default watch, as the page does; the label printed after each
# view names the watch that was shot.
# Compare two sets with tools/watch3d-compare.py.
set -euo pipefail

usage() { echo "usage: $0 [--allow-warnings] <base-url> <dial-slug> <out-dir>" >&2; exit 2; }
allow=0
while [ $# -gt 0 ]; do
  case "$1" in
    --allow-warnings) allow=1; shift ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
done
[ $# -eq 3 ] || usage
base=$1 slug=$2 out=$3
here=$(cd "$(dirname "$0")" && pwd)

chrome=""
for c in chromium chromium-browser google-chrome google-chrome-stable chrome; do
  if command -v "$c" >/dev/null 2>&1; then chrome=$(command -v "$c"); break; fi
done
if [ -z "$chrome" ]; then echo "no Chromium or Chrome found on PATH" >&2; exit 1; fi
command -v node >/dev/null 2>&1 || { echo "node is needed to drive Chromium (tools/watch3d-shot.mjs)" >&2; exit 1; }

case "${WATCH3D_RENDERER:-gpu}" in
  gpu) render=(--enable-gpu); echo "renderer: graphics card (--enable-gpu)" ;;
  software) render=(--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader)
    echo "renderer: software (SwiftShader)" ;;
  *) echo "WATCH3D_RENDERER must be gpu or software, not ${WATCH3D_RENDERER}" >&2; exit 2 ;;
esac
limit=90   # seconds of wall-clock time for one Chromium run

mkdir -p "$out"
echo "${WATCH3D_RENDERER:-gpu}" >"$out/renderer"   # read by watch3d-compare.py, which compares only like with like

bad=0
shoot() {   # shoot <name> <url>
  local v=$1 url=$2 code=0
  rm -f "$out/$v.png" "$out/$v.json"   # a picture left from an earlier run must not pass for this one
  timeout -k 5 $((limit + 10)) node "$here/watch3d-shot.mjs" "$out/$v.png" "$out/$v.json" "$base" "$limit" "$url" \
    "$chrome" "${render[@]}" --window-size=1440,900 >"$out/$v.txt" || code=$?
  local label
  label=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("label") or d.get("problem") or "")' "$out/$v.json" 2>/dev/null || true)
  case "$code" in
    0|3|4) echo "$v: $out/$v.png ($label)"; cat "$out/$v.txt" ;;
    *) rm -f "$out/$v.png"; cat "$out/$v.txt"
       if [ "$code" = 124 ] || [ "$code" = 137 ]; then echo "$v: Chromium did not finish within $limit seconds and was stopped" >&2
       else echo "$v: the 3D watch was not on screen: $label" >&2; fi
       rm -f "$out/$v.txt"; exit 1 ;;
  esac
  rm -f "$out/$v.txt"
  [ -s "$out/$v.png" ] || { echo "$v: no picture was written" >&2; exit 1; }
  if [ "$code" = 3 ]; then echo "$v: console error, page error or failed request (see above)" >&2; bad=1; fi
  if [ "$code" = 4 ] && [ "$allow" = 0 ]; then echo "$v: the watch's report has warnings (--allow-warnings lets them through)" >&2; bad=1; fi
  return 0
}

for v in hero front side back clasp bracelet; do
  url="${base}?dial=${slug}&full=1&time=10:08:30"
  [ "$v" != hero ] && url="${base}?dial=${slug}&full=1&view=${v}&time=10:08:30"
  shoot "$v" "$url"
done
exit "$bad"
