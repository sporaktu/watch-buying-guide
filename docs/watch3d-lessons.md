# Lessons from building the Navitimer in 3D

Written by the agent that built the Navitimer, for an agent about to build a second watch with the kit. Code references are to the kit as it stood at commit `e364ee2` on branch `sporaktu/watch-kit`. I cite a file and a function name, not line numbers, because the split is still moving. The kit changed four times while I wrote this, so check a name before relying on it.

How far to trust each part of this document:

- **The Navitimer itself.** I built it and looked at it in headless Chromium on a real GPU, on 25 November 2026. Statements about it are tested unless I say otherwise.
- **The kit split and the site page.** Someone else carried my code into `site/watch3d/`. I read that code and compared it with mine. I ran it for three things only: the six views of the site page through the kit's shot tool on the software renderer, which drew the watch correctly at masthead size; the loop check in node; and my checking scripts against the site page at kit commit `c270c0f` (section 2). The steel materials, the studio, the three lamps and the renderer settings have the same values as mine.
- **What changed in the kit after `e364ee2`.** Four later commits closed gaps this document describes: the watch's report is handed out (`b7f5e2a`), the shot tool prints the console (`5e71a2b`), the address takes a camera position (`5a0e3d9`), and a watch may adjust the light through `about.light` (`feece7b`). I say so beside each passage it affects. I have run the first three once and only read the fourth.
- **The checking scripts** I used are in `tools/`. Section 2 lists them. Each figure I measured on a picture says how to make it again: the size of the masthead watch, the turn test, the two renderer comparisons and the lamp table.
- **Section 6, the GMT.** Advice only. I have built none of it.
- **Browsers.** Chromium was tested fully. Firefox 160 loaded cleanly and two views matched, but I never clicked or dragged there. Safari and a real phone were never tested; the phone check was a narrow desktop window.
- **How the build went, as opposed to what the code says.** I checked each such statement against my notes, the code and the names of the pictures I kept. Where no record survives I say so.
- **The renderer on this machine changed on 26 November 2026.** Pictures taken here after that are not drawn on the GPU. See "Check the renderer first" in section 2.

Conventions the kit assumes: units are millimetres, the dial faces +Z, 12 o'clock is +Y, 3 o'clock is +X, and z = 0 is the underside of the mid-case.

## Start here: the four faults to prevent

An earlier attempt at this brief without the kit produced a convincing head and four faults. Each has one cause.

| Fault | Cause | Prevention | How to check |
|---|---|---|---|
| Steel near black, or blown to white | Metal has no colour of its own. It shows only what it reflects. In an empty or dark environment polished steel is black. Raising lamps or exposure to fix that clips the flat brushed faces to white. | Use `M.polished`, `M.brushed` and `M.satin` from `makeMaterials` in `site/watch3d/kit/materials.js` unchanged, inside the kit's studio. Never brighten steel with lamps or exposure. See section 4. | In every view each steel part shows at least three tones (dark, middle, bright). No steel area larger than one link is pure black or pure white. |
| Bracelet rows are separate bands with daylight between | Rows built as independent ribbons with a visible gap, nothing crossing them. | Lay links like bricks so every pin crosses every row, put a rod through each pin across the full width, and keep the gap between rows at 0.07 mm. See `segmentGeometry` and `rod` in `site/watch3d/watches/navitimer/bracelet.js`. | In the Bracelet and Clasp views, no page colour shows between rows. A dark line that changes as the watch turns is a reflection; one that shows the page behind is a gap. |
| No visible taper | Constant width, or a taper too small or spread too thin to see. | Give `widthLug`, `widthClasp` and `taperLength` from research and let every link's sides follow `widthAt` in `site/watch3d/kit/loop.js`, so the edge is a smooth line and not steps. | `report.bracelet.widthAtLug` and `widthAtClasp` hold the researched figures, and the two edges visibly converge in the Bracelet view. |
| Clasp is a plate | One box stood in for a mechanism. | Build the parts a clasp has: knuckles round the last pins, a cover with a chamfer, the folding blades under it, a hinge barrel, a release or catch. Give the loop a straight run for it (`head` in the bracelet numbers). | The Clasp view shows links entering both ends through knuckles. The Side view shows at least two stacked layers and a hinge. |

Before blaming a model for black steel or a missing watch, find out what drew the picture. See "Check the renderer first" in section 2.

## 1. Order of work

The order I used, which I would keep:

1. **Screenshot harness on an empty scene.** One command that loads the page, prints console errors, page errors and failed requests, and writes every view as a picture. Shader and loading failures show only in the console.
2. **A material bench on primitives.** A cylinder, a flat disc and a dome under the studio. Settle on the bench that brushed and polished steel look different at a glance, which way the brushing runs, that the crystal is clean at glancing angles, and that shadows behave at millimetre scale. `makeMaterials` is the result; a new watch does not need to repeat this for steel, only for materials the kit lacks.
3. **The bracelet as numbers.** Solve the loop and pass `checkLoop` before any link exists. See section 3, "The loop".
4. **Head silhouette.** Mid-case, lugs, bezel, crystal, crown. Plain materials, no detail.
5. **Bracelet, end links, clasp.** The brief weighted the bracelet equal to the head. It is also the part with the most ways to fail, so it must not be left until the dial is finished.
6. **Dial, markers, hands, date.**
7. **Case back.**
8. **One pass over all six views**, fixing what looks wrong, then the notes.

Leave until every named part passes a screenshot check: anything that moves beyond the hands, any movement visible through a back, any interaction.

What I would do differently:

- **Research the bracelet before building it.** My row finishes, pitch, link thickness, end-link shape and clasp engraving were estimates, and they stayed estimates. Get them at the research stage.
- **Build the end link straight after the lugs.** The end link's top follows the lug's top curve through one shared function (`lugTop` and `underLugTop` in `site/watch3d/watches/navitimer/dims.js`). Every later change to the lug moved the end link.
- **Build the clasp as one part across the seam.** I built it as two mirrored halves, so its bridge is drawn twice and meets in the middle. That is a known weak spot; do not copy it.
- **Keep close-up camera positions in the harness and re-shoot them after every late change.** I re-shot only the six set views at the end. Close-ups were taken while each part was built and not again.
- **Give flanks true curved normals from the start.** See "Case and lugs" below.
- **Take wording from the real watch.** I invented the case-back wording. The site's rule is the maker's wording, so treat mine as a mistake.
- **Open Firefox early**, not at the end.

For scale: the Navitimer took about 1 hour 45 minutes and 2,655 lines, and renders about 380,000 triangles in 303 draw calls at 60 frames a second at 1280 by 800 on the GPU.

## 2. How I checked the work

### The harness

**The checking scripts are in `tools/`**, on the branch that holds this document (`sporaktu/fable-navitimer`). They are plain node files that need node 22 or later, and nothing has to be installed. The console, close-up and lamp tools drive headless Chromium over the DevTools protocol and need Chromium on the path. The loop check and the measuring tool use no browser. Each begins with a comment that says what it does and how to run it. Their names do not clash with the kit's tools, so they can sit in the same folder.

| Script | What it does | Where it works |
|---|---|---|
| `tools/watch3d-console.mjs` | Loads a page and prints the renderer, whether the WebGL context was lost, and every console error and warning, uncaught error and failed request. It exits 0 only when the watch showed and nothing was reported. | Lab page and site page |
| `tools/watch3d-closeup.mjs` | Shoots a set view, a set view turned by a few degrees with a real mouse drag, or the page as it loaded. It can clip to the canvas and double the pixels. | Lab page and site page. A camera position given as coordinates needs the lab page's handle; on the site page use `?cam=` |
| `tools/watch3d-lamps.mjs` | Scales the lamps and prints the mean brightness of fixed boxes at each strength. | Lab page only. It needs the scene, which the site page does not hand out; there it says so and exits with status 2 |
| `tools/watch3d-loopcheck.mjs` | Runs a kit watch's own bracelet build in node, with no browser, and prints its numbers and failures. It exits 1 when a check fails. | Any checkout with the kit's layout |
| `tools/watch3d-measure.mjs` | Measures a picture: the mean brightness of a box, the width of what is drawn along a row or column, or how far two pictures differ. | Any PNG |

`tools/watch3d-browser.mjs` is shared by the others and is not run by itself.

