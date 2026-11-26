# Watch Kit, Full Screen and the GMT-Master II Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 3D watch into a shared kit and per-watch folders with no visible change, add a full-screen mode for the 3D watch on every device size, then build a Rolex GMT-Master II ref. 126710BLRO on the kit.

**Architecture:** `site/watch3d/kit/` holds everything that is not about one watch (the stage, materials, studio, shape and lettering tools, the bracelet-loop solver); `site/watch3d/watches/<id>/` holds one watch each, loaded by the stage with a computed `import()`. `site/watch3d.js`, the deferred classic script that owns the masthead button, maps a face name to a watch id and owns full screen, which is a modal `<dialog>` the stage's canvas is moved into, with the browser's Fullscreen API asked for on top.

**Tech Stack:** Plain ES modules, three.js r187 (vendored), no build step, no test framework. Checks are shell commands, headless Chromium screenshots compared with Python and Pillow, and browser checks through the Orca browser.

**Spec:** `docs/superpowers/specs/2026-11-26-watch-kit-gmt-design.md`

## Global Constraints

- Three parts, three pull requests, in order. Part 1 on branch `sporaktu/watch-kit` in `/home/gray/orca/workspaces/watch-buying-guide/watch-kit`. Part 2 on `sporaktu/watch-screen`, cut from `origin/main` after Part 1 is merged, in the same worktree. Part 3 in its own Orca workspace, cut from `origin/main` after Part 2 is merged. Builders commit after each task and do not push or open pull requests.
- The content-security policy in `site/index.html` line 9 stays byte-for-byte unchanged. No inline script, no import map, no new host.
- Nothing under `site/watch3d/` is requested before the first press of Full watch or a `?full=1` arrival. Opening one watch fetches nothing from another watch's folder.
- No build step, no new dependency. three.js stays in `site/watch3d/vendor/`, untouched.
- One canvas and one WebGL context for the feature; one watch's geometry and textures on the graphics card at a time.
- The Navitimer's geometry, materials, lighting and lettering are not changed. Its six views must match their baseline screenshots (Task 1.1) after every task that touches `site/watch3d/`.
- Nothing in `site/watch3d/kit/` names a watch or holds a watch's dimensions, colours, wording or behaviour.
- No downloaded meshes, no photographs in the model or the repo. Fonts are self-hosted files with a free licence.
- Units are millimetres; the dial faces +Z, 12 o'clock is +Y, 3 o'clock is +X; z = 0 is the underside of the mid-case.
- Wording on the page is plain English, sentence case, in the style of the existing controls.
- Serve a worktree for checks with `setsid -f python3 /tmp/nostore-server.py <port> >/tmp/watch3d-<port>.log 2>&1 </dev/null` from its root (a `python3 -m http.server` that sends `Cache-Control: no-store`; if the file is gone, write one). Parts 1 and 2 use port 8773, Part 3 uses 8774. Ports 8765, 8780 and 8791 are taken. Stop the server and close your browser tabs when done. Do not use `pkill -f` with a pattern that matches your own shell.
- Orca's browser is driven with `/home/gray/.config/orca/linux-orca-cli-shim/orca` (always the full path), run from the worktree. Print the commands with `... orca skills get orca-cli --reference browser`. Snapshot element references go stale: click by evaluating script that finds the element. Re-run `viewport` after every reload when emulating a phone.

## Review Focus

