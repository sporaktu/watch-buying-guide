#!/usr/bin/env python3
"""Compare two sets of 3D watch views shot by tools/watch3d-shots.sh.

    tools/watch3d-compare.py <dir-a> <dir-b> [--max-diff N] [--max-pixels N]

For each of the six views, prints the number of pixels that differ and the largest difference in any one channel
(0 to 255). Exits 0 only when every view is within the limits: no channel differs by more than --max-diff, and no
more than --max-pixels pixels differ at all. Both default to 0, an exact match. A missing picture or a change of
size fails.
"""
import argparse
import os
import sys

from PIL import Image, ImageChops

VIEWS = ['hero', 'front', 'side', 'back', 'clasp', 'bracelet']


def compare(a_path, b_path):
    a = Image.open(a_path).convert('RGBA')
    b = Image.open(b_path).convert('RGBA')
    if a.size != b.size:
        return None, None, f'sizes differ: {a.size} and {b.size}'
    diff = ImageChops.difference(a, b)
    largest = max(hi for _, hi in diff.getextrema())
    # A pixel differs if any channel does: the largest channel difference per pixel, then count the non-zero ones.
    bands = diff.split()
    per_pixel = bands[0]
    for band in bands[1:]:
        per_pixel = ImageChops.lighter(per_pixel, band)
    hist = per_pixel.histogram()
    differing = sum(hist[1:])
    return differing, largest, None


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('a')
    p.add_argument('b')
    p.add_argument('--max-diff', type=int, default=0, help='largest channel difference allowed (default 0)')
    p.add_argument('--max-pixels', type=int, default=0, help='number of differing pixels allowed (default 0)')
    args = p.parse_args()

    ok = True
    for v in VIEWS:
        pa, pb = os.path.join(args.a, v + '.png'), os.path.join(args.b, v + '.png')
        if not os.path.isfile(pa) or not os.path.isfile(pb):
            print(f'{v:9} missing: {pa if not os.path.isfile(pa) else pb}')
            ok = False
            continue
        differing, largest, err = compare(pa, pb)
        if err:
            print(f'{v:9} {err}')
            ok = False
            continue
        within = largest <= args.max_diff and differing <= args.max_pixels
        ok = ok and within
        print(f'{v:9} {differing:7d} pixels differ, largest difference {largest:3d}  {"ok" if within else "OVER"}')
    print('within the limits' if ok else 'NOT within the limits '
          f'(max diff {args.max_diff}, max pixels {args.max_pixels})')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