- **Renderer.** The three browser tools take `WATCH3D_RENDERER=software`, with the same meaning as in `tools/watch3d-shots.sh`. Use it on this machine until it restarts (see "Check the renderer first").
- **What they were tested on.** Chromium 158 and node 26 on 26 November 2026, on the software renderer, against my lab page and against the site page of the kit at `c270c0f`. In GPU mode I could test only that they fail and say why.
- **The lab page** is `lab/fable-navitimer/` on branch `sporaktu/fable-navitimer`. The lamp test and the two GPU comparisons below need it, so they can be run only from a checkout that has that folder.
- **Where they came from.** While building I used playwright scripts in a scratch folder for the same jobs. These are ports of them that need no packages. My scripts for clicking the pushers, for other window sizes and for Firefox were not ported.

### What the kit's own tools now do

`tools/watch3d-shots.sh` takes the six set views at 1440 by 900 with the clock frozen at 10:08:30 and checks that the 3D watch was on screen. `tools/watch3d-compare.py` compares two folders of shots pixel by pixel.

At `e364ee2` the shot tool threw the console output away, nothing handed out the watch's `report`, and the address accepted only the six views. Three later kit commits changed that:

- **`b7f5e2a`:** the page writes the watch's report to the stage element as `data-watch3d-report`.
- **`5e71a2b`:** the shot tool prints the renderer, the report, console messages, page errors and failed requests for each view, and saves them as `<view>.json`.
  - **What fails the run:** a console error, a page error, a failed request under the base address, or a warning in the watch's report. `--allow-warnings` lets report warnings through.
  - **What does not:** a console warning. It is printed only.
  - **So a failed bracelet check fails the run only if the watch puts it in the report.** The Navitimer's `buildBracelet` adds each failure to `report.warnings` as well as warning in the console. The kit does not do that for a watch. A new watch that only calls `console.warn` would pass the shot tool with a broken loop.
  - I read this in the tool and in the Navitimer's `bracelet.js` at `296f24c`. I have not made a bracelet check fail on the page to watch the tool stop.
  - **Changed after the second kit review:** a console warning now fails the run too, unless `--allow-warnings` is given, and a page with no report fails unless `--no-report` is given. `kit/loop.js` exports `reportLoop(report, part, failures)`, which puts failures into `report.warnings` and the console; the Navitimer's bracelet uses it, and the stage's contract says a watch must report its own failed checks there.
- **`5a0e3d9`:** `?cam=az,el,dist[,x,y,z]` in the address places the camera anywhere on arrival. The shot tool takes `--scale N` and extra positions written `name=cam`.

I ran the shot tool once at `c270c0f` on the software renderer, with `--scale 2` and one extra position, `crown=80,5,60,20,0,6`. It wrote seven pictures and exited 0. Each view reported 394,401 triangles, 311 draw calls, 132 geometries, 21 textures and no warnings. The Bracelet view's `.json` held the bracelet's numbers with an empty list of failures.

So use the kit's shot tool for the six views and their console output. Use the scripts above for the rest: the loop check with no browser, a view turned by a few degrees, measurements on a picture, and the lamp test.

### The loop check in node

`site/watch3d/kit/loop.js` imports nothing, so node loads it as it is.

- **Run it:** `node tools/watch3d-loopcheck.mjs <worktree> <watch-folder>`. It loads the watch's own `bracelet.js` and runs its `buildBracelet`, so the numbers are those of the loop the page builds.
- **What the watch must export** from `site/watch3d/watches/<watch-folder>/bracelet.js`:
  - `buildBracelet({ M, report })`, which fills `report.bracelet` with its failures and numbers;
  - `BRACELET`, the written figures;
  - both from a module that node can load: imports by path, and no canvas while building.
  - The Navitimer's `site/watch3d/watches/navitimer/bracelet.js` is the pattern.
- **On the Navitimer at `c270c0f`:** 42 pins, 40 links, 138.1 mm round, largest joint turn 9.3°, no failures.
- **Prove that it can fail.** Add `segments=9` to the command, for 9 links per half in place of 20. Two joints then bend more than a link allows (46.7° and 38.9°) and the tool exits 1.
- **If `buildBracelet` is missing or cannot run in node**, the tool solves from the written `BRACELET` alone and prints the numbers, but the run ends `FAIL` with exit 1. A check of the written figures must not read as a pass.
  - **For a plan with figures and no builder yet**, `WRITTEN_ONLY=1` accepts it. The verdict then reads `PASS ON THE WRITTEN FIGURES ONLY`.
  - **A builder that exists and cannot run in node** fails whatever is set.
- **Check the numbers the page really uses.** The Navitimer shows the trap.
  - `BRACELET.pin0` is written as (22.75, 0.85). `buildBracelet` does not use it: it passes `solveLoop` the first pin its end link computes, (22.16, -0.73).
  - The two give different loops. The bump comes out at 0.362 against 0.332, and the last pin sits 1.8 mm lower. The tool prints both whenever the written and the built pins differ.
  - Both pass `checkLoop`, but a check on the written figure tests a loop the page never builds.
  - The written figure is my own leftover. My lab source has the same default and the same override.
  - So export the builder itself, as above, and not only the written figures.

### Close-ups

Three ways, in order of effort.

- **Shoot a set view at twice the pixels:** `SCALE=2 CLIP=canvas` with `tools/watch3d-closeup.mjs`, or `--scale 2` with the kit's shot tool.
  - In a 1440 by 900 window the masthead canvas is 400 CSS pixels square, so its picture is 800 pixels square.
  - In the Front view the Navitimer's head measures 467 pixels from the edge of the bezel at 9 o'clock to the tip of the crown.
  - An earlier version of this document said the masthead watch was "about 865 pixels wide". That was wrong: it was the width of a crop I had made, not of the watch.
  - The stage caps the pixel ratio at 2, so a larger factor gains nothing.
  - To measure it again: `W=1440 H=900 SCALE=2 CLIP=canvas WATCH3D_RENDERER=software node tools/watch3d-closeup.mjs 'http://127.0.0.1:8000/site/?dial=slide-rule-chronograph&full=1&time=10:08:30' <out-dir> front`, then `node tools/watch3d-measure.mjs span <out-dir>/front.png row=400`.
- **Turn a set view by a few degrees.** A shot written `front~10,0` is the Front view after a mouse drag that swings the camera 10° to the right. `clasp~0,-15` looks from 15° lower.
  - **The amount is right.** On both pages the picture after a 10° drag matched one from a camera placed at exactly 10°: the share of pixels differing by more than 8 levels was 0.00 per cent to two decimals, and about 0.1 per cent differed at all. Cameras placed at 8° and 12° differed from it in 1.2 per cent of the window on the site page and 6.9 per cent on my lab page. A 15° drag upward matched likewise on the lab page. I placed the camera with `?cam=10,0,166,0,0,2` on the site page and with a `cam:` shot on the lab page.
  - **The direction is right.** By eye the watch turned the right way.
  - **A 10° turn of the Front view changed 2.2 to 2.3 per cent of the pixels** of the 1440 by 900 window on the site page, by more than 8 levels. To measure it again: `W=1440 H=900 WATCH3D_RENDERER=software node tools/watch3d-closeup.mjs '<address>' <out-dir> front front~10,0 front~-10,0`, then `node tools/watch3d-measure.mjs diff <out-dir>/front.png <out-dir>/front_azp10_elp0.png`, and the same with `front_azm10_elp0.png`.
  - The tool cannot move closer on the site page: in the masthead the wheel scrolls the page and does not zoom. A two-finger pinch zooms, which the tool does not do.
- **Place the camera anywhere with `?cam=`**, from kit commit `5a0e3d9` on. The form of the value is given at `parseCam` in `site/watch3d/kit/stage.js`.
  - `cam=80,5,60,20,0,6` gave me a close view of the crown and both pushers. It is the only position I tried.
  - Give it to the kit's shot tool as `crown=80,5,60,20,0,6`, or add `&cam=80,5,60,20,0,6` to the address and shoot `asis:crown` with the close-up tool.

### Check the renderer first

A picture is evidence only if you know what drew it.

