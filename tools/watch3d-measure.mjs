#!/usr/bin/env node
// Measures pictures, so that a figure quoted from a shot can be worked out again without an image editor:
// the mean brightness of a box, how much two pictures of the same size differ, or how wide a part is along one
// row or column. No browser, no packages.
//
//   node tools/watch3d-measure.mjs mean <picture.png> [x0,y0,x1,y1]...   (no box: the whole picture)
//   node tools/watch3d-measure.mjs diff <a.png> <b.png>
//   node tools/watch3d-measure.mjs span <picture.png> row=Y|col=X... [levels=24]
//
// A box is left,top,right,bottom in picture pixels (a shot at SCALE=2 has twice the pixels of the window).
// mean prints the grey level from 0 to 255 (Pillow's "L" weights) and the share of pixels at 250 or above and
// below 8. diff prints the share of pixels that differ at all, by more than 8 grey levels and by more than 24.
// span prints the first and last pixel along a row or column that differ from the pixel the line starts on (the
// page behind the watch) by more than "levels" in any channel, and the count from one to the other: the width of
// whatever the line crosses. Compare figures only between shots from the same renderer, browser and window size.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const lib = await import(new URL('watch3d-browser.mjs', import.meta.url).href);
const open = (file) => lib.readPng(readFileSync(path.resolve(file)));

await lib.run(() => {
  const [what, ...rest] = process.argv.slice(2);
  if (what === 'mean' && rest.length >= 1) {
    const img = open(rest[0]);
    console.log(`${rest[0]}: ${img.width} by ${img.height}`);
    const boxes = rest.length > 1 ? rest.slice(1).map(lib.parseBox) : [[0, 0, img.width, img.height]];
    for (const box of boxes) {
      const s = lib.boxStats(img, box);
      console.log(`  box ${box.join(',')}: mean ${s.mean.toFixed(1)}, at 250 or above ${s.white.toFixed(2)}%, below 8 ${s.black.toFixed(2)}%`);
    }
    return 0;
  }
  if (what === 'diff' && rest.length === 2) {
    const d = lib.diffStats(open(rest[0]), open(rest[1]));
    console.log(`pixels that differ at all: ${d.any.toFixed(2)}%, by more than 8 grey levels: ${d.over8.toFixed(2)}%, by more than 24: ${d.over24.toFixed(2)}%; largest difference in one channel: ${d.largest}`);
    return 0;
  }
  if (what === 'span' && rest.length >= 2) {
    const img = open(rest[0]);
    console.log(`${rest[0]}: ${img.width} by ${img.height}`);
    const lines = rest.slice(1).map((arg) => /^(row|col|levels)=(\d+)$/.exec(arg) || usage(`"${arg}" is not row=Y, col=X or levels=N`));
    const levels = Number((lines.find((m) => m[1] === 'levels') || [0, 0, 24])[2]);
    for (const [, kind, text] of lines.filter((m) => m[1] !== 'levels')) {
      const at = Number(text), along = kind === 'row' ? img.width : img.height;
      if (at >= (kind === 'row' ? img.height : img.width)) usage(`${kind}=${at} lies outside the ${img.width} by ${img.height} picture`);
      const pixel = (k) => { const i = (kind === 'row' ? at * img.width + k : k * img.width + at) * img.channels; return [img.px[i], img.px[i + 1], img.px[i + 2]]; };
      const page = pixel(0);
      const differs = (k) => pixel(k).some((v, c) => Math.abs(v - page[c]) > levels);
      let first = 0, last = along - 1;
      while (first < along && !differs(first)) first++;
      while (last > first && !differs(last)) last--;
      console.log(first === along
        ? `  ${kind} ${at}: nothing differs from its first pixel (${page.join(',')}) by more than ${levels}`
        : `  ${kind} ${at}: from ${first} to ${last}, ${last - first + 1} pixels (against ${page.join(',')}, by more than ${levels})`);
    }
    return 0;
  }
  usage();
});

function usage(why) {
  throw new lib.UsageError(`${why ? `${why}\n` : ''}usage: node tools/watch3d-measure.mjs mean <picture.png> [x0,y0,x1,y1]...\n       node tools/watch3d-measure.mjs diff <a.png> <b.png>\n       node tools/watch3d-measure.mjs span <picture.png> row=Y|col=X... [levels=24]`);
}
