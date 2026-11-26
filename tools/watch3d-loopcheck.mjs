#!/usr/bin/env node
// Bracelet loop check in node, with no browser: runs a kit watch's own bracelet build and prints its numbers and
// failures (pin spacing, the seam at the clasp, joints that bend too far or backwards, a pin inside the case, an end
// link wider than the lugs). Exits 1 when any check fails, so a failure cannot pass unseen as a console warning.
//
//   node tools/watch3d-loopcheck.mjs <worktree> [watch-folder] [key=value...]
//   node tools/watch3d-loopcheck.mjs ../watch-kit navitimer
//   node tools/watch3d-loopcheck.mjs ../watch-kit navitimer segments=9     (a trial that must FAIL)
//
// What the watch must export from site/watch3d/watches/<watch-folder>/bracelet.js (FILE=name.js for another file):
//   buildBracelet({ M, report })  filling report.bracelet = { failures, pin0, seam, pins, links, length, ... }, as the
//                                 Navitimer's does. This is the only route that checks the first pin the page really
//                                 builds with. The module must load in node: imports by path, no canvas while building.
//   BRACELET                      the written figures. If buildBracelet is missing or cannot run in node, the loop is
//                                 solved from these alone with site/watch3d/kit/loop.js and the numbers are printed,
//                                 but the run ends FAIL with exit 1: that may not be the loop the page builds (a
//                                 written pin0 can be overridden), so it must not read as a pass.
// key=value changes one written figure of BRACELET for this run only, to prove the check can fail.
// WRITTEN_ONLY=1 accepts a check of the written figures alone, for a plan that has figures and no builder yet. The
// verdict then reads "PASS ON THE WRITTEN FIGURES ONLY". It never excuses a buildBracelet that exists and cannot run.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const lib = await import(new URL('watch3d-browser.mjs', import.meta.url).href);
const USAGE = 'usage: node tools/watch3d-loopcheck.mjs <worktree> [watch-folder] [key=value...]';
const round = (v, n = 3) => (Array.isArray(v) ? `[${v.map((x) => round(x, n)).join(', ')}]` : typeof v === 'number' ? String(Number(v.toFixed(n))) : String(v));
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];