- **What happened here.** At 00:56 on 26 November 2026 a system update replaced the graphics driver's files while the old driver was still loaded. Until this machine restarts, a new process cannot use the graphics card, and headless Chromium falls back to SwiftShader, its software renderer.
- **Asked for the GPU, the fallback fails, in two different ways.**
  - On the site page with the shot tool's flag (`--enable-gpu`), Chromium's log said "WebGL1 blocklisted" and "WebGL2 blocklisted". The page showed the flat dial and the line "The 3D watch could not be shown on this device."
  - On my lab page with my harness's flags, the WebGL context was lost once and the watch was then drawn with nothing to reflect. The steel was near black: a mean brightness of 25 out of 255 on the bracelet, against 161 in the GPU shot. That picture looks exactly like the first fault in the table at the top, and it is not a modelling fault.
- **Asked for the software renderer by name, it draws correctly.** With `--use-angle=swiftshader` the context is not lost. On my lab page the Hero view then differed from my GPU shot in 0.8 per cent of pixels (by more than 8 levels out of 255).
- **To measure these again.** The figures are from the Hero view of my lab page in a 1400 by 900 window, with the page's header, buttons and hint hidden. The steel box is 620,60,900,200 in that picture.
  - **Shoot:** `W=1400 H=900 HIDE='header,nav,#hint,#boot' node tools/watch3d-closeup.mjs 'http://127.0.0.1:8000/lab/fable-navitimer/?t=10:08:30' <gpu-dir> hero`, and the same into `<software-dir>` with `WATCH3D_RENDERER=software` in front.
  - **Steel:** `node tools/watch3d-measure.mjs mean <dir>/hero.png 620,60,900,200`. My GPU picture and my software picture both give 160.6. The black-steel picture gave 25.4, with 67 per cent of the box below 8.
  - **Difference:** `node tools/watch3d-measure.mjs diff <gpu-dir>/hero.png <software-dir>/hero.png` gives 0.82 per cent of pixels differing by more than 8 levels.
  - **What can be run today.** The software half can, and the picture it makes is identical to the one I measured. The GPU half cannot until the machine restarts. The black-steel picture cannot be made to order: asking for the GPU here now gives no WebGL at all.
  - **The check that matters** is `tools/watch3d-console.mjs`, which reports a lost context and fails the run.
- **The shot tool.** Since commit `480a2a2`, `tools/watch3d-shots.sh` prints the renderer it used, checks that the 3D watch was really on screen, and takes `WATCH3D_RENDERER=software`. I ran it both ways on this machine at 01:14 on 26 November 2026:
  - **Software:** all six Navitimer views were written in 79 seconds, each with the watch drawn and the steel lit.
  - **Default (GPU):** it stopped at the first view with "the 3D watch was not on screen" and wrote no picture. That is the right behaviour. Before that commit the tool would have saved a picture of the flat dial without complaint.
  - **Still not caught:** the tool does not detect a watch drawn with nothing to reflect, which is the fault I saw on my lab page. Look at the pictures. At `c270c0f` I searched the shot tool for a test of a lost context and found none. `tools/watch3d-console.mjs` has one: I forced a loss on both pages and it failed both runs.
- **Rules.**
  - Note the renderer with every set of shots.
  - Compare two sets only if the same renderer drew both. A baseline shot on the GPU before the update will not match a software shot after it, whatever the code did.
  - A frame rate measured on the software renderer says nothing about a real GPU.

### The six views and what each is for

The views are `VIEWS` in `site/watch3d/kit/stage.js`.

| View | Look for |
|---|---|
| Hero (three-quarter front) | Does it read as steel and glass at first glance? Brushed and polished faces distinct. Crystal visible but not veiling the dial. Bezel separate from the case. |
| Front | Proportions against the reference photograph. Lettering legible. Hands at the right angles. Lug tips symmetric. End link fills the space between the lugs. |
| Side | Thickness and the stack of mid-case, bezel and crystal. The lug curve. Crown and pushers centred on the case side. The bracelet leaving the lugs without passing through the case back. |
| Back | The case back and its text, not mirrored. The underside of the lugs and end links. |
| Clasp | The clasp as a mechanism. Links entering it. The loop closed with no step at the seam. |
| Bracelet | Rows, their finishes, the taper, the joints between links, no daylight. |

Close-ups I took while building, each from a free camera, going by the names of the pictures I kept: the dial, a macro of the hands, the crown and pushers, the lugs, the end link, the head from above and from underneath, the case back, the clasp from outside, from the side and from inside, and three points along the bracelet. I kept no picture named for the bezel edge alone or for the date window alone, so I cannot say I checked those two in close-up.

### Numeric checks and what each catches

`checkLoop` in `site/watch3d/kit/loop.js` returns a list of failures:

- **Pin spacing differs from the pitch.** Links would stretch or overlap.
- **Seam off by more than 0.01 mm.** The two halves would not meet at the clasp.
- **Head not level.** The watch would sit tilted on the loop.
- **A joint bends backward.** The bracelet would be concave somewhere, which a real one on a wrist is not.
- **A joint bends more than 24°.** Neighbouring links would cut into each other. The Navitimer's largest bend is 9.3°.

`buildBracelet` adds two of its own: "end link is wider than the gap between the lugs" and "pin k sits inside the case". Both catch a bracelet that looks fine from the front and passes through the head.

`report` carries, per part, the numbers worth reading after every build:

- `report.bracelet`: `failures`, `pin0`, `seam`, `pins`, `links`, `length`, `maxTurnDeg`, `widthAtLug`, `widthAtClasp`.
- `report.dial`: `texture`, `registers`, `scaleTop`, `tenAt`. The last two confirm that the logarithmic scale puts its marks where the formula says.
- `report.hands`: `beat`, `chronographRunning`.
- `report.back`: `engraving`, `notches`.

Two checks that are not in the report:

- **Time.** With the clock frozen at 10:08:30 the hour hand is at 304.25°, the minute hand at 51° and a seconds hand at 180°, measured clockwise from 12. Then, with the clock live, read a screenshot against the system clock. This catches a wrong rotation sign and an hour hand that ignores the minutes.
- **Frame rate and size.** Triangles, draw calls and frames per second at 1280 by 800, with the renderer named.

### Faults I found only by looking at a picture

No check caught any of these.

- **Polished rows were black voids.** The room was too dark. Fixed in the studio, not the material.
- **Flat brushed faces were blown to white.** Fixed with roughness, anisotropy and a grey sheen map together.
- **Polished hands were dark grey face-on.** They mirrored the dark front of the room. Fixed with a dim wall in front of the watch.
- **The crystal veiled the dial.** Its reflection strength came down from 0.34 to 0.2.
- **The brushing ran the wrong way.** I had derived the direction and the bench disagreed. Settle it by picture.
- **A missing file left a part untextured**, with nothing on the page to say so. Only the console showed the 404.
- **Shots taken straight after a window resize were framed wrongly.** The view fit read a stale aspect ratio.
- **Polished link sides looked worse than brushed ones.** A flat mirror reflects one even grey.
- **Dark bars across the polished rows looked like gaps** and were reflections of the dark part of the room. See the test in the table at the top.

## 3. Part by part

Two rules apply to every part. The figures in them are the margins I worked to, not measured limits:

- **Parts that meet must overlap, by 0.2 mm or more.** Parts that only touch show a hairline of light.
- **Stacked layers need a real offset, never the same plane.** Print, lume and applied rings each sit 0.02 mm or more above what is under them. Faces in one plane shimmer.

### Case and lugs

- **What worked.** The mid-case is a `lathe` band of 240 segments in `M.brushed`, with separate narrow runs in `M.polished` for the chamfers (`midCase` in `site/watch3d/watches/navitimer/case.js`). Each lug is one `extrude` of a side profile, pushed across X between an inner and outer face that vary along the lug (`lugs`). The extrusion's skin (top, tip, underside) is one material and its end caps (the flanks) another, which gives polished tops and brushed flanks with a crisp edge between.
- **Numbers.** `caseR` 19.75 for a 41 mm watch, because the 41 mm is measured across the bezel, whose beads reach 20.5. Lug gap 22. Lug tips at y = ±23.3 for 46.6 mm lug to lug. Lug top height is `4.55 - 4.0 * t^1.5`, with t running from 0 at y = 13.5 to 1 at the tip.
- **Known weakness: flanks.** `extrude` gives every cap vertex the same sideways normal, even when the face curves in plan. A brushed flank hides this, and the Navitimer's lug flanks are brushed. A polished one would reflect as one flat mirror, an even pale grey. I saw exactly that when I tried polishing the flat sides of the bracelet links, which are the same kind of face. A polished flank needs its own surface with true normals; see section 6.
- **Known weakness: lug tops** mirror one of the studio's black flags at some angles and go dark.
- **Dropped.** Cutting lugs out of a block. The kit has no boolean operations, and profiles plus extrusion were enough.

