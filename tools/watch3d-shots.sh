#!/usr/bin/env bash
# Shoot the six views of a 3D watch at a frozen time, for comparing before and after a change, and report for each
# what a browser's console would have shown.
#
#   tools/watch3d-shots.sh [--allow-warnings] [--scale N] <base-url> <dial-slug> <out-dir> [name=cam ...]
#   e.g. tools/watch3d-shots.sh http://127.0.0.1:8773/site/ slide-rule-chronograph /tmp/watch3d-now/navitimer
#        tools/watch3d-shots.sh --scale 2 http://127.0.0.1:8773/site/ slide-rule-chronograph /tmp/close \
#          crown=80,5,60,20,0,6 clasp-under=0,-60,120,0,-30,-20
#
# Writes hero.png front.png side.png back.png clasp.png bracelet.png into <out-dir>: the window at 1440 by 900, with
# the watch showing in the masthead (?full=1) and its hands at 10:08:30. Each shot gets a fresh profile, so nothing a
# visit stores changes the next one.
#
# Date and zone. The page's clock is frozen at 10:08:30 on 26 November 2026 (?time=10:08:30&date=2026-11-26), and
# Chromium runs with TZ=Asia/Tokyo, so the same picture comes out on any day and on any machine: without them a date
# window would show the day the set was shot, and a 24-hour hand (which shows UTC) the machine's own offset. Tokyo
# because it is not UTC, so a 24-hour hand stands apart from the hour hand (at 10:08:30 in Tokyo it is 01:08:30 UTC:
# the 24-hour hand near the top of the dial, the hour hand near 10), and because it has had no summer time since
# 1951, so the offset is +9 hours on every date. The date was the day this was set; any fixed date would do, and a
# set shot with an older script, which used the day's own date and the machine's zone, compares with these only when
# shot on that day in that zone. Each <view>.json records the zone and clock the page saw, and a run whose zone is
# not Asia/Tokyo fails.
#
# Close-ups: each extra argument name=cam shoots one more picture, <name>.png, from the camera the page's ?cam= places
# (az,el,dist or az,el,dist,x,y,z: degrees round from the front towards 3 o'clock, degrees up towards 12 o'clock,
# millimetres away, and the point looked at in millimetres; see parseCam in site/watch3d/kit/stage.js). A name is
# lower-case letters, digits and hyphens, and not one of the six views. A cam the page ignores fails the run.
# --scale N gives the page N device pixels to each CSS pixel (Chromium's --force-device-scale-factor), so the picture
# is N times as wide and tall: at 2 the masthead watch is about 865 pixels wide. The stage draws at most 2 device
# pixels a CSS pixel, so more than 2 adds nothing. Compare only sets shot at the same scale.
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

usage() { echo "usage: $0 [--allow-warnings] [--scale N] <base-url> <dial-slug> <out-dir> [name=cam ...]" >&2; exit 2; }
allow=0 scale=1
while [ $# -gt 0 ]; do
  case "$1" in
    --allow-warnings) allow=1; shift ;;
    --scale) [ $# -ge 2 ] && [[ "$2" =~ ^[0-9]+(\.[0-9]+)?$ ]] || usage; scale=$2; shift 2 ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
done
[ $# -ge 3 ] || usage
base=$1 slug=$2 out=$3
shift 3
extra=("$@")
for e in "${extra[@]}"; do
  name=${e%%=*}
  if [ "$name" = "$e" ] || ! [[ "$name" =~ ^[a-z0-9-]+$ ]]; then echo "not name=cam: $e" >&2; usage; fi
  case " hero front side back clasp bracelet " in *" $name "*) echo "$name is one of the six views" >&2; exit 2 ;; esac
done
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
zone=Asia/Tokyo day=2026-11-26   # see "Date and zone" above

mkdir -p "$out"
echo "${WATCH3D_RENDERER:-gpu}" >"$out/renderer"   # read by watch3d-compare.py, which compares only like with like

bad=0
shoot() {   # shoot <name> <url>
  local v=$1 url=$2 code=0
  rm -f "$out/$v.png" "$out/$v.json"   # a picture left from an earlier run must not pass for this one
  TZ=$zone timeout -k 5 $((limit + 10)) node "$here/watch3d-shot.mjs" "$out/$v.png" "$out/$v.json" "$base" "$limit" "$url" \
    "$chrome" "${render[@]}" --window-size=1440,900 --force-device-scale-factor="$scale" >"$out/$v.txt" || code=$?
  local label
  label=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("label") or d.get("problem") or "")' "$out/$v.json" 2>/dev/null || true)
  if [ "$code" = 0 ] || [ "$code" = 3 ] || [ "$code" = 4 ]; then
    local seen
    seen=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("timeZone"))' "$out/$v.json" 2>/dev/null || true)
    if [ "$seen" != "$zone" ]; then rm -f "$out/$v.png" "$out/$v.txt"; echo "$v: the page ran in time zone $seen, not $zone" >&2; exit 1; fi
  fi
  case "$code" in
    0|3|4) echo "$v: $out/$v.png ($label)"; cat "$out/$v.txt" ;;
    *) rm -f "$out/$v.png"; cat "$out/$v.txt"
       if [ "$code" = 124 ] || [ "$code" = 137 ]; then echo "$v: Chromium did not finish within $limit seconds and was stopped" >&2
       else echo "$v: no picture: $label" >&2; fi
       rm -f "$out/$v.txt"; exit 1 ;;
  esac
  rm -f "$out/$v.txt"
  [ -s "$out/$v.png" ] || { echo "$v: no picture was written" >&2; exit 1; }
  if [ "$code" = 3 ]; then echo "$v: console error, page error or failed request (see above)" >&2; bad=1; fi
  if [ "$code" = 4 ] && [ "$allow" = 0 ]; then echo "$v: the watch's report has warnings (--allow-warnings lets them through)" >&2; bad=1; fi
  return 0
}

for v in hero front side back clasp bracelet; do
  url="${base}?dial=${slug}&full=1&time=10:08:30&date=${day}"
  [ "$v" != hero ] && url="${base}?dial=${slug}&full=1&view=${v}&time=10:08:30&date=${day}"
  shoot "$v" "$url"
done
for e in "${extra[@]}"; do
  shoot "${e%%=*}" "${base}?dial=${slug}&full=1&cam=${e#*=}&time=10:08:30&date=${day}"
done
exit "$bad"