1. **Showing a watch again after another:** the shared materials and their textures (steel, glass, brushed grain, the studio) must survive the old watch being freed. Expected: the watch looks the same the fifth time as the first, and the renderer's geometry and texture counts are the same each time. Test in Task 1.3.
2. **Faces changed quickly while a watch is still building:** expected one canvas, one context, and the watch of the last face chosen; a face with no watch ends the mode even if a build is in flight. Test in Task 1.4.
3. **Full screen while the masthead is off screen or covered:** the frame loop is tied to the masthead stage being in view. Expected: the watch keeps running in full screen whatever the page behind is doing. Test in Task 2.2.
4. **Full screen ended by the browser, not the page** (Escape, F11, a phone's swipe or back gesture, the tab losing the right to full screen), or the graphics context lost while in it: expected the dialog closed, the canvas back in the masthead at the right size, and the usual failure caption when it was a loss. Test in Task 2.2.
5. **A phone turned, or the window resized, in full screen:** expected the whole watch on screen in all six views in portrait and landscape, controls clear of the notch and home bar. Test in Task 2.3.

## File Structure

| File | Responsibility |
|---|---|
| `site/watch3d/kit/stage.js` (from `mount.js`) | Renderer, lights, camera, the six default views, dragging, pressable parts, frame loop, showing and freeing a watch, dispose. |
| `site/watch3d/kit/{materials,env,geo,type,loop}.js` (moved) | Shared finishes, the studio, shape tools, lettering tools, the bracelet-loop solver. |
| `site/watch3d/watches/navitimer/index.js` (from `watch.js`) | `about` and `build` for the Navitimer. |
| `site/watch3d/watches/navitimer/{dims,case,dial,hands,back,bracelet}.js` (moved) | The Navitimer's parts and numbers. |
| `site/watch3d/watches/gmt-master-ii/` (Part 3) | The GMT's `index.js` and parts. |
| `site/watch3d.js` | The Full watch button, the face-to-watch table, the view list, full screen, when the loop runs. |
| `site/index.html`, `site/style.css` | The Full screen button and the dialog (Part 2). |
| `tools/watch3d-shots.sh`, `tools/watch3d-compare.py` (new) | Shoot the six views of a watch at a frozen time; compare two sets of shots. |
| `research/watch3d/gmt-master-ii-126710blro.md`, `docs/watch3d-kit.md` (Part 3) | The GMT's research; the guide for the next watch. |
| `site/releases.js`, `README.md` | The record. |

---

## Part 1: the kit split (Opus builder, no visible change)

### Task 1.1: A repeatable picture of the Navitimer

**Files:**
- Modify: `site/watch3d.js` (the `options` object in `enter()`)
- Create: `tools/watch3d-shots.sh`, `tools/watch3d-compare.py`

**Interfaces:**
- Produces: `tools/watch3d-shots.sh <base-url> <dial-slug> <out-dir>` writes `hero.png front.png side.png back.png clasp.png bracelet.png`; `tools/watch3d-compare.py <dir-a> <dir-b> [--max-diff N] [--max-pixels N]` prints, per view, the number of differing pixels and the largest channel difference, and exits 0 only when every view is within the limits (defaults 0 and 0). Baseline shots in `/tmp/watch3d-base/navitimer/` (not committed).

- [ ] **Step 1:** In `site/watch3d.js`, pass the page's `?time=` on to the stage as `options.time` when it matches `/^\d{1,2}:\d{2}(:\d{2})?$/`. The stage already freezes the hands and holds the stopwatch at zero for a given time.
- [ ] **Step 2:** Write `tools/watch3d-shots.sh`: for each of the six views, headless Chromium (find the binary; GPU on, as the 2026-11-25 checks used `--virtual-time-budget=20000`) shoots `<base-url>?dial=<dial-slug>&full=1&view=<view>&time=10:08:30` at a 1440 by 900 window. The three-quarter view is the address without `view`.
- [ ] **Step 3:** Write `tools/watch3d-compare.py` with Pillow.
- [ ] **Step 4:** Shoot the baseline twice into `/tmp/watch3d-base/navitimer/` and `/tmp/watch3d-base/navitimer-again/` and compare them. Expected: identical. If a view is not repeatable (the case back's balance and rotor move on their own clock), find out why and report it; do not change the model to hide it. The limits used from here on are the noise measured here, stated in the commit message.
- [ ] **Step 5:** Commit: "Pass the frozen time to the 3D watch; scripts to shoot and compare its views".

### Task 1.2: Move the files

**Files:**
- Move: `site/watch3d/{materials,env,geo,type,loop}.js` to `site/watch3d/kit/`; `site/watch3d/mount.js` to `site/watch3d/kit/stage.js`; `site/watch3d/watch.js` to `site/watch3d/watches/navitimer/index.js`; `site/watch3d/{dims,case,dial,hands,back,bracelet}.js` to `site/watch3d/watches/navitimer/`
- Modify: every import line in them; `site/watch3d.js` (`import('./watch3d/kit/stage.js')`)

- [ ] **Step 1:** `git mv` the files and fix the import paths. No other change.
- [ ] **Step 2:** Run `tools/watch3d-shots.sh` into `/tmp/watch3d-now/` and compare with the baseline. Expected: exit 0.
- [ ] **Step 3:** Commit: "Move the 3D watch into kit/ and watches/navitimer/".

### Task 1.3: The stage stops knowing which watch it shows

**Files:**
- Modify: `site/watch3d/kit/stage.js`, `site/watch3d/kit/loop.js`, `site/watch3d/kit/materials.js`, `site/watch3d/watches/navitimer/index.js`, `site/watch3d/watches/navitimer/bracelet.js`, `site/watch3d.js`

**Interfaces:**
- Produces, in `watches/<id>/index.js`:
  - `export const about = { id: string, label: string, hint: string, caption?: string, views?: { [name]: { dir: number[3], dist: number, target: number[3] } } }`. `label` is the canvas's `aria-label`. `hint` follows the caption in Full watch mode. `caption`, when present, replaces the face's own caption in the mode. `views` overrides any of the kit's six.
  - `export async function build({ M, renderer, frozen }): Promise<{ group: THREE.Group, tick(date: Date, dt: number, camera): void, press: Array<{ object: THREE.Object3D, down(): void, up?(): void }>, idle?(seconds: number): void, report: object }>`. `press` lists the parts the reader can press. `idle` is called when the frame loop restarts, with the seconds it was stopped.
  - For the Navitimer: `about.id` `'navitimer'`, `label` and `hint` are today's texts (`'3D model of a blue and cream chronograph on a steel bracelet. Drag to turn.'`, `'Drag to turn. Press the pushers to run the stopwatch.'`), no `caption`, no `views`; `press` is the two pushers; `idle` credits the running stopwatch.
- Produces, in `kit/stage.js`: `export async function mount(container, options)` where `options` gains `watch: string` (a watch id matching `/^[a-z0-9-]+$/`, required) beside today's `shadowSize`, `reducedMotion`, `onLost`, `onInteract`, `time`. The handle keeps `canvas, views, setView, start, stop, running, dispose`, loses `chrono` (nothing outside uses it; confirm with a search), and gains `about` (the `about` of the watch showing) and `show(id: string): Promise<void>`.
- `show(id)`: stops the loop, removes the watch showing and frees its geometries and every material and texture that is not one of the kit's shared ones, imports `../watches/<id>/index.js`, builds it, applies its views, sets the canvas label, draws one frame, and resolves. Calls are serialised and the last one wins: a `show` overtaken by a later one does not leave its watch in the scene. If the build throws, the promise rejects and the stage holds no watch. `mount` is `show(options.watch)` after the stage is made.
- `kit/loop.js`: no bracelet's numbers. `solveLoop(spec, opts?)`, `widthAt(s, spec)`, `checkLoop(L)` take the bracelet's dimensions as an argument. `BRACELET` and `rowsAt`, which know the seven-row pattern, move to `watches/navitimer/bracelet.js`.
- `kit/materials.js`: `COLORS` keeps only what a kit material uses; the dial's blue and cream go to the Navitimer's folder if anything there uses them, and are deleted if nothing does.

- [ ] **Step 1:** Make the changes above. The stage's pusher code becomes code for the `press` list (raycast against each entry's `object`; on a hit, the orbit controls sit the gesture out, `down()` is called, and `up()` on release; the pointer cursor shows over a pressable part). The Navitimer's `index.js` keeps the pusher's travel animation in its own `tick`.
- [ ] **Step 2:** `rg -n -i 'navitimer|breitling|pusher|chrono|slide' site/watch3d/kit/` finds nothing (comments included, bar a comment that names a watch as an example of use).
- [ ] **Step 3:** Shoot and compare with the baseline. Expected: exit 0.
- [ ] **Step 4 (Review Focus 1):** In the Orca browser, open `?full=1&time=10:08:30`, then from the console path the builder arranges for checking (a temporary `window.__stage = handle` line, not committed), call `show('navitimer')` five times in turn, reading `renderer.info.memory` after each. Expected: geometry and texture counts identical after each call; the canvas after the fifth is the same picture as after the first (shoot and compare, or compare canvas pixels); console empty. Also call `show('navitimer')` twice without awaiting: one watch in the scene afterwards. Also `show('no-such-watch')`: rejects, and a following `show('navitimer')` works.
- [ ] **Step 5:** Start, stop and reset the stopwatch with the pushers by mouse; dragging elsewhere still turns the watch.
- [ ] **Step 6:** Commit: "The stage shows any watch: about and build per watch, pressable parts, show(id)".

### Task 1.4: The site's face-to-watch table

**Files:**
- Modify: `site/watch3d.js`, `README.md`

**Interfaces:**
- Consumes: `mount(container, { watch, ... })`, `handle.show(id)`, `handle.about`.
- Produces: in `site/watch3d.js`, `const WATCHES = { 'Slide-rule chronograph': 'navitimer' }` and `const DEFAULT = 'Slide-rule chronograph'`. Part 3 adds one row.

Behaviour:
- Pressing Full watch on a face in `WATCHES` opens that face's watch. On any other face, the masthead switches to `DEFAULT` and its watch opens (today's behaviour).
- While the mode is on, a `wbm-dial` for a face in `WATCHES` whose watch is not the one showing keeps the mode on: the canvas is hidden, the "Building the watch" label and the live message show, `handle.show(id)` runs, then the watch shows in the three-quarter view. A face not in `WATCHES` ends the mode, as today, even while a build is in flight.
- The caption in the mode is `about.caption` if the watch has one, otherwise the face's own, followed by `about.hint`.
- The address is unchanged: `dial` names the face, `full=1`, `view`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2 (Review Focus 2):** With a temporary second row `'Two-tone GMT': 'navitimer'` (not committed) and the stage made to treat a repeated id as a fresh build: in full mode on the Slide-rule chronograph choose Two-tone GMT from the list: the mode stays on, the label shows, the watch returns. Then choose Two-tone GMT, Slide-rule chronograph, Two-tone GMT, Panda chronograph within a second: the mode ends on the Panda face, one canvas exists, no watch appears afterwards, console empty. Remove the temporary row.
- [ ] **Step 3:** Every check from pull request 30, on the committed code: 0 requests under `/watch3d/` before the press (and the count and bytes after, for the record); the three ways out (the button, another face, Randomize); the button pressed twice and three times quickly; leaving while loading; resize across 1200 px; the loop stops off screen and in a hidden tab; a forced context loss gives the caption "The 3D watch could not be shown on this device."; phone 390 by 844; the address cases (`?full=1`, `?full=1&view=back`, `?dial=panda-chronograph&full=1&view=side#picks`, bare address stays bare); the live-region texts.
- [ ] **Step 4:** Shoot and compare with the baseline. Expected: exit 0.
- [ ] **Step 5:** Correct the README's account of `site/watch3d/` (the kit, the watches folder, the two scripts in `tools/`). No release note: a reader sees nothing new.
- [ ] **Step 6:** Commit: "Full watch opens the watch that belongs to the face".