### Bezel

- **What worked.** The beaded edge is one `lathe` whose radius is swollen by a function of angle through the `mod` option, with `segs` set to 18 per bead (`bezel` in the same file). The `shade` option writes a darkening into the valleys as vertex colours, and `M.polishedAO` applies it. There is no ambient-occlusion pass, so without this the valleys are as bright as the tops and the beads merge into a ring.
- **Numbers.** 56 beads. That is the research file's count (28 on half of a product picture, doubled). I did not count them myself, and no written source gives the figure. Bead radius from 19.85 in the valley to 20.5 at the top.
- **Weakness.** The valleys between beads are sharp cusps. Real ones are softer.

### Crystal

- **What worked.** Two thin shells, an outer one in `M.crystal` and an inner one in `M.crystalInner`, drawn after everything else (`crystal` in the same file). Both only add reflected light over what is behind them. Neither casts nor receives shadows.
- **Dropped.** three.js transmission. Transparent objects are not drawn into the transmission pass, and it costs a second render of the scene. The additive shell looks like glass because the eye reads a crystal by its reflections.
- **Numbers.** Reflection strength 0.2. At 0.34 it laid a grey veil over the dial. The dome rises from 8.9 at the wall to 11.6 at the apex.
- **Read, not tested by me.** The site's canvas is transparent over the page, and the stage swaps the crystal's blending to suit. That was added in the port.

### Crown and pushers

- **What worked.** The crown is a `lathe` with a `mod` that cuts 24 flutes 0.3 mm deep and a `shade` that darkens them (`crown`). It is built along +Z and then turned to point along +X, which keeps the profile easy to think about. Each pusher is a collar, a stem of radius 1.12 and a cap of radius 1.72, turned to point outward along the case radius at ±30° (`pusher`).
- **Numbers.** Pusher travel 0.55 mm, eased. The crown is placed 0.42 mm outside the case radius. I have no record of why that figure, so check a new crown against the bezel's edge in a close-up.
- **Unsure.** The research file said plain cylinders; the photograph looked like a cap on a stem. I followed the photograph.

### Dial surface and lettering

- **What worked.** One painter function draws the whole dial in millimetres on a canvas, and is run twice with two palettes: once for colour, once for the surface maps (`paintDial` with `COLOUR` and `SURFACE` in `site/watch3d/watches/navitimer/dial.js`). Print can then never drift from its roughness.
- **Real depth where the eye expects it.** The sunk registers are separate floors 0.28 mm below the dial. The date is a real opening with a disc 0.75 mm below. Applied markers are solid pieces from `bevelPlate`. Everything else is print.
- **Numerals.** Small numerals are drawn as strokes by `digits` in `site/watch3d/kit/type.js`, which stay legible where a font at that size does not. Words use `letters` in Jost. The stage waits for the font before any canvas is drawn; a silent fallback font would differ between machines.
- **Numbers.** Colour canvas 4096 pixels across 38.4 mm, about 107 pixels per millimetre. Surface maps 2048.
- **Sunray.** The dial's brushing is an anisotropy map whose direction is radial (`sunrayMap`). It needs a direct lamp to show; this is one of the two jobs the lamps do.
- **Check for mirrored text** at zoom. Canvas textures flip vertically by default, and a part turned to face backward mirrors its text.

### Hands

- **What worked.** Each hand is a flat outline with a bevel (`sword`), a boss at the centre (`boss`) and a lume strip a little above the metal (`mainHand` in `site/watch3d/watches/navitimer/hands.js`).
- **Numbers.** Heights above the dial: hour 0.5 to 0.72, minute 0.82 to 1.04, centre seconds 1.14 to 1.26, so 0.1 mm of air between hands. Hour hand 9.0 long, minute hand 13.05, reaching the minute track.
- **Rotation.** `turn` sets `rotation.z = -degrees`, because clockwise seen from +Z is negative. The hour angle includes the minutes. Seconds advance in steps of one eighth of a second (`BEAT = 8`), matching a movement at 28,800 beats an hour.
- **Polished hands need something bright in front of the watch** or they go dark face-on. The studio's front wall is there for this.

### Case back

- **What worked.** The back is built facing +Z, as if it were a dial, inside a group turned half a turn about Y (`buildBack` in `site/watch3d/watches/navitimer/back.js`). Text drawn the normal way then reads correctly from behind. The engraving is painted once and used for both colour and bump.
- **Do not copy.** The wording on my back is invented, and the movement behind the glass is decoration, not the real calibre.

### Bracelet links

- **What worked.** Each link is its own object, posed from the solved pins: position from `loop.pins[k]`, angle from `loop.heading[k]` (`pose` inside `buildBracelet`). A link's profile is drawn once in the side plane and extruded across each row's width (`linkProfile`, `segmentGeometry`).
- **Brick layout.** Odd segments carry the four wide rows, even segments the three narrow rows. Each piece is 5.87 mm long and spans two pins, and the next piece in the same row starts 0.13 mm later. Every pin therefore passes through every row, and the cross joints are staggered from row to row.
- **Profile.** On the wrist side each end is a half-round of radius `RHO` = 1.435 about its pin. That is pitch 3.0 minus the 0.13 end gap, halved. Two such ends on neighbouring pins clear each other by 0.13 mm at any bend, so links cannot collide. The outer face is flat with small corner radii (0.32 on wide rows, 0.5 on narrow).
- **Rods.** A rod of radius 0.34 runs through every pin across the full width (`rod`). It fills the joints, so there is never a way to see through.
- **Flat faces need extra points.** `relieve` adds points just inside the ends of long straight runs. Without them the rounded corners' normals bleed across the flat and it shades like a pillow.
- **Finishes.** Wide rows brushed along the bracelet's length, narrow rows polished with a 0.2 mm crown across their width so the reflection varies. Row order is in `ROW_FINISH`.
- **Numbers.** `BRACELET` in the same file: pitch 3.0, 20 segments per half, thickness above the pin 1.42, wide rows 3.7, narrow rows 2.4, gap between rows 0.07, end gap 0.13. Four wide and three narrow rows make 22.0. Forty links on 42 pins.
- **Weaknesses.** Polished rows go nearly black where they mirror the dark part of the room. Link sides are flat brushed faces and look pale in the Side view. I tried polishing the sides and it was worse.

### End links

- **What worked.** The end link's top follows the lug's top curve, 0.15 mm below it (`TOP_GAP`), from the first pin in to y = 14.6, where it disappears under the bezel (`endLinkProfiles`). Because lug and end link read one function, they cannot drift apart.
- **Rows carry through.** The wide rows continue as fingers that wrap the first pin. The narrow rows stop short by one link end, leaving room for the first narrow links. The bracelet therefore starts articulating at the end link, as a real one does.
- **Width.** It fills the 22 mm between the lugs, less half the row gap (0.035 mm) each side.
- **Unsure.** The real end link's shape under the bezel. Mine is a guess that looks right from above.

### Taper

- **What worked.** `widthAt(s, spec)` gives the width at distance s along the bracelet, easing from `widthLug` to `widthClasp` over `taperLength` and constant after. `rowsAt` scales every row by the same factor. Each link's sides are slanted to follow `widthAt` along its own length, so the edge of the bracelet is one smooth line.
- **Numbers.** 22 to 18 mm over the first 44 mm of each half. That is 18 per cent, and it is clearly visible. The 18 mm is my estimate.

### Clasp

- **What worked.** Each half ends in three knuckles round its last pin, then a cover plate with its top 0.1 mm above the links, two release buttons on the sides, and, on the wrist side, a bridge strip, an arm strip and a hinge cylinder that follow the loop's curve (`claspHalf`, `claspPath`, `strip`).
- **What makes it read as a clasp.** Links visibly entering it through knuckles. A chamfer round the cover that catches a line of light. Depth in the Side view. Something that looks operable.
- **Weaknesses.** It is two mirrored halves that meet at the seam, so the bridge is drawn twice. It does not open. The engraving is a guess.

