#!/usr/bin/env bash
# Shoot the six views of a 3D watch at a frozen time, for comparing before and after a change.
#
#   tools/watch3d-shots.sh <base-url> <dial-slug> <out-dir>
#   e.g. tools/watch3d-shots.sh http://127.0.0.1:8773/site/ slide-rule-chronograph /tmp/watch3d-now/navitimer
#
# Writes hero.png front.png side.png back.png clasp.png bracelet.png into <out-dir>: the whole page at a 1440 by 900
# window, with the watch showing in the masthead (?full=1) and its hands at 10:08:30. Headless Chromium draws on the
# graphics card (--enable-gpu); each shot gets a fresh profile, so nothing a visit stores changes the next one.
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

mkdir -p "$out"
profile=$(mktemp -d)
trap 'rm -rf "$profile"' EXIT

for v in hero front side back clasp bracelet; do
  url="${base}?dial=${slug}&full=1&time=10:08:30"
  [ "$v" != hero ] && url="${base}?dial=${slug}&full=1&view=${v}&time=10:08:30"
  rm -rf "$profile"/*
  "$chrome" --headless=new --no-sandbox --enable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --user-data-dir="$profile" --window-size=1440,900 --virtual-time-budget=20000 \
    --screenshot="$out/$v.png" "$url" >/dev/null 2>&1
  [ -s "$out/$v.png" ] || { echo "no picture for $v" >&2; exit 1; }
  echo "$v: $out/$v.png"
done