await lib.run(async () => {
  const args = process.argv.slice(2);
  const trials = args.filter((a) => /^[A-Za-z]\w*=/.test(a));
  const [worktree, watch = 'navitimer'] = args.filter((a) => !trials.includes(a));
  if (!worktree) throw new lib.UsageError(USAGE);
  const root = path.resolve(worktree);
  const watches = path.join(root, 'site', 'watch3d', 'watches');
  const watchFile = path.join(watches, watch, process.env.FILE || 'bracelet.js');
  const loopFile = path.join(root, 'site', 'watch3d', 'kit', 'loop.js');
  if (!existsSync(loopFile)) throw new lib.UsageError(`${root} has no site/watch3d/kit/loop.js; give a worktree that holds the kit\n${USAGE}`);
  if (!existsSync(watchFile)) {
    throw new lib.UsageError(`no ${path.relative(root, watchFile)} in ${root}; watches there: ${existsSync(watches) ? readdirSync(watches).join(', ') : 'none'}`);
  }
  let commit = 'not a git checkout';
  try {
    commit = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'site/watch3d'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (dirty) commit += ' with uncommitted changes under site/watch3d';
  } catch { /* leave the words above */ }
  console.log(`watch: ${watch} in ${root} (${commit})`);

  let mod;
  try { mod = await import(pathToFileURL(watchFile).href); }
  catch (e) {
    console.log(`The watch's ${path.basename(watchFile)} cannot be loaded in node: ${firstLine(e)}`);
    return lib.finish(['the check could not be run, so the loop is unchecked']);
  }
  const B = mod.BRACELET;
  const written = B && Array.isArray(B.pin0) ? [...B.pin0] : null;
  for (const t of trials) {
    const [key, value] = [t.slice(0, t.indexOf('=')), t.slice(t.indexOf('=') + 1)];
    if (!B || !(key in B)) throw new lib.UsageError(`BRACELET has no "${key}"; it has: ${B ? Object.keys(B).join(', ') : 'nothing (BRACELET is not exported)'}`);
    const v = value.includes(',') ? value.split(',').map(Number) : Number(value);
    if ([v].flat().some((n) => !Number.isFinite(n))) throw new lib.UsageError(`"${t}": the value must be a number or a list of numbers`);
    console.log(`TRIAL: BRACELET.${key} set to ${round(v)} (written: ${round(B[key])}); this run does not describe the watch as written`);
    B[key] = v;
  }

  const reasons = [];
  let result = null;
  let writtenOnly = null;   // why only the written figures could be checked: 'missing' or 'unusable' builder
  if (typeof mod.buildBracelet === 'function') {
    const report = {}, warned = [], keep = console.warn;
    console.warn = (...a) => warned.push(a.join(' '));
    let threw = null;
    try { mod.buildBracelet({ M: new Proxy({}, { get: () => undefined }), report }); } catch (e) { threw = e; } finally { console.warn = keep; }
    if (report.bracelet && Array.isArray(report.bracelet.failures)) {
      result = report.bracelet;
      console.log("how: the watch's own buildBracelet, run in node; the first pin is the one the page builds with");
      if (threw) reasons.push(`buildBracelet threw after the checks: ${firstLine(threw)}`);
    } else {
      console.log(`buildBracelet could not be used in node: ${threw ? firstLine(threw) : 'it ran but left no report.bracelet.failures'}`);
      writtenOnly = 'unusable';
    }
  } else { console.log(`${path.basename(watchFile)} exports no buildBracelet`); writtenOnly = 'missing'; }

  if (!result) {
    if (!B) return lib.finish(['neither a usable buildBracelet nor BRACELET is exported, so the loop is unchecked']);
    const loop = await import(pathToFileURL(loopFile).href);
    console.log('how: solved from the written BRACELET figures only (kit/loop.js). NOT CHECKED: whether the page starts from');
    console.log('     this first pin, whether a pin sits inside the case, and whether the end link fits between the lugs.');
    try {
      const L = loop.solveLoop(B), o = { ...B };
      result = {
        failures: loop.checkLoop(L), pin0: L.pins[0], seam: L.seam, pins: L.pins.length * 2,
        maxTurnDeg: Math.max(...L.turns.map(Math.abs)) / loop.DEG, widthAtLug: loop.widthAt(0, o),
      };
    } catch (e) { return lib.finish([`the loop could not be solved: ${firstLine(e)}`]); }
  }

  const line = (label, value) => { if (value !== undefined) console.log(`  ${label.padEnd(22)}${value}`); };
  line('first pin (y, z)', round(result.pin0));
  if (written && result.pin0 && Math.hypot(written[0] - result.pin0[0], written[1] - result.pin0[1]) > 0.01 && !trials.some((t) => t.startsWith('pin0='))) {
    line('', `the written BRACELET.pin0 is ${round(written)}; the build does not start there, so a check from the written figure alone would be of another loop`);
    // How different that other loop is: both solved here with the kit's solver, so the two can be compared.
    try {
      const loop = await import(pathToFileURL(loopFile).href);
      const fromWritten = loop.solveLoop(B), fromBuilt = loop.solveLoop(B, { pin0: result.pin0 });
      line('', `from the written pin the loop would have bump ${fromWritten.bump.toFixed(4)}, seam ${round(fromWritten.seam, 4)} and ${loop.checkLoop(fromWritten).length} failures;`);
      line('', `from the built pin it has bump ${fromBuilt.bump.toFixed(4)} and the seam on the next line`);
    } catch (e) { line('', `the two could not be solved side by side: ${firstLine(e)}`); }
  }
  line('seam at the clasp', round(result.seam, 4));
  line('pins, links', result.links !== undefined ? `${result.pins}, ${result.links}` : result.pins);
  line('length round, mm', result.length !== undefined ? round(result.length, 1) : undefined);
  line('largest joint turn', result.maxTurnDeg !== undefined ? `${round(result.maxTurnDeg, 1)} degrees` : undefined);
  line('width at lug, clasp', result.widthAtClasp !== undefined ? `${round(result.widthAtLug, 2)}, ${round(result.widthAtClasp, 2)} mm` : result.widthAtLug !== undefined ? `${round(result.widthAtLug, 2)} mm at the lug` : undefined);
  line('failures', result.failures.length ? `${result.failures.length}, listed below` : 'none');
  reasons.push(...result.failures);
  // A check of the written figures is not a check of the loop the page builds, so it never ends in a plain PASS.
  if (writtenOnly === 'unusable') {
    reasons.push('buildBracelet is exported but could not run in node, so the loop the page builds was not checked; the figures above are from the written BRACELET only. Make the module run in node (imports by path, no canvas while building)');
  } else if (writtenOnly === 'missing' && process.env.WRITTEN_ONLY !== '1') {
    reasons.push('only the written BRACELET figures were checked, not the loop the page builds: export buildBracelet, or set WRITTEN_ONLY=1 for a plan that has no builder yet');
  }
  if (!reasons.length && writtenOnly) {
    console.log('PASS ON THE WRITTEN FIGURES ONLY (the loop the page builds was not checked)');
    return 0;
  }
  return lib.finish(reasons);
});