### The loop

- **What worked.** `solveLoop(spec, opts)` places pins at equal pitch along a curve whose heading turns from `heading0` at the lug to straight back at the bottom. The turn is not shared evenly between the joints: it is gentle over the top, tight round the side and flat underneath, which is the shape of a wrist. The solver then finds by bisection the one extra bulge that lands the seam exactly on the centre line. The result is half a loop; the other half is the same turned half a turn about Z.
- **Numbers.** `heading0` is 40° below level, which is how a bracelet leaves a case on a wrist. `head` 7.6 is the straight run each half keeps for the clasp. `pin0` is where the first pin sits, under the lug.
- **Solve first, model second.** Change one number, run `checkLoop`, read `maxTurnDeg` and `seam`. Only when the failures list is empty is it worth drawing a link.

## 4. Steel and light

### Which light does what

- **The environment lights the steel.** A metal's look is almost entirely the studio reflected in it. `buildStudio` in `site/watch3d/kit/env.js` is a small room of bright panels on a dim gradient, baked into an environment map by `makeEnvironment`.
- **The three lamps do two other jobs.** They cast the shadows that seat the bezel on the case and the hands on the dial, and they light what is not metal: the dial, the print, the lume, and the dial's sunray brushing. They change the steel very little; the figures are below.

### The three lamps

They are set in `mount` in `site/watch3d/kit/stage.js`, with the values I chose in the lab.

| Lamp | Colour and strength | Position | Job |
|---|---|---|---|
| Key | Warm white, 2.3 | (-70, 85, 100), aimed at (0, -4, -22): upper left, in front | The only lamp that casts shadows. Lights the dial and its print, and shows the sunray |
| Rim | Cool white, 0.9 | (95, 20, 50): the 3 o'clock side, in front | Lifts the side that faces away from the key |
| Back | Cool white, 1.1 | (-45, 45, -95): behind | Lights the back and the far edges, for the Back and Clasp views |

- **Each lamp stands in the direction of one studio panel.** The key is exactly in line with the key soft box; the rim is close to the line of the tall strip on the right, and the back to that of the left back light. Direct light and reflections therefore agree: a shadow falls away from the brightest thing the steel reflects.
- **I wrote no reasons down at the time.** The jobs in the table are what the positions show and what I remember.
- **The strengths were set by eye** on the blue dial. I kept no comparison of other strengths apart from the test below.
- **Shadow settings** suit millimetres: bias -0.0004, normal bias 0.03, radius 2.2. They were set on the bench so that flat faces showed no speckle and shadows stayed attached to their parts. I kept no record of the values that failed.

### What the lamps do to the steel, measured

I scaled all three lamps together on the lab page and measured the mean brightness, from 0 to 255, of fixed regions in each shot. This was on the software renderer, after checking that it matched my GPU shot (section 2).

To print the table again, serve a checkout that has `lab/fable-navitimer/` from its root and run `W=1400 H=900 WATCH3D_RENDERER=software node tools/watch3d-lamps.mjs 'http://127.0.0.1:8000/lab/fable-navitimer/?t=10:08:30'`. It takes under a minute. On 26 November 2026, with Chromium 158, the tool gave every figure below to the last digit. The boxes are the tool's defaults and fit a 1400 by 900 window only.

| Region | Lamps off | Half | As set | Doubled |
|---|---|---|---|---|
| Hero view, steel at the top of the bracelet | 154.2 | 158.8 | 160.6 | 162.9 |
| Bracelet view, the links | 109.1 | 113.4 | 116.0 | 119.5 |
| Hero view, centre of the dial | 109.4 | 116.2 | 120.5 | 126.9 |

- **Doubling the lamps** raises the steel by 1.4 to 3 per cent and the dial by 5 per cent.
- **Turning them off** lowers the steel by 4 to 6 per cent and the dial by 9 per cent.
- **By eye** the steel looks the same at all four levels.
- **Doubling adds a little clipped white on brushed links.** Pixels at 250 or above among the links in the Bracelet view rose from 1.18 to 1.61 per cent.
- **So lamps cannot rescue dark steel.** With the lamps off altogether the steel was still lit.
- **Limits of the test:** one watch, three lamps moved together. I did not move the key lamp alone or change a direction.

### Why the studio is set as it is

- **Large soft panels** (the key soft box, the overhead) give polished steel broad highlights with clean edges.
- **Tall narrow strips** on each side give the long thin highlights that run down a case flank or a bracelet row. These are what say "polished metal".
- **Two panels behind** light the edges that face away, so the silhouette separates from the page.
- **A room that is never black.** Its value is `0.07 + 0.2 * t^1.5` by height. With a black room, polished rows were voids.
- **Four dim walls** at about 0.5 to 0.7. The front one gives face-on hands and the crystal something to reflect.
- **Two black flags.** Polished steel needs dark shapes to reflect as well as bright ones, or it looks like pale plastic.

### Why the materials are set as they are

- **Polished:** roughness 0.055. Low enough for sharp reflections, not zero, which looks like chrome.
- **Brushed:** roughness 0.36, anisotropy 0.8, a streaky normal map and a grey sheen map. All three together. With roughness and anisotropy alone a flat face caught one highlight across its whole area and clipped to white; the sheen map breaks it up.
- **Grain direction** comes from the UVs: U runs along the grain, in millimetres divided by `BRUSH_TILE`, with `anisotropyRotation` at a quarter turn. `lathe` and `extrude` set these UVs for you. A part built another way must set them itself, and the direction must be checked on a picture.
- **Satin:** roughness 0.27, anisotropy 0.6, for small hardware.
- **Tone mapping** is Neutral at exposure 1.0. The research file recommended it so that the cream and the blue keep their hue. I did not compare it against the other tone mappings in a picture, and I did not measure how close the drawn colours are to the values I chose.

### What goes wrong when values are changed

| Change | Result |
|---|---|
| Exposure up | Flat brushed faces clip to white |
| Exposure down, or a darker room | Polished parts go black |
| A bright, even room | Steel turns flat pale grey with no contrast |
| Brushed roughness below about 0.25 | Reads as streaky polished metal |
| Brushed roughness above about 0.5 | Reads as grey paint |
| Sheen map removed | Flat brushed faces blow out |
| Crystal reflection above about 0.3 | Grey veil over the dial |
| All three lamps doubled | Dial about 5 per cent brighter, steel 1.4 to 3 per cent, a little more clipped white on brushed links |

The lamps row is measured (above). The other rows and their thresholds are from my bench by eye.

### Telling brushed from polished in a screenshot

- **Polished** shows images: hard-edged bright shapes beside dark ones, high contrast inside one face.
- **Brushed** shows a soft streak stretched across the grain on a middle grey, never black, with fine lines visible up close.
- **Take two shots about 10° apart.** Polished reflections jump. Brushed faces hardly change. `tools/watch3d-closeup.mjs` takes the pair when given a view and the same view turned, such as `hero hero~10,0`.
- **A polished chamfer between two brushed faces** shows as a thin line, bright or dark.

### What a new watch may adjust

The kit design allows a watch to change the lamps' strength and direction, the exposure and the environment's strength, each listed in its notes with a reason. It may not replace the studio. At `e364ee2` that hook (`about.light`) was not there. It arrived in kit commit `feece7b`. I have read its checks in the stage and have not used it. My lamp tool cannot measure its effect, because it does not run on the site page. Measure the same boxes in a shot before and a shot after with `tools/watch3d-measure.mjs mean`.

- **Safe to adjust:** lamp strength and direction, to suit a dial. By the measurement above the lamps move the dial more than the steel. My guess, untested, is that a gloss black dial wants less from the key lamp than a blue sunray one: it has no sunray to show and its lume clips easily.
- **Adjust only with all six views re-shot:** exposure and environment strength. The design allows both, but each moves every steel face at once, and that is how the first fault in the table at the top comes back.
- **Leave alone:** the steel materials, the tone mapping and the studio's panels. If steel looks wrong, check the renderer first (section 2), then the geometry (a flat face reflecting one thing). The light is rarely the cause.
- **New materials.** The kit design expects gloss ceramic to be added to the kit, not kept in the watch, so write it to take its colour as an argument. Tune any new material on a bench of primitives first.

