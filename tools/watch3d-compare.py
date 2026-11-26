#!/usr/bin/env python3
"""Compare two sets of 3D watch views shot by tools/watch3d-shots.sh.

    tools/watch3d-compare.py <dir-a> <dir-b> [--max-diff N] [--max-pixels N]

For each of the six views, prints the number of pixels that differ at all, the number that differ by more than 8
levels, and the largest difference in any one channel (0 to 255). Exits 0 only when every view is within its limits:
no channel differs by more than the view's largest difference, and no more than the view's number of pixels differ at
all. A missing picture, a change of size, or two sets shot with different renderers fails.

Two shots of the same code are not quite identical, so each view has limits of its own, measured on the Navitimer
(see LIMITS) for the renderer the sets were shot with (the file `renderer` that watch3d-shots.sh writes; a set
without one was shot on the graphics card). --max-diff and --max-pixels replace the limit of that name for every
view. The count of pixels that differ by more than 8 levels is printed, not checked: smoothing of text and edges
stays under it, so a change there is usually a real one.
"""
import argparse
import os
import sys

from PIL import Image, ImageChops

VIEWS = ['hero', 'front', 'side', 'back', 'clasp', 'bracelet']

# Per view: (largest channel difference, number of differing pixels) allowed between two sets of the same code.
# Measured on the Navitimer at 1440 by 900. The graphics card: twelve sets shot on 2026-11-25 (66 pairs); the worst
# seen was hero 2 / 33, front 2 / 76, side 9 / 50, back 155 / 1433, clasp 128 / 144, bracelet 2 / 18. Software
# (SwiftShader): fifteen sets shot on 2026-11-26 (105 pairs); the worst seen was hero 1 / 23, front 1 / 24,
# side 61 / 85, back 213 / 3283, clasp 179 / 616, bracelet 1 / 24. The noise is round the case back's window, in the
# back, clasp and (in software) side views. Why it differs between runs is not fully known: a review saw it with the
# frame loop never started, so it is not only the balance and rotor moving. In software the clasp view's noise
# depended on what else the machine was doing: eight sets shot while it was busy differed from each other by at most
# 32 pixels, and by about 550 to 650 from sets shot while it was quiet. The graphics card's sets were all shot in one
# sitting, so its back and clasp limits may be too tight; if only those views go over, shoot again before blaming
# the change.
LIMITS = {
    'gpu': {
        'hero': (10, 120), 'front': (10, 120), 'side': (16, 120),
        'back': (180, 1800), 'clasp': (150, 220), 'bracelet': (10, 120),
    },
    'software': {
        'hero': (10, 120), 'front': (10, 120), 'side': (100, 180),
        'back': (255, 4500), 'clasp': (220, 900), 'bracelet': (10, 120),
    },
}
STRONG = 8   # a pixel 'differs strongly' when some channel differs by more than this


def renderer(d):
    try:
        with open(os.path.join(d, 'renderer')) as f:
            return f.read().strip()
    except FileNotFoundError:
        return 'gpu'


def compare(a_path, b_path):
    a = Image.open(a_path).convert('RGBA')
    b = Image.open(b_path).convert('RGBA')
    if a.size != b.size:
        return None, None, None, f'sizes differ: {a.size} and {b.size}'
    diff = ImageChops.difference(a, b)
    # A pixel differs if any channel does: the largest channel difference per pixel, then count.
    bands = diff.split()
    per_pixel = bands[0]
    for band in bands[1:]:
        per_pixel = ImageChops.lighter(per_pixel, band)
    hist = per_pixel.histogram()
    largest = max((i for i, n in enumerate(hist) if n), default=0)
    return sum(hist[1:]), sum(hist[STRONG + 1:]), largest, None


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('a')
    p.add_argument('b')
    p.add_argument('--max-diff', type=int, help='largest channel difference allowed, for every view')
    p.add_argument('--max-pixels', type=int, help='number of differing pixels allowed, for every view')
    args = p.parse_args()

    ra, rb = renderer(args.a), renderer(args.b)
    if ra != rb:
        print(f'the sets were shot with different renderers ({ra} and {rb}); shoot both with the same one')
        return 1
    if ra not in LIMITS:
        print(f'unknown renderer {ra!r} in {args.a}/renderer')
        return 1
    print(f'renderer: {ra}')

    ok = True
    for v in VIEWS:
        max_diff, max_pixels = LIMITS[ra][v]
        if args.max_diff is not None:
            max_diff = args.max_diff
        if args.max_pixels is not None:
            max_pixels = args.max_pixels
        pa, pb = os.path.join(args.a, v + '.png'), os.path.join(args.b, v + '.png')
        if not os.path.isfile(pa) or not os.path.isfile(pb):
            print(f'{v:9} missing: {pa if not os.path.isfile(pa) else pb}')
            ok = False
            continue
        differing, strong, largest, err = compare(pa, pb)
        if err:
            print(f'{v:9} {err}')
            ok = False
            continue
        within = largest <= max_diff and differing <= max_pixels
        ok = ok and within
        print(f'{v:9} {differing:7d} pixels differ, {strong:6d} by more than {STRONG}, largest difference {largest:3d}'
              f'   limits {max_diff:3d} / {max_pixels:5d}  {"ok" if within else "OVER"}')
    print('within the limits' if ok else 'NOT within the limits')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
