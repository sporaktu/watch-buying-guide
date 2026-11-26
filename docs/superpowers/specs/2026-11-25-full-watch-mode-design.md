# Full watch mode in the masthead

Date: 2026-11-25. Status: awaiting the owner's approval. Size: a small change with one awkward part (the library).

## Intent

The owner tested model-building agents by having each build a blue and cream Navitimer-style watch in 3D. He wants
the one built by the Fable agent on the live guide: a button under the masthead dial that swaps the flat dial for
the whole watch, case, bracelet and case back, which the reader can turn.

## What the owner decided

- The Fable agent's model goes on the site once that agent has finished.
- A button under the dial swaps to the full watch.
- The button is always there, whichever of the 43 dials is showing. Pressing it switches the masthead to the
  Navitimer-style dial ("Slide-rule chronograph") and opens the 3D watch.

Everything below is my call unless marked as his.

## Goals

- One press from any dial to a 3D watch the reader can turn, in the masthead, in place of the dial.
- A reader who never presses the button downloads nothing extra.
- The site keeps its content security policy unchanged and still has no build step.

## Non-goals

- 3D versions of the other 42 dials.
- Changing the flat dials, the lit dial renderer (site/dial3d.js) or the flat bracelet drawing (site/band.js),
  beyond what the button needs.
- Improving the model itself. It goes up as the Fable agent left it; faults found by eye are reported to the
  owner, not fixed here.

## Anti-goals

- The page getting slower or heavier for readers who do not press the button.
- The watch trapping the page: a reader on a phone must still be able to scroll past the masthead.
- A dark square on the light page. The watch sits on the page's own ground.

## How it works today