## 5. The kit: what to use, what to write

### Use these

| Need | Kit piece |
|---|---|
| Anything round: case band, bezel, crown, tubes, rings | `lathe` in `site/watch3d/kit/geo.js`. `mod` shapes the radius by angle (teeth, flutes), `shade` darkens valleys, `phi0` and `phiLen` make part of a circle |
| Anything with a constant side profile: lugs, links, end links | `extrude`. `x0` and `x1` let the width vary along the profile; `crown` domes the top across its width; `edge` rounds the side edges |
| Rounded outlines | `roundPoly`, `arc` |
| Flat plates with a bevel: hands, applied markers, frames | `bevelPlate`. It is flat shaded, which suits small faceted parts |
| A surface no helper covers | `gridGeo`, the grid builder under `lathe` and `extrude` |
| Dial and other flat print | `mmCanvas`, `digits`, `letters`, `onCircle`, `arcLetters` in `site/watch3d/kit/type.js`; `planarUV` and `flatRing` in `site/watch3d/kit/geo.js` |
| Steel, lume, glass | `makeMaterials` |
| The loop | `solveLoop`, `widthAt`, `checkLoop` |
| Stage, camera, views, clock, presses | `mount` in `site/watch3d/kit/stage.js` |

### A new watch writes itself

Its dimensions, every profile and outline, the dial painter, its wording and emblems, the bracelet's numbers and row list, and its own notes.

### Plainly wanted by a second steel sports watch

These sit in the Navitimer folder, `site/watch3d/watches/navitimer/`, today. Each could move into the kit once it takes its sizes as arguments.

- **From `site/watch3d/watches/navitimer/bracelet.js`:** `rowsAt`, `relieve`, `linkProfile`, `rod`, the brick layout in `segmentGeometry`, `pose`, `claspPath`, `strip`, and the two extra checks (end link wider than the lug gap, pin inside the case). Together they are most of "a link bracelet from a list of rows".
- **From `site/watch3d/watches/navitimer/case.js`:** the toothed-edge recipe in `bezel` (a `lathe` with `mod` and `shade`, taking a count and a tooth shape), the fluted `crown`, the two-shell `crystal`.
- **From `site/watch3d/watches/navitimer/hands.js`:** `boss`, `turn`, `step`, and `sword` as one of several hand outlines.
- **From `site/watch3d/watches/navitimer/dial.js`:** `canvasTexture` and the pattern of one painter run with two palettes.
- **From `site/watch3d/watches/navitimer/dims.js`:** the pattern, not the numbers: one function for the lug's top curve, read by both the lug and the end link.
- **New, not in either place:** a flank surface with true normals, for polished case sides.

## 6. The GMT-Master II

None of this is built or tested. Dimensions I give from memory are marked; research decides.

From memory, to be confirmed: 40 mm case, 20 mm between the lugs, about 12 mm thick, about 48 mm lug to lug, bracelet tapering from 20 to 16 mm, a movement at 28,800 beats an hour (so `BEAT = 8` again), a bezel that clicks in 24 steps.

### Case and crown guards

- **This case is not a round band with lugs attached.** Seen from above it is one smooth outline: each flank runs in a single polished curve from the 12 o'clock lug tip to the 6 o'clock lug tip, and on the crown side that curve swells into the two guards. Build it that way.
- **Suggested construction.** A round `lathe` body under the bezel, plus a left and a right rail. Each rail is one `extrude` of the side silhouette from tip to tip, with its inner edge at the lug's inner face and its outer edge following the plan outline. The rail's skin gives the brushed top.
- **Do not use the extrusion's cap for the polished flank.** Its normals are flat (section 3). Build the flank as its own strip with `gridGeo`: positions along the plan outline, from the underside to the top edge, so the normals turn with the outline. Add a slight bow in height, 0.1 to 0.2 mm, so the reflection also varies up and down. The tall strips in the studio should then appear as bright bands that slide along the flank as the watch turns.
- **Crown guards belong to the flank's outline**, so the surface flows into them with no seam. Their tops fall away toward the tips, which a single side silhouette cannot give; expect a separate top surface for the guards. Leave real air round the crown, 0.15 mm or more.
- **The edge between brushed top and polished flank is sharp** on the modern case, as far as I remember: no polished chamfer. Confirm.
- **Lug tops brushed along the length of the watch.** Set the UVs so U runs along Y and check the direction on a picture.

### Ceramic bezel insert

- **Material.** Gloss ceramic is not metal. Start from metalness 0, a deep colour, roughness about 0.1, and a high index of refraction (near 2.1; three.js allows up to 2.333) so it reflects more than lacquer. These are starting guesses for the bench.
- **Give the insert its real slope.** If it is modelled dead flat, the whole ring reflects one direction, shows one even tone and reads as matte plastic. A few degrees of cone makes the reflection change round the ring. Research the angle.
- **Two colours.** Paint both on one canvas so the boundary is a crisp line. The kit design gives red for the day hours, 6 to 18, and blue for the night hours, with the triangle at 24. With 24 at the top, that puts red on the lower half of the ring and blue on the upper half, and the triangle in the blue. As I remember it, the two boundaries pass through the numerals 6 and 18, at 3 and 9 o'clock. Confirm against a photograph.
- **Sunk numerals.** Paint them with the same painter run twice, as the dial does: pale grey colour, higher roughness, and a bump map that sinks them. At this size a bump map reads as engraved in all six views; real depth would show only in a macro. Use `onCircle` and `digits`, or a drawn alphabet if the real numerals differ too much.
- **Which marks sit at the odd hours** (dots or bars) is a research item.
- **Texture budget.** A 4096 canvas across 40 mm is 102 pixels per millimetre, nearly the Navitimer's dial resolution. The dial and the bezel insert are concentric and do not overlap, so one canvas could carry both. Untested.
- **Grip edge.** The Navitimer's bead recipe with a different tooth shape. Count the teeth on half a photograph and double it.
- **Turning.** The mesh turns in steps of 15°. A `press` entry can do this; otherwise leave it fixed and say so in the notes.

### Flat crystal and date magnifier

- **A flat crystal reflects one direction across its whole face.** From most angles that is nothing, so the glass vanishes; from one angle it is a veil over everything. The domed Navitimer never had this problem.
- **Make the edge do the work.** A real polished chamfer round the crystal's rim catches a line of light and says "glass" in every view. Keep the face's reflection at or below the Navitimer's 0.2.
- **By my arithmetic, in the Hero view the flat face reflects the dim lower edge of the studio's front wall**, so expect it to show almost nothing there. Check that the Hero view still reads as glazed.
- **Magnifier.** Model the lens as a real low dome on the crystal. Glass in this kit does not bend light, so the larger date is a trick. One way: a small plate just under the lens, drawn with the enlarged date on its pale ground and a soft dark edge, drawn before the crystal. `tick` receives the camera, so the plate can fade as the view turns side-on and never show as a floating label.
- **The date must read larger** in the Front and Hero views. The frozen clock uses today's date, so shots taken on different days differ in the window.

### Gloss black dial

- **Black lacquer is a dark mirror.** Start from a near-black colour (not pure black), low roughness and a full clearcoat. In the Front view it should be very dark but not dead: a soft reflection that moves as the watch turns.
- **Shadows do not show on black.** The Navitimer's dial got its depth from shadows under the hands. Here depth has to come from the polished sides of the applied markers and hands catching light, so those need real height and real bevels.
- **Lume on black clips easily.** Use an off-white and check it is not pure white in the Front view.
- **Markers.** Solid surrounds with a lume fill 0.02 mm or more above the metal. From memory: a triangle at 12, bars at 6 and 9, dots elsewhere, none at 3 where the date is.
- **The engraved ring between dial and crystal** is a cone from `lathe` in `M.rehaut` with lettering from `arcLetters`. Check at zoom that it reads the right way round.
- **Wordmark.** The kit has Jost only. The real wordmark is a serif. Either draw the letters as outlines or record the difference in the notes.

### Hands