---

## Part 2: full screen (Opus builder)

### Task 2.1: What the stage needs for it

**Files:**
- Modify: `site/watch3d/kit/stage.js`

**Interfaces:**
- Produces on the handle: `moveTo(container: HTMLElement): void` (the canvas is appended to the new element, the resize observer follows it, the watch is refitted and drawn at once; the WebGL context is kept); `wheel(zooms: boolean): void` (false, the default, leaves the wheel to the page as today; true lets the orbit controls zoom with it); `density(max: number): void` (caps the canvas's pixel ratio at `max`, default 2, and redraws).

- [ ] **Step 1:** Implement the three.
- [ ] **Step 2:** Through a temporary `window.__stage`: `moveTo` a 300 by 600 test element and back; the watch is whole and unstretched in both and `renderer.info.memory` is unchanged. `wheel(true)` then a wheel event zooms and the page does not scroll; `wheel(false)` and the page scrolls. `density(1)` halves the canvas's backing size on a 2x display.
- [ ] **Step 3:** Shoot and compare with the baseline. Expected: exit 0.
- [ ] **Step 4:** Commit: "Stage: move the canvas, wheel zoom on request, pixel-density cap".

### Task 2.2: The Full screen button and the dialog

**Files:**
- Modify: `site/index.html`, `site/style.css`, `site/watch3d.js`

**Interfaces:**
- Consumes: `handle.moveTo`, `handle.wheel`, `handle.density`.
- Produces, in `site/index.html`: `<button type="button" id="dialScreen" hidden>Full screen</button>` after `#dialView` in its row, shown only while the 3D watch is showing; and, at the end of `<body>` before the scripts, `<dialog id="watchScreen" class="watch-screen" aria-label="The 3D watch, full screen">` holding `<div class="ws-in" id="watchScreenIn">` with `<div class="ws-host" id="watchScreenHost"></div>`, a bar with `<select id="screenView" aria-label="View of the watch">` and `<button type="button" id="screenClose">Close</button>`, and `<p class="ws-name" id="screenName"></p>`.

Behaviour:
- **Enter** (press `#dialScreen`): `#screenView` gets a copy of `#dialView`'s options and value; `#screenName` gets the caption; `dialog.showModal()`; the canvas moves into `#watchScreenHost`; `handle.wheel(true)`; focus goes to `#screenClose`; then `#watchScreenIn.requestFullscreen()` is tried when the browser has it. A missing API or a rejected promise is not an error: the dialog, which fills the window, is the result.
- **The dialog fills the window:** no border, no padding, `100vw` by `100dvh`, the page's own ground (`var(--paper)`), the host filling it, the bar and the caption laid over the edges inside `env(safe-area-inset-*)`, controls at least 44 px tall. `html` gets a class that stops the page behind from scrolling.
- **Leave:** `#screenClose`, Escape (the dialog's `cancel`/`close`), and `fullscreenchange` reporting that full screen has ended while the dialog is open. Each path ends in one function: leave the browser's full screen if it is on, close the dialog, move the canvas back to `#dialStage`, `handle.wheel(false)`, `handle.density(2)`, copy `#screenView`'s value back to `#dialView`, put focus on `#dialScreen`. The page is where it was scrolled; Full watch mode is still on.
- **Views:** a change of `#screenView` sets the view and keeps `#dialView` in step; turning the watch by hand shows "Turned by hand" in both.
- **The loop** runs while the dialog is open whatever the masthead stage's visibility is; it still stops in a hidden tab.
- **Failure in full screen** (context lost): leave full screen first, then the existing failure path.
- Full screen is not written to the address and adds no history entry.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** At 1440 by 900 in the Orca browser: enter, all six views from `#screenView`, drag, wheel zooms, leave by Close; enter, leave by Escape; enter, leave by `document.exitFullscreen()` from the console. After each: the dialog is closed, the canvas is inside `#dialStage` at the stage's size, `#dialView` shows the view last chosen, focus is on `#dialScreen`, `scrollY` is what it was, the wheel scrolls the page again.
- [ ] **Step 3:** With `Element.prototype.requestFullscreen` replaced by a function that rejects (and again with it deleted): the dialog alone fills the window and every way out still works.
- [ ] **Step 4 (Review Focus 3):** Scroll the masthead off screen is not possible with the dialog open, so check the loop's condition directly: with the dialog open, `handle.running` is true after the masthead's intersection observer has reported not-intersecting (resize the window so the stage is below the fold before entering, or call the observer's handler).
- [ ] **Step 5 (Review Focus 4):** In full screen, force a context loss (`WEBGL_lose_context`): the dialog closes, the flat face is back, the caption is the failure sentence, the Full watch button is off, console has only the expected warning.
- [ ] **Step 6:** Tab from `#screenClose` stays inside the dialog; nothing behind it takes focus; a screen reader's view of the page (the accessibility snapshot) shows only the dialog's contents.
- [ ] **Step 7:** Commit: "Full screen for the 3D watch".

### Task 2.3: Sizes, speed and the record

**Files:**
- Modify: `site/style.css`, `site/watch3d.js` (only as the checks require), `site/releases.js`, `README.md`

- [ ] **Step 1 (Review Focus 5):** Full screen at 390 by 844 (phone portrait, `--mobile --scale 3`), 844 by 390, 820 by 1180 and 1440 by 900: in each, all six views show the whole watch, bracelet included, and the bar and caption overlap neither the watch's dial nor each other. If a view is cut off in a shape, fix the fit in the stage (it already stands the camera back by `Math.max(1, 0.86 / camera.aspect)`; a wide, short landscape shape may need the same for height). Change the viewport while in full screen (portrait to landscape): the watch refits.
- [ ] **Step 2:** Measure frames a second in full screen at 1440 by 900 and at 2560 by 1440 with a device scale of 2 (count `requestAnimationFrame` callbacks over 5 seconds while a view change is in flight). If under 30, call `handle.density()` with a lower cap on entering full screen until it holds, and say what cap was needed. Report the figures either way.
- [ ] **Step 3:** Firefox: enter and leave full screen and shoot one view (drive it over WebDriver BiDi as `/tmp/ff-bidi.mjs` does if it is still there; otherwise report it unchecked).
- [ ] **Step 4:** Shoot and compare with the baseline (masthead, not full screen). Expected: exit 0. Rerun Task 1.4 Step 3's checks that touch the same code: the three ways out, leaving while loading, the address cases.
- [ ] **Step 5:** Release note id 31, dated 2026-11-26, title "The 3D watch, full screen": what the button does, how to leave, that the wheel zooms there, that on a phone whose browser will not hide its bars the watch fills the window instead. README: the dialog, the three handle methods, the limits (no address parameter, no real iPhone tested).
- [ ] **Step 6:** Commit: "Full screen: sizes, speed, release note 31 and README".

---

## Part 3: the GMT-Master II (Fable agent through Orca)

This part is a brief, not steps: the agent is doing modelling work that cannot be dictated line by line. The brief is written after Part 2 is merged so that it names the kit's real functions, and is saved as `docs/superpowers/plans/2026-11-26-gmt-brief.md` before the agent starts.

### Task 3.1: Write the brief and start the agent

The brief carries, from the spec: the reference and the scope list under "The GMT model" (marked as from memory, the research wins); research first, from the web, into `research/watch3d/gmt-master-ii-126710blro.md`, sources cited by address, no photographs saved; the watch module contract from Task 1.3; the rule for what goes in the kit; the Navitimer comparison after every kit change (`tools/watch3d-shots.sh`, `tools/watch3d-compare.py`); the lettering test, the memory limit and the six views; lighting may be adjusted per watch through a new optional `about.light` the agent adds to the stage (lamps' strength and direction, exposure, environment strength; defaults are today's values; the studio is not replaced; the stage puts the defaults back when another watch is shown); behaviour (current time, the movement's small seconds steps, the 24-hour hand on UTC, today's date larger under the magnifier, the bezel turning in 24 steps if it can be made to feel right); the row `'Two-tone GMT': 'gmt-master-ii'` in `WATCHES` and `about.caption` `'After the Rolex GMT-Master II, ref. 126710BLRO.'`; release note id 32 and the README; the guide `docs/watch3d-kit.md` with the contents listed in the spec; the measures (start and finish times, lines in `watches/gmt-master-ii/`, lines added to or changed in `kit/`, lines of kit used unchanged); the checks under "Checks before either pull request is merged" for the GMT, including five switches between the two watches with steady geometry and texture counts and no request to `watches/navitimer/` when only the GMT is opened; port 8774; commit, no push, no pull request; `NOTES.md` in the watch's folder listing every estimate.

Start: `orca worktree create --name gmt-master-ii --parent-worktree active --base-branch origin/main --agent claude --model claude-fable-5-2 --effort xhigh --prompt "$(cat <brief>)"`.

### Task 3.2: Review, look, show the owner

- [ ] An Opus reviewer reads the branch against the spec and the brief.
- [ ] I check in the browser: the six views and close-ups of both watches, the Navitimer comparison, switching between the two, full screen with the GMT, the address `?dial=two-tone-gmt&full=1`, Chromium and Firefox.
- [ ] Screenshots of the GMT go to the owner before the pull request is merged.

---

## Who does what

- Parts 1 and 2: `ag-builder` with `model: 'anthropic/claude-opus-5-5'`, one run per part, then `ag-reviewer` on the same model over the part's commits, then my own check in the browser, then the pull request and merge.
- Part 3: a Fable 5.2 agent at xhigh through Orca, then review and my check as in Task 3.2, then the owner sees it.