- site/index.html lines 26-51: \`.dial-wrap\` holds \`#dialStage\` (the dial button \`#dial\` and the bracelet canvas
  \`#band\`), then two control rows: \`#dialPick\`, \`#dialPin\`, \`#dialRandom\`; then \`#dialBand\`, \`#dialWrist\`; then
  the caption \`#dialName\`. The stage is a square, at most 400 px wide, 560 px under the narrow layout.
- site/dials.js keeps the dial list \`D\` and the functions \`show(i)\` and \`choose(i)\` private. It announces each
  change with a \`wbm-dial\` event on \`document\`. The Navitimer-style dial is the entry named
  \`Slide-rule chronograph\`.
- The page's policy is \`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self';
  font-src 'self'; connect-src 'none'\`.
- The Fable model lives on branch \`sporaktu/fable-navitimer\` under lab/fable-navitimer/: index.html, src/ (about
  110 KB of modules), fonts/Jost-latin.woff2, vendor/ (three.js: three.core.js 1.47 MB, three.module.js 0.66 MB,
  OrbitControls, BufferGeometryUtils, licence).

## What stands in the way

1. **The policy blocks the model as written.** Its page builds an import map in an inline script, and its modules
   import by bare names (\`three\`, \`three/addons/...\`, \`navitimer/...\`, including two dynamic imports built from a
   name). Inline scripts are not allowed on the site, so the import map cannot come along. Every import in the
   copied files has to become a relative path.
2. **The model assumes it owns the window.** src/main.js sizes to \`window.innerWidth\` and \`innerHeight\`, looks up
   \`#view\`, \`#boot\`, \`#spin\` and \`nav button[data-view]\`, reads options from the page address, sets a dark
   backdrop, and never stops its frame loop.
3. **Weight.** three.js is about 2.1 MB unminified. The site has no libraries today.

## Approaches

- **A. In place, loaded on demand (chosen).** Copy the model into site/watch3d/ with relative imports, give it a
  \`mount(container)\` entry, and load it with a dynamic \`import()\` only when the button is pressed. Costs: a
  one-off edit of every import line, and a second copy of the model that will drift from the lab copy.
- **B. The lab page in an iframe.** Least code, but the inline import map is still blocked by the policy unless
  the policy is loosened, and a framed page cannot sit on the page's ground or share its controls.
- **C. A link to a separate full-page viewer.** Simple and safe, but it is not a swap under the dial, which is
  what the owner asked for.

## Design

**Files.** \`site/watch3d/\` holds the model's modules, the font and three.js. Use the minified builds of the same
three.js version (\`three.module.min.js\`, \`three.core.min.js\`) if they can be had from the npm package of that
exact version; otherwise the vendored copies. Keep the licence file. A small classic script \`site/watch3d.js\`
(deferred, listed in index.html) owns the button and does the dynamic import; nothing under site/watch3d/ is
fetched before the first press.

**The button.** A third control in the second row, after "On a wrist": \`Full watch\`, a toggle
(\`aria-pressed\`).

    [            dial / 3D watch            ]
    [ 2. Slide-rule chronograph v ][ Pin ][ Randomize ]
    [ Steel bracelet v ][ On a wrist ][ Full watch ]
    after the Breitling Navitimer

**Pressing it.**

1. The masthead switches to the Slide-rule chronograph dial, as if chosen from the list for this visit (not
   pinned). dials.js needs a small public hook for this, for example \`window.WBMDials = { choose(name), current() }\`.
2. The stage shows "Building the watch" over the flat dial while the files load and the model builds.
3. The flat dial and bracelet canvas are hidden and the 3D canvas fills the stage square. The stage keeps its
   size, so nothing below it moves.
4. The bracelet chooser becomes a view chooser (Three-quarter, Front, Side, Case back, Clasp, Bracelet) and
   "On a wrist" is disabled, because the model has its own bracelet. The caption gains "Drag to turn. Press the
   pushers to run the stopwatch."

**Leaving it.** Press the button again, choose another dial from the list, or press Randomize. The flat dial
returns, the frame loop stops, and the bracelet chooser comes back as it was. The built model is kept in memory,
so a second press is instant. The mode is not remembered across page loads.

**Turning and scrolling.** Dragging on the watch turns it, with one finger on a phone. The mouse wheel does not
zoom, so the page scrolls as usual with the pointer over the watch; pinch zooms on touch screens. The page stays
scrollable from anywhere outside the stage.

**Look.** A transparent canvas over the page's ground, no dark backdrop. The steel still reflects the model's
own studio environment. This is the part most likely to need tuning by eye, because the model was lit against a
dark background.

**Cost while running.** The frame loop runs only while the mode is on and the stage is on screen. Pixel ratio is
capped at 2. The 4096 px shadow map drops to 2048 on narrow screens. With \`prefers-reduced-motion\`, the
turntable is off and view changes cut instead of fly; the hands still keep time.

**Failure.** If WebGL is missing, a file fails to load, or the build throws, the flat dial stays, the button
turns itself off, and the caption says the 3D watch could not be shown on this device. The error goes to the
console. Losing the WebGL context later does the same.

**Record.** A release note in site/releases.js and a README section naming site/watch3d/, the on-demand load and
where the model came from. The note's number depends on whether the floating-bar search (note 29, branch
\`fuzzy-nav\`) merges first.

## Left to the builder

- How to restructure src/main.js into \`mount(container, options)\` returning \`{ setView, start, stop, dispose }\`.
- How imports are rewritten, provided no inline script and no policy change is needed.
- Exact wording, the loading indicator, and CSS, in the style of the existing controls.
- Which of the model's debug options (page-address parameters, \`window.__nav\`) survive. None need to.

## Checks before it is called done

- No request under site/watch3d/ on a plain page load; requests appear on the first press.
- No policy violation in the console, with the site's policy unchanged.
- From a dial other than the Slide-rule chronograph: press, the list shows the Slide-rule chronograph, the watch
  appears and turns; leave by each of the three ways; press again.
- Wide (1440 x 900) and phone (390 x 844, fresh load): the watch fits the stage, the page scrolls, pushers work.
- Screenshots of each view on the page's ground, shown to the owner.
- An independent review of the diff before merge.

## Order of work

Branch \`sporaktu/full-watch\` from origin/main in its own worktree. Building starts when the Fable agent has
finished and the owner has approved this document. Both this branch and \`fuzzy-nav\` touch site/index.html,
site/style.css, site/releases.js and README.md; whichever merges second is rebased.