- **Mercedes hour hand.** `bevelPlate` takes one outline with no holes. Build the metal as a solid outline including the circle, and lay the lume on top as separate thin pieces: three sectors in the circle, the stem, the tip. Not inlaid, but it reads the same from the front.
- **Four hands need four heights.** I believe the order from the dial up is hour, 24-hour, minute, seconds; a side-on macro photograph settles it. Keep 0.1 mm between hands and check the top of the stack clears the crystal by 0.2 mm or more (my margin, not a measured figure). The flat crystal leaves less room than a dome.
- **24-hour hand.** One turn a day: angle = (UTC hours + minutes / 60 + seconds / 3600) × 15°, clockwise from 12.
- **The frozen clock pins local time**, so the 24-hour hand's angle in a shot depends on the machine's time zone. For comparable shots take both builders' pictures on one machine, or set the time zone to UTC for the run, which puts the hand at 152.1° at 10:08:30. I have not tested setting it.

### Solid case back

- A `lathe` with a fluted edge by `mod`, as for the crown, and a brushed centre. Built facing +Z inside a group turned about Y, as the Navitimer's.
- I believe the modern back is plain, with no wording. Confirm, and invent none.

### Jubilee bracelet

- **Same structure, new numbers.** Five rows laid like bricks: I believe the two outer links share one set of pins and the three centre links are offset by half a link. Which rows share a phase is a research item; settle it from a photograph before any geometry.
- **These links are domed, not flat.** The centre links are small polished beads, rounded along their length and across their width. In `linkProfile` terms that is a corner radius near half the link's length; in `extrude` terms a large `crown`. The outer links are brushed and rounded along their length.
- **Polished beads will show the dark-reflection problem** the Navitimer's narrow rows have, but strongly domed faces sample more of the room, so they should fare better. Check the Bracelet view.
- **Shorter links.** The pitch is shorter than the Navitimer's 3.0 per pin only if research says so; I do not know it. Count links against the 20 mm lug width in a square-on photograph.
- **Taper.** 20 to 16 mm is 20 per cent. Find out whether all rows narrow or only the outer ones; `rowsAt` narrows all in proportion.
- **End links.** Fitted, following the case's curve under the bezel, with the centre rows carried into the end link's top as on the real one.

### Folding clasp

- **Build it once, across the seam.** `buildBracelet` makes two mirrored halves, each with half a clasp. This clasp is not symmetric: a hinge at one end, a safety catch at the other. Let each half stop at its last link and place one clasp at the seam.
- **Set `head` from the cover's real length.** The cover is rigid and long, so the loop needs a longer straight run than the Navitimer's 7.6 per half. Re-run `checkLoop`; a longer straight run forces sharper bends elsewhere.
- **Layers.** A brushed cover with polished chamfers, two folding blades beneath that curve with the wrist, a hinge barrel, the safety catch standing proud with its emblem. In the Side view the stack should be 3 mm or more; that figure is my estimate.

## 7. Review checklists

I will use these lists at each review point, for both builders alike. Each item passes or fails on the evidence named. "Blocks" means the builder should fix it before going on; the others are fixed by the next point.

For fair comparison, shots are taken at 1440 by 900 with `?time=10:08:30`, on the same machine, the same day and the same renderer.

### Who supplies the evidence

At `e364ee2` some of this evidence could not be produced from the page. With kit commits `b7f5e2a`, `5e71a2b` and `5a0e3d9`, and the scripts in `tools/` (section 2), all of it can except the frame rate. This is who supplies each kind, and how.

| Evidence | Who | How |
|---|---|---|
| The six views | Builder | `tools/watch3d-shots.sh`, with the renderer it printed |
| Console and network log | Builder | The same run: the shot tool prints them for each view. It fails on errors, failed requests and (since the second kit review, unless `--allow-warnings`) console warnings. For one address, `tools/watch3d-console.mjs`, which fails on warnings too |
| Loop check output | Builder | `node tools/watch3d-loopcheck.mjs <worktree> <watch-folder>`, which needs the exports named in section 2. I run it again at the commit under review |
| Triangle, draw-call, geometry and texture counts | Builder | The `report:` line the shot tool prints for each view |
| Frame rate | Nobody, until the GPU can be used again | Marked "not checked". A frame rate on the software renderer does not count |
| Close-ups of a set view | Reviewer | `tools/watch3d-closeup.mjs` with `SCALE=2 CLIP=canvas` |
| "Two shots 10° apart" | Reviewer | `tools/watch3d-closeup.mjs` with a view and the same view turned, such as `bracelet bracelet~10,0` |
| Close-ups from any other position (from above, from below, glancing) | Reviewer | `?cam=` in the address, shot with either tool. Where a position cannot be reached I mark the item "not checked" and say so; I do not pass it |
| Pixel measurements | Reviewer | `tools/watch3d-measure.mjs` on the Front and Side shots |
| The code | Reviewer | Read at the commit under review |

Most thresholds in the lists are my own choices, not measured limits: 3 per cent on proportions, 0.2 mm under the crystal, "larger than a lug". Two are the design's: the lettering test in 3.7 and 3.14, and the 30 frames a second in 4.12.

Full screen is a later step of the design. It was not in the kit at `e364ee2`, and I found none at `c270c0f`. Items 3.7 and 4.12 depend on it. Until it lands, 3.7 uses the stand-in named in its row and 4.12 is marked "not checked".

### Point 1: research and plan (no page yet)

| # | Pass when | Evidence | Blocks |
|---|---|---|---|
| 1.1 | The reference is named exactly (126710BLRO on Jubilee) and each source is listed with what it supplied | The plan | Yes |
| 1.2 | A dimension table exists in which every number has a source or is marked as an estimate. It covers: case diameter, thickness, lug to lug, lug gap; bezel outer diameter, insert inner and outer radius, insert slope; crystal diameter and height above the bezel; dial opening; crown diameter and length; crown guard reach | The plan or a draft `dims.js` | Yes |
| 1.3 | The bracelet's numbers are all present: width at lug and clasp, taper length, pitch, thickness, each row's width and finish, links per half, clasp length, width and thickness | The plan | Yes |
| 1.4 | The bracelet numbers pass `checkLoop` with no failures, and seam, largest bend and pin count are quoted | Output of `tools/watch3d-loopcheck.mjs`, in the plan. With no builder yet, a run with `WRITTEN_ONLY=1` is accepted, at this point only | Yes |
| 1.5 | Which rows share a pin phase is stated, with the photograph that shows it | The plan | Yes |
| 1.6 | Every visible surface is listed with its finish, and brushed ones with their grain direction | The plan | Yes |
| 1.7 | All wording on dial, ring, bezel, crown, clasp and back is listed as on the real watch; emblems are the builder's own drawings; nothing is invented | The plan | Yes |
| 1.8 | Behaviour is defined: hand angles at 10:08:30 including the 24-hour hand's formula, the date, and whether the bezel turns | The plan | Yes |
| 1.9 | Counts are given with the method used: bezel teeth, crown flutes, case-back flutes, bezel numerals and marks | The plan | No |
| 1.10 | Colours are given as values with a reason, and the bezel's colour boundary is placed | The plan | No |
| 1.11 | The build order puts bracelet, end links and clasp before dial detail | The plan | No |
| 1.12 | The plan says what goes into the kit and what stays with the watch, and lists what could not be confirmed | The plan | No |
| 1.13 | No downloaded mesh and no photograph is planned as geometry or texture | The plan | Yes |

### Point 2: the head

