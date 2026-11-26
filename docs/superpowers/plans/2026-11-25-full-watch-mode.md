# Full Watch Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Full watch" button under the masthead dial swaps the flat dial for the Fable agent's 3D Navitimer-style watch, which the reader can turn.

**Architecture:** The model's modules are copied from branch `sporaktu/fable-navitimer` into `site/watch3d/` with relative imports and a `mount(container, options)` entry in place of its full-window page. A small deferred classic script, `site/watch3d.js`, owns the button and loads the model with a dynamic `import()` on the first press. `site/dials.js` gains one public hook so the button can switch the masthead to the Slide-rule chronograph dial.

**Tech Stack:** Plain ES modules, three.js r187 (vendored, minified), no build step, no test framework. Checks are shell commands and browser checks through the Orca browser.

**Spec:** `docs/superpowers/specs/2026-11-25-full-watch-mode-design.md`

## Global Constraints

- Work in the worktree `/home/gray/orca/workspaces/watch-buying-guide/full-watch`, branch `sporaktu/full-watch`. One commit per task. No push, no pull request.
- The page's content security policy in `site/index.html` line 9 stays byte-for-byte unchanged: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'none'`. No inline script, no import map, no `eval`, no `fetch`, no `data:` or `blob:` images.
- Nothing under `site/watch3d/` is requested before the first press of the button.
- No build step and no new tooling in the repo. three.js is the only library.
- The model goes up as the Fable agent left it. Do not improve its geometry, materials or lighting beyond what the page ground and the square stage require. Report faults seen by eye; do not fix them.
- Source of the model: `git show sporaktu/fable-navitimer:lab/fable-navitimer/<path>` at that branch's head when Task 1 starts. Record the commit hash in the README section (Task 4).
- Do not edit `lab/` or the `sporaktu/fable-navitimer` branch.
- Serve this worktree for checks with `python3 -m http.server 8772 --bind 127.0.0.1` from the worktree root; the page is `http://127.0.0.1:8772/site/`. Ports 8765, 8771, 8780 and 8791 are taken. Stop the server and close your browser tabs when done.
- Orca's browser is driven with `/home/gray/.config/orca/linux-orca-cli-shim/orca` (always the full path), run from the worktree. Print the commands with `... orca skills get orca-cli --reference browser`. Re-run `viewport` after every reload when emulating a phone.
- Wording on the page is plain English, sentence case, in the style of the existing controls.
- **Lettering (owner's decision, recorded before Task 1 starts):** KEEP or REMOVE the brand words the model prints: `BREITLING`, `1884`, `NAVITIMER` on the dial (`src/dial.js` about lines 116-118) and `BREITLING`, `NAVITIMER`, `B01 CHRONOGRAPH 41`, `CALIBRE B01` on the case back (`src/back.js` lines 36, 163, 235). The site's 43 flat dials print no words at all. Generic words (`SWISS MADE`, `STAINLESS STEEL`, scale labels) stay either way.

## Review Focus

1. **Pressed twice quickly while the model is loading:** exactly one model and one canvas exist, and the mode ends in the state of the last press.
2. **Leaving while it is still loading** (another dial chosen, Randomize, or the button again): the flat dial stays and no 3D canvas appears afterwards.
3. **The stage changes size while the watch is showing** (window resized across the 1200 px and narrow breakpoints, phone rotated): the canvas refits the square and the watch is not stretched.
4. **The watch is scrolled off screen or the tab is hidden:** the frame loop stops; on return the hands show the current time at once.
5. **WebGL is unavailable or its context is lost:** the flat dial is back, the button is off, and the caption says why.

Each line has its check in Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `site/watch3d/mount.js` (new) | Renderer, camera, lights, views, pointer handling, frame loop, for one container element. Replaces the lab's `src/main.js` and `index.html`. |
| `site/watch3d/{watch,dims,loop,geo,type,materials,env,case,dial,hands,back,bracelet}.js` (new) | The model, copied, with imports made relative. |
| `site/watch3d/vendor/` (new) | `three.module.min.js`, `three.core.min.js`, `OrbitControls.js`, `BufferGeometryUtils.js`, `LICENSE-three.txt`. |
| `site/watch3d.js` (new) | The button: mode on and off, loading, failure, the view chooser, when the loop runs. |
| `site/dials.js` (modify, near line 640) | Public hook `window.WBMDials`. |
| `site/index.html` (modify, lines 40-49 and the script list) | The button, the view chooser, the script tag. |
| `site/style.css` (modify, near line 115) | The stage in full mode, the loading label. |
| `site/releases.js`, `README.md` (modify) | The record. |

Not copied: `src/bench.js`, the lab `index.html`, `fonts/` (the page already loads Jost from `site/fonts/`).

---

### Task 1: The model as a mountable module

**Files:**
- Create: `site/watch3d/mount.js`, the twelve model modules, `site/watch3d/vendor/*`

**Interfaces:**
- Produces, from `site/watch3d/mount.js`:

```js
/**
 * @param {HTMLElement} container  the watch fills this element and follows its size
 * @param {{ shadowSize?: 4096|2048, reducedMotion?: boolean, onLost?: () => void, time?: string }} [options]
 *        time: 'HH:MM:SS' freezes the hands, for comparable screenshots
 * @returns {Promise<Handle>} resolves when the first frame has been drawn; rejects if WebGL is missing or the build throws
 */
export async function mount(container, options) {}

// Handle:
// canvas: HTMLCanvasElement          appended to container by mount
// views: string[]                    ['hero', 'front', 'side', 'back', 'clasp', 'bracelet']
// setView(name: string, instant?: boolean): boolean
// start(): void                      begin the frame loop (idempotent)
// stop(): void                       cancel it (idempotent)
// running: boolean
// chrono: { toggle(): void, reset(): void }
// dispose(): void                    stop, free GL resources, remove the canvas and every listener
```

- [ ] **Step 1: Copy the files.** The twelve modules from `lab/fable-navitimer/src/` (all but `main.js` and `bench.js`) into `site/watch3d/`; `OrbitControls.js`, `BufferGeometryUtils.js` and `LICENSE-three.txt` into `site/watch3d/vendor/` (flat, no `addons/` folders). For three.js itself, take `build/three.module.min.js` and `build/three.core.min.js` from the npm package `three@0.187.0` (`npm pack three@0.187.0` in a temp folder); confirm `REVISION` is `187` in the core file. If npm is unreachable, copy the unminified vendored pair instead and say so in the report.

- [ ] **Step 2: Make every import relative.** `'three'` becomes `./vendor/three.module.min.js` (or `./three.module.min.js` inside `vendor/`), `'three/addons/...'` becomes the flat vendor path, `'navitimer/x.js'` becomes `./x.js`. In `watch.js` replace the dynamic `` import(`navitimer/${file}`) `` with static imports of the four part modules and drop the `params`-driven part selection (`only`, `parts`).

- [ ] **Step 3: Write the static check and see it pass.**

Run from the worktree root:

```bash
rg -n "from ['\"](three|navitimer)|import\(" site/watch3d ; \
rg -n "location\.|URLSearchParams|__nav|__NAV_BASE|innerWidth|innerHeight|getElementById|querySelector|FontFace" site/watch3d -g '!vendor/**' ; \
for f in site/watch3d/*.js; do node --input-type=module --check < "$f" || echo "SYNTAX $f"; done
```

Expected: no output at all. (It fails until Step 4 is done, because `mount.js` does not exist and the copied modules still read `params`.)

- [ ] **Step 4: Write `mount.js`** from the lab's `src/main.js`, with these differences:
  - Size comes from `container` through a `ResizeObserver`, not the window. The canvas is `position:absolute; inset:0; width:100%; height:100%; touch-action:none`.
  - The renderer is created with `alpha: true`; there is no `scene.background`. The environment map and lights are unchanged.
  - The lab's `fit` rule (stand further back when the view is narrower than 0.86) is kept, so the whole watch fits a square.
  - Orbit controls: drag turns; pan is off; the mouse wheel does not zoom and is not swallowed, so the page scrolls with the pointer over the canvas; two-finger pinch zooms.
  - The font is waited for with `document.fonts.load('600 40px Jost')` only; the page's stylesheet already declares Jost.
  - Options replace the page-address parameters: `time`, `shadowSize` (key lamp shadow map, default 4096), `reducedMotion` (view changes cut instead of fly; no turntable).
  - `webglcontextlost` on the canvas calls `options.onLost`.
  - Nothing is written to `window`. Modules that took `params` take plain options or nothing.
  - The opening view is `hero`, set instantly.

- [ ] **Step 5: Run the Step 3 check.** Expected: no output.

- [ ] **Step 6: Check it in the browser.** Open `http://127.0.0.1:8772/site/` at 1440 x 900. With `orca eval`, run:

```js
(async () => { const d = document.createElement('div'); d.id = 'w3dCheck';
  d.style.cssText = 'position:fixed;left:20px;top:20px;width:400px;height:400px;z-index:99';
  document.body.append(d); const m = await import('./watch3d/mount.js');
  window.__h = await m.mount(d, { time: '10:08:36' }); __h.start();
  const c = __h.canvas.getBoundingClientRect(); return JSON.stringify({ w: c.width, h: c.height, views: __h.views, running: __h.running }); })()
```

Expected: `{"w":400,"h":400,"views":["hero","front","side","back","clasp","bracelet"],"running":true}`, no console message that mentions Content Security Policy, and a screenshot showing the whole watch, unclipped, on the page's light ground. Then check: each of the six views by screenshot; `__h.stop()` gives `running` false and `__h.start()` true; a wheel turn over the canvas changes `scrollY`; resizing the div to 300 x 300 keeps the canvas at 300 x 300 with an undistorted watch; `__h.dispose()` removes the canvas. Save the six screenshots' paths for the report.

- [ ] **Step 7: Commit.** `git add site/watch3d && git commit -m "Add the 3D watch as a mountable module under site/watch3d"`

### Task 2: A public hook to choose a dial by name

**Files:**
- Modify: `site/dials.js` (beside the existing private `choose`, near line 640)

**Interfaces:**
- Produces: `window.WBMDials = { choose(name: string): boolean, current(): string }`. `choose` shows the dial whose `n` equals `name`, records it for this visit exactly as the list does (not pinned), and returns `false` without changing anything if no dial has that name. `current()` returns the showing dial's `n`. The existing `wbm-dial` event on `document` still fires on every change.

- [ ] **Step 1: See it fail.** In the browser on `/site/?dial=5`: `orca eval` of `typeof window.WBMDials`. Expected: `"undefined"`.
- [ ] **Step 2: Add the hook.**
- [ ] **Step 3: See it pass.** On `/site/?dial=5`, evaluate `JSON.stringify([WBMDials.current() !== 'Slide-rule chronograph', WBMDials.choose('Slide-rule chronograph'), WBMDials.current(), document.getElementById('dialPick').selectedOptions[0].textContent, WBMDials.choose('No such dial'), WBMDials.current()])`. Expected: `[true,true,"Slide-rule chronograph","2. Slide-rule chronograph",false,"Slide-rule chronograph"]`. Run `node --check site/dials.js`.
- [ ] **Step 4: Commit.** `git commit -am "Let other scripts choose a masthead dial by name"`

### Task 3: The Full watch button

**Files:**
- Create: `site/watch3d.js`
- Modify: `site/index.html` (second control row, lines 40-49; script list, after `band.js`), `site/style.css` (near line 115)

**Interfaces:**
- Consumes: `mount` and `Handle` from Task 1; `window.WBMDials` and the `wbm-dial` event from Task 2.
- Produces: `#dialFull` (button, text `Full watch`, `aria-pressed`), `#dialView` (select, `aria-label` "View of the watch", hidden unless the mode is on; options Three-quarter `hero`, Front, Side, Case back `back`, Clasp, Bracelet), the class `full` on `#dialStage` while the watch is showing and `loading` while it is being built.

Behaviour, all from the spec:

- **On:** `WBMDials.choose('Slide-rule chronograph')`; add `loading` (the stage shows "Building the watch" over the flat dial); `import('./watch3d/mount.js')` then `mount(stage, { shadowSize: narrow ? 2048 : 4096, reducedMotion, onLost })`, where `narrow` is `matchMedia('(max-width: 720px)')` and `reducedMotion` is `matchMedia('(prefers-reduced-motion: reduce)')`; then swap `loading` for `full`. In `full`, `#dial` and `#band` are invisible but keep their box, `#dialBand` is hidden and `#dialView` shown in its place, `#dialWrist` is disabled, and `#dialName` reads "after the Breitling Navitimer. Drag to turn. Press the pushers to run the stopwatch."
- **Off:** by the button, or by a `wbm-dial` event after which `WBMDials.current()` is not `Slide-rule chronograph`. `handle.stop()`, remove `full`, restore `#dialBand`, and let `site/band.js` redraw its own state (it redraws on `wbm-dial`). The handle is kept; the next press only calls `start()`.
- **Loop:** `start()` only while the mode is on, the stage is on screen (`IntersectionObserver`) and the document is visible.
- **Failure** (import rejects, `mount` rejects, or `onLost`): mode off as above, `aria-pressed="false"`, `#dialName` reads "The 3D watch could not be shown on this device." until the dial next changes, and the error goes to `console.warn`. A lost context disposes the handle so a later press builds afresh.
- If `WBMDials` is missing, the button stays hidden (`hidden` is its state in the HTML; the script reveals it).

- [ ] **Step 1: See the checks fail.** On a fresh load of `/site/?dial=5`: `document.getElementById('dialFull')` is `null`.
- [ ] **Step 2: Add the markup, styles and `site/watch3d.js`.**
- [ ] **Step 3: Check the load cost.** Fresh load of `/site/?dial=5`, then evaluate `performance.getEntriesByType('resource').filter(e => e.name.includes('/watch3d/')).length`. Expected: `0`. Press the button, wait for `full`, evaluate again. Expected: 18 or fewer, all under `/site/watch3d/`. Evaluate the masthead's offset height before the press and in `full`. Expected: equal.
- [ ] **Step 4: Check the three ways out and back in.** From `full`: press the button (flat dial back, `#dialBand` showing, canvas hidden, `handle.running` false); press again (watch back in under 300 ms, no new `/watch3d/` requests); choose dial 5 from `#dialPick` (mode off, dial 5 showing); press again (list reads `2. Slide-rule chronograph`); press Randomize (mode off). With "Steel bracelet" and "On a wrist" set before entering, both are as they were after leaving.
- [ ] **Step 5: Check the Review Focus cases.**
  1. Click `#dialFull` twice within 50 ms on a fresh load: after 5 s exactly zero or one `canvas` is inside `#dialStage`, matching `aria-pressed`. Three clicks: same.
  2. Click `#dialFull`, then at once set `#dialPick` to dial 5 and dispatch `change`: after 5 s the stage has no `full` or `loading` class and the flat dial 5 is showing.
  3. In `full` at 1440 x 900, set the viewport to 1000 x 800, then 390 x 844: each time the canvas box equals the stage box and is square, and a screenshot shows a round, unstretched dial.
  4. In `full`, scroll to the bottom of the page: `running` is false. Scroll back: `running` is true.
  5. In `full`, evaluate `handle.canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` (expose the handle for the check through a temporary global, removed before the commit): the flat dial returns, `aria-pressed` is `false`, the caption reads the failure sentence. Press again: the watch is rebuilt.
- [ ] **Step 6: Check a phone.** Fresh load at 390 x 844 (`viewport ... --mobile`): press the button; screenshot shows the whole watch in the stage; a touch drag on the canvas turns it; a touch drag starting on the controls below scrolls the page; the pushers start and reset the stopwatch.
- [ ] **Step 7: Check the console and syntax.** No console errors or policy violations through Steps 3-6. `node --check site/watch3d.js`. `git diff origin/main -- site/index.html | rg Content-Security` prints nothing.
- [ ] **Step 8: Commit.** `git add site && git commit -m "Add a Full watch button that shows the 3D watch in the masthead"`

### Task 4: The record, and the pictures for the owner

**Files:**
- Modify: `site/releases.js` (new entry at the top), `README.md`

- [ ] **Step 1: Release note.** New top entry dated `2026-11-25`, id `29` (it becomes `30` if `fuzzy-nav` merges first; say which you used), title "See the whole watch in 3D", notes in the plain style of entries 27 and 28: what the button does, that it can be turned and its stopwatch run, and that it loads only when asked for.
- [ ] **Step 2: README.** A short section: what `site/watch3d/` and `site/watch3d.js` are, that the model was built by an agent as a trial and copied from `sporaktu/fable-navitimer` at commit `<hash>`, that three.js r187 (MIT) is vendored and loaded on demand, what was changed in the copy (relative imports, `mount`, transparent ground, lettering as decided), and the model's known simplifications in three lines from its `NOTES.md`.
- [ ] **Step 3: Pictures.** With the mode on at 1440 x 900 and at 390 x 844, a screenshot of the masthead in each of the six views. List the file paths in the report, and list every fault you can see (clipping, a view that hides the watch, steel that reads wrong on the light ground).
- [ ] **Step 4: Commit.** `git commit -am "Record full watch mode in the release notes and README"`
- [ ] **Step 5: Stop the server on 8772 and close your browser tabs.**

## After the tasks

An independent review of `origin/main..HEAD` before the owner is told it is ready. Merge order with `fuzzy-nav` is the owner's call; whichever goes second is rebased and its release note renumbered.