| # | Pass when | Evidence | Blocks |
|---|---|---|---|
| 2.1 | The page loads from a plain static server with no console error, warning or failed request, and opening the GMT fetches nothing from `watches/navitimer/` | Console and network log | Yes |
| 2.2 | Proportions match the dimension table within 3 per cent: case diameter to lug gap, and thickness to diameter | Pixel measurements in Front and Side | Yes |
| 2.3 | Steel shows at least three tones on every part; no area larger than a lug is pure black or pure white | All six views | Yes |
| 2.4 | Lug tops read as brushed with the researched grain direction, flanks as polished | Hero, and two shots 10° apart: the flank's reflection moves, the top's hardly does | Yes |
| 2.5 | The flank is one continuous surface from lug tip to lug tip, with no crease or seam at the guards and no flat even tone | Hero and Side; the flank's code has true normals | Yes |
| 2.6 | Crown guards flank the crown with visible air and no intersection | Close-up of the crown from the front and from above | Yes |
| 2.7 | The bezel insert reads as gloss: sharp reflections that differ round the ring | Hero and Front | Yes |
| 2.8 | Bezel colours meet at the researched positions; the numerals are the right set, upright as on the real watch, pale and visibly sunk; the triangle is at the top | Front, and a close-up | Yes |
| 2.9 | The grip edge has the researched tooth count, with separate teeth and dark valleys | Glancing close-up; the count in code | No |
| 2.10 | The crystal reads as glass in the Hero view and lays no veil over the dial in the Front view | Hero and Front | Yes |
| 2.11 | The magnifier stands proud of the crystal at 3 o'clock | Side close-up | No |
| 2.12 | The crown has the researched flute count and an emblem that is the builder's own drawing | Close-up | No |
| 2.13 | The case back is solid, with its fluted edge, and any text is not mirrored | Back view | Yes |
| 2.14 | No shimmer and no parts that only touch: meeting parts overlap, stacked faces are offset | Two shots at slightly different distances; the code | Yes |
| 2.15 | Shadows seat the bezel on the case with no speckle and no detached shadow | Hero close-up | No |
| 2.16 | If the kit was changed, the Navitimer's six views still match its baseline | `tools/watch3d-compare.py` output | Yes |
| 2.17 | Anything added to the kit takes its sizes as arguments and carries no maker's or model's words | The code | No |

### Point 3: dial and hands

| # | Pass when | Evidence | Blocks |
|---|---|---|---|
| 3.1 | At 10:08:30 the hour hand is at 304.25°, the minute hand at 51°, the seconds hand at 180°, and the 24-hour hand at the angle its formula gives for the machine's time zone | Front view; the code | Yes |
| 3.2 | With the clock live, the hands match the system clock and the seconds hand moves in eighths of a second | A live shot beside the clock; the code | Yes |
| 3.3 | No hand passes through another hand, a marker or the crystal; the top of the stack clears the crystal by 0.2 mm or more | Side close-up through the crystal; heights in code | Yes |
| 3.4 | The hour hand has the three-part circle, the minute hand reaches the minute track, the seconds hand has its disc, the 24-hour hand is red with a triangular tip | Front close-up | Yes |
| 3.5 | The dial reads as gloss black: very dark in the Front view, with a soft reflection that moves between two shots 10° apart | Front and Hero | Yes |
| 3.6 | Markers are solid with metal surrounds and lume, in the researched shapes and places; the lume is not pure white | Hero close-up | Yes |
| 3.7 | The maker's name, model name and bezel numerals read cleanly in the Front view at full screen on a 1440 by 900 window, which is the design's test. The small lines of dial wording read once the reader zooms in | Front view at full screen. The kit has no full screen at `e364ee2`. Until it has, I use the masthead canvas of the Front view at device scale 2 (section 2). There the Navitimer's head is 467 pixels across. At full screen in a 900-pixel-high window I estimate about 525, from the stage's code: the camera distance does not change with a wider canvas, so size goes with canvas height. I have not measured it. The stand-in is therefore about a ninth smaller than the design's test, so lettering that reads in it passes, and lettering that does not is "not checked", not failed. The small lines need a `?cam=` close-up, or that half is "not checked" | Yes |
| 3.8 | All wording matches the list from point 1, and no text is mirrored or upside down, including the ring between dial and crystal | Close-ups | Yes |
| 3.9 | The date shows today's date and reads larger under the magnifier in the Front and Hero views | Front and Hero | Yes |
| 3.10 | The date window has depth, and the trick behind the magnifier does not show as a floating label in the Side view | Side and Hero close-ups | No |
| 3.11 | The minute track has 60 marks, evenly spaced | Front close-up | No |
| 3.12 | Chromium and Firefox show the same lettering, so no fallback font was used | The Front view in both | No |
| 3.13 | Textures stay within 4096 for colour and 2048 for surface maps | The code | No |
| 3.14 | In the 400-pixel masthead the bezel numerals and the hour markers still read; smaller wording need not | The Front shot from the tool at scale 1, which shows the masthead. The Navitimer's head is about 234 pixels across there | No |

### Point 4: bracelet, end links, clasp and the whole watch

| # | Pass when | Evidence | Blocks |
|---|---|---|---|
| 4.1 | `checkLoop` returns no failures for the numbers the page builds with, the seam is within 0.01 mm and no joint bends more than 24° | Output of `tools/watch3d-loopcheck.mjs` ending in a plain `PASS`, which means the watch's own builder ran; a pass on the written figures only does not count. No bracelet warning in the console or in the report | Yes |
| 4.2 | Links are separate objects posed from the solved pins, and their count matches the plan | The code | Yes |
| 4.3 | There are five rows in the researched phase, and no page colour shows between rows or through joints | Bracelet and Clasp views, and one close-up | Yes |
| 4.4 | The bracelet narrows from the researched lug width to the researched clasp width, as a smooth edge, and the narrowing is visible | The report; the Bracelet view | Yes |
| 4.5 | Outer rows read as brushed along the length, centre rows as polished and domed; no row is an even black or white along its length | Bracelet view, two shots 10° apart | Yes |
| 4.6 | End links fill the space between the lugs, follow the case under the bezel, sit at or just below the lug tops, and the first links hinge from them | Front, and close-ups from above and below | Yes |
| 4.7 | Nothing in the bracelet passes through the case, the case back or the lugs | Side and Back; the pin check in the report | Yes |
| 4.8 | The clasp shows links entering through knuckles at both ends, a cover with a chamfer, a catch, and in the Side view at least two layers and a hinge | Clasp and Side | Yes |
| 4.9 | The clasp follows the loop with no step at either end and its wording matches point 1 | Clasp close-up | No |
| 4.10 | The loop is closed and wrist-shaped, with the head level | Side | Yes |
| 4.11 | All six views pass their purpose as listed in section 2 | The six shots | Yes |
| 4.12 | At full screen on this machine's GPU the page holds 30 frames a second or better, which is the design's floor; below it the builder lowers the pixel density in full screen only. Triangle and draw-call counts are reported. For comparison, my Navitimer lab page ran at 60 at 1280 by 800. On this machine a GPU figure needs a restart first; a software figure does not count, and the item is then "not checked" | Measured figures, with the renderer and window size named | No |
| 4.13 | Switching between the two watches five times leaves one canvas, and geometry and texture counts return to the same figures | Measured figures | Yes |
| 4.14 | Chromium and Firefox both load cleanly and match in at least the Hero and Back views | Shots from both | No |
| 4.15 | The Navitimer's six views still match its baseline | `tools/watch3d-compare.py` output | Yes |
| 4.16 | The notes list what was modelled, what was simplified, what is unsure, any change to light with its reason, and what was not tested | The notes | Yes |

## What I never tested

- Safari, and any real phone.
- Clicking or dragging in Firefox.
- The site page and the kit split as they now stand, beyond what the opening lists.
- The checking scripts in GPU mode, beyond seeing them fail and say why. The GPU has been unusable here since before they were written.
- The checking scripts with any browser but Chromium 158, on any machine but this Linux one, or on any watch but the Navitimer. The loop check's fallback route ran only on a cut-down copy of the Navitimer's figures.
- The browser tools with the system's default temporary folder. Every run here set a long one in a scratch folder. That is how I found that Chromium stops with "Socket path too long" when the folder's path is long; the tools now work around it. The kit's shot tool makes its profile with `mktemp -d` and has no such guard, so it should stop the same way under a long `TMPDIR`. I have not tried that.
- The kit's shot tool stopping on a failed bracelet check. I read that it should and did not make one fail on the page.
- `about.light`, which I have only read.
- Anything on the GPU since the driver update of 26 November 2026. The frame rate and the GPU pictures date from before it.
- The key lamp on its own, or any change of lamp direction. I scaled all three lamps together.
- Any tone mapping other than Neutral.
- On the site page, any `?cam=` position but one (the crown), and any turn by dragging but 10° to either side of the Front view.
- The stage's handling of a watch that throws, and a watch's own `dispose()`. Both arrived in the kit after `480a2a2`; I read them only. A watch that keeps anything on the graphics card outside its `group` must release it there; the comment above `mount` in `site/watch3d/kit/stage.js` lists what counts.
- Everything in section 6.
