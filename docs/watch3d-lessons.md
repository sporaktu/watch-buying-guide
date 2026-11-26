# Lessons from building the Navitimer in 3D

Written by the agent that built the Navitimer, for an agent about to build a second watch with the kit. Code references are to the kit as it stood at commit `d1d3572` on branch `sporaktu/watch-kit`. I cite a file and a function name, not line numbers, because the split is still moving.

How far to trust each part of this document:

- **The Navitimer itself.** I built it and looked at it in headless Chromium on a real GPU. Statements about it are tested unless I say otherwise.
- **The kit split and the site page.** Someone else carried my code into `site/watch3d/`. I read that code and compared it with mine, but I did not run it. The steel materials, the studio, the three lamps and the renderer settings have the same values as mine.
- **Section 6, the GMT.** Advice only. I have built none of it.
- **Browsers.** Chromium was tested fully. Firefox 160 loaded cleanly and two views matched, but I never clicked or dragged there. Safari and a real phone were never tested; the phone check was a narrow desktop window.

Conventions the kit assumes: units are millimetres, the dial faces +Z, 12 o'clock is +Y, 3 o'clock is +X, and z = 0 is the underside of the mid-case.

## Start here: the four faults to prevent

An earlier attempt at this brief without the kit produced a convincing head and four faults. Each has one cause.

| Fault | Cause | Prevention | How to check |
|---|---|---|---|
| Steel near black, or blown to white | Metal has no colour of its own. It shows only what it reflects. In an empty or dark environment polished steel is black. Raising lamps or exposure to fix that clips the flat brushed faces to white. | Use `M.polished`, `M.brushed` and `M.satin` from `makeMaterials` in `site/watch3d/kit/materials.js` unchanged, inside the kit's studio. Never brighten steel with lamps or exposure. See section 4. | In every view each steel part shows at least three tones (dark, middle, bright). No steel area larger than one link is pure black or pure white. |
| Bracelet rows are separate bands with daylight between | Rows built as independent ribbons with a visible gap, nothing crossing them. | Lay links like bricks so every pin crosses every row, put a rod through each pin across the full width, and keep the gap between rows at 0.07 mm. See `segmentGeometry` and `rod` in `site/watch3d/watches/navitimer/bracelet.js`. | In the Bracelet and Clasp views, no page colour shows between rows. A dark line that changes as the watch turns is a reflection; one that shows the page behind is a gap. |
| No visible taper | Constant width, or a taper too small or spread too thin to see. | Give `widthLug`, `widthClasp` and `taperLength` from research and let every link's sides follow `widthAt` in `site/watch3d/kit/loop.js`, so the edge is a smooth line and not steps. | `report.bracelet.widthAtLug` and `widthAtClasp` hold the researched figures, and the two edges visibly converge in the Bracelet view. |
| Clasp is a plate | One box stood in for a mechanism. | Build the parts a clasp has: knuckles round the last pins, a cover with a chamfer, the folding blades under it, a hinge barrel, a release or catch. Give the loop a straight run for it (`head` in the bracelet numbers). | The Clasp view shows links entering both ends through knuckles. The Side view shows at least two stacked layers and a hinge. |

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

For scale: the Navitimer took about 1 hour 45 minutes and 2,655 lines, and renders about 380,000 triangles in 303 draw calls at 60 frames a second at 1280 by 800.

## 2. How I checked the work

### The harness

My scripts are not in the repository. They drove headless Chromium through playwright-core against my lab page, and did five things the kit's `tools/watch3d-shots.sh` does not:

- printed console errors and warnings, page errors, failed requests and any response with status 400 or above;
- printed the WebGL renderer string, so I knew I was on the GPU and not a software renderer;
- printed the `report` object;
- took a shot from any camera position and target, not only the six set views;
- waited for a ready flag, then three animation frames and 250 ms, before each shot.

`tools/watch3d-shots.sh` takes the six set views at 1440 by 900 with the clock frozen at 10:08:30, and throws the browser's output away. `tools/watch3d-compare.py` then compares two folders of shots pixel by pixel. That covers "did the Navitimer change" well. It does not cover close-ups or console errors. Two gaps follow:

- **Nothing exposes `report`.** `mount` in `site/watch3d/kit/stage.js` does not hand it out. A failed bracelet check appears only as a `console.warn` from `buildBracelet`, and the shots tool discards console output. Until the stage exposes the report (the site's `?debug` handle in `site/dials.js` is a precedent), read the console yourself in every run.
- **No free camera.** Close-ups need one. Until the kit has it, zoom by hand or write a short script.

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

Close-ups I took while building, each from a free camera: the bezel edge at a glancing angle, the crown and pushers, the lug and end link from above and from below, three points along the bracelet, the clasp from the side, the dial at about three times the front view, and the date window.

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
- **Frame rate and size.** Triangles, draw calls and frames per second at 1280 by 800.

### Faults I found only by looking at a picture

No check caught any of these.

- **Polished rows were black voids.** The room was too dark. Fixed in the studio, not the material.
- **Flat brushed faces were blown to white.** Fixed with roughness, anisotropy and a grey sheen map together.
- **Polished hands were dark grey face-on.** They mirrored the dark front of the room. Fixed with a dim wall in front of the watch.
- **The crystal veiled the dial.** Its reflection strength came down from 0.34 to 0.2.
- **The brushing ran the wrong way.** I had derived the direction and the bench disagreed. Settle it by picture.
- **A missing file left a part untextured**, with nothing on the page to say so. Only the console showed the 404.
- **Shots taken straight after a window resize were framed wrongly.** The view fit read a stale aspect ratio.
- **The crown cut into the bezel teeth** until it started further out.
- **Polished link sides looked worse than brushed ones.** A flat mirror reflects one even grey.
- **Dark bars across the polished rows looked like gaps** and were reflections of the dark part of the room. See the test in the table at the top.

## 3. Part by part

Two rules apply to every part:

- **Parts that meet must overlap, by 0.2 mm or more.** Parts that only touch show a hairline of light.
- **Stacked layers need a real offset, never the same plane.** Print, lume and applied rings each sit 0.02 mm or more above what is under them. Faces in one plane shimmer.

### Case and lugs

- **What worked.** The mid-case is a `lathe` band of 240 segments in `M.brushed`, with separate narrow runs in `M.polished` for the chamfers (`midCase` in `site/watch3d/watches/navitimer/case.js`). Each lug is one `extrude` of a side profile, pushed across X between an inner and outer face that vary along the lug (`lugs`). The extrusion's skin (top, tip, underside) is one material and its end caps (the flanks) another, which gives polished tops and brushed flanks with a crisp edge between.
- **Numbers.** `caseR` 19.75 for a 41 mm watch, because the 41 mm is measured across the bezel, whose beads reach 20.5. Lug gap 22. Lug tips at y = ±23.3 for 46.6 mm lug to lug. Lug top height is `4.55 - 4.0 * t^1.5`, with t running from 0 at y = 13.5 to 1 at the tip.
- **Known weakness: flanks.** `extrude` gives every cap vertex the same sideways normal, even when the face curves in plan. A brushed flank hides this. A polished one would reflect as one flat mirror, an even pale grey. The Navitimer's flanks look pale and plain in the Side view for a related reason. A polished flank needs its own surface with true normals; see section 6.
- **Known weakness: lug tops** mirror one of the studio's black flags at some angles and go dark.
- **Dropped.** Cutting lugs out of a block. The kit has no boolean operations, and profiles plus extrusion were enough.

### Bezel

- **What worked.** The beaded edge is one `lathe` whose radius is swollen by a function of angle through the `mod` option, with `segs` set to 18 per bead (`bezel` in the same file). The `shade` option writes a darkening into the valleys as vertex colours, and `M.polishedAO` applies it. There is no ambient-occlusion pass, so without this the valleys are as bright as the tops and the beads merge into a ring.
- **Numbers.** 56 beads, counted as 28 on half of a photograph. Bead radius from 19.85 in the valley to 20.5 at the top.
- **Weakness.** The valleys between beads are sharp cusps. Real ones are softer.

### Crystal

- **What worked.** Two thin shells, an outer one in `M.crystal` and an inner one in `M.crystalInner`, drawn after everything else (`crystal` in the same file). Both only add reflected light over what is behind them. Neither casts nor receives shadows.
- **Dropped.** three.js transmission. Transparent objects are not drawn into the transmission pass, and it costs a second render of the scene. The additive shell looks like glass because the eye reads a crystal by its reflections.
- **Numbers.** Reflection strength 0.2. At 0.34 it laid a grey veil over the dial. The dome rises from 8.9 at the wall to 11.6 at the apex.
- **Read, not tested by me.** The site's canvas is transparent over the page, and the stage swaps the crystal's blending to suit. That was added in the port.

### Crown and pushers

- **What worked.** The crown is a `lathe` with a `mod` that cuts 24 flutes 0.3 mm deep and a `shade` that darkens them (`crown`). It is built along +Z and then turned to point along +X, which keeps the profile easy to think about. Each pusher is a collar, a stem of radius 1.12 and a cap of radius 1.72, turned to point outward along the case radius at ±30° (`pusher`).
- **Numbers.** Pusher travel 0.55 mm, eased. The crown starts 0.42 mm outside the case radius so it clears the bezel teeth.
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
- **Width.** It fills the 22 mm between the lugs, less the row gap each side.
- **Unsure.** The real end link's shape under the bezel. Mine is a guess that looks right from above.

### Taper

- **What worked.** `widthAt(s, spec)` gives the width at distance s along the bracelet, easing from `widthLug` to `widthClasp` over `taperLength` and constant after. `rowsAt` scales every row by the same factor. Each link's sides are slanted to follow `widthAt` along its own length, so the edge of the bracelet is one smooth line.
- **Numbers.** 22 to 18 mm over the first 44 mm of each half. That is 18 per cent, and it is clearly visible. The 18 mm is my estimate.

### Clasp

- **What worked.** Each half ends in three knuckles round its last pin, then a cover plate with its top 0.1 mm above the links, two release buttons on the sides, and, on the wrist side, a bridge strip, an arm strip and a hinge cylinder that follow the loop's curve (`claspHalf`, `claspPath`, `strip`).
- **What makes it read as a clasp.** Links visibly entering it through knuckles. A chamfer round the cover that catches a line of light. Depth in the Side view. Something that looks operable.
- **Weaknesses.** It is two mirrored halves that meet at the seam, so the bridge is drawn twice. It does not open. The engraving is a guess.

### The loop

- **What worked.** `solveLoop(spec, opts)` places pins at equal pitch along a curve whose heading turns steadily from `heading0` at the lug to straight back at the bottom, then finds by bisection the one extra bulge that lands the seam exactly on the centre line. The result is half a loop; the other half is the same turned half a turn about Z.
- **Numbers.** `heading0` is 40° below level, which is how a bracelet leaves a case on a wrist. `head` 7.6 is the straight run each half keeps for the clasp. `pin0` is where the first pin sits, under the lug.
- **Solve first, model second.** Change one number, run `checkLoop`, read `maxTurnDeg` and `seam`. Only when the failures list is empty is it worth drawing a link.

## 4. Steel and light

### Which light does what

- **The environment lights the steel.** A metal's look is almost entirely the studio reflected in it. `buildStudio` in `site/watch3d/kit/env.js` is a small room of bright panels on a dim gradient, baked into an environment map by `makeEnvironment`.
- **The three lamps do two other jobs.** They cast the shadows that seat the bezel on the case and the hands on the dial, and they light what is not metal: the dial, the print, the lume, and the dial's sunray brushing. Raising them hardly changes the steel.

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
- **Tone mapping** is Neutral at exposure 1.0. The hex colours I chose came out close to their values under it. I did not compare it against the other tone mappings in a picture.

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
| Key lamp up | Dial and pale parts brighten, shadows harden; steel barely changes |

The thresholds in that table are from my bench by eye, not measured.

### Telling brushed from polished in a screenshot

- **Polished** shows images: hard-edged bright shapes beside dark ones, high contrast inside one face.
- **Brushed** shows a soft streak stretched across the grain on a middle grey, never black, with fine lines visible up close.
- **Take two shots about 10° apart.** Polished reflections jump. Brushed faces hardly change.
- **A polished chamfer between two brushed faces** shows as a thin line, bright or dark.

### What a new watch may adjust

The kit design allows a watch to change the lamps' strength and direction, the exposure and the environment's strength, each listed in its notes with a reason. As I read the stage, that hook (`about.light`) is planned and not yet there.

- **May adjust:** lamp strength and direction, to suit a dial. A black dial needs less from the key lamp than a blue sunray one.
- **Should leave alone:** the steel materials, the tone mapping, the studio's panels and the environment strength of 1.0. If steel looks wrong, the cause is almost always the geometry (a flat face reflecting one thing) and not the light.
- **New materials** such as ceramic or lacquer are the new watch's to tune. Tune them on a bench of primitives first.

## 5. The kit: what to use, what to write

### Use these

| Need | Kit piece |
|---|---|
| Anything round: case band, bezel, crown, tubes, rings | `lathe` in `site/watch3d/kit/geo.js`. `mod` shapes the radius by angle (teeth, flutes), `shade` darkens valleys, `phi0` and `phiLen` make part of a circle |
| Anything with a constant side profile: lugs, links, end links | `extrude`. `x0` and `x1` let the width vary along the profile; `crown` domes the top across its width; `edge` rounds the side edges |
| Rounded outlines | `roundPoly`, `arc` |
| Flat plates with a bevel: hands, applied markers, frames | `bevelPlate`. It is flat shaded, which suits small faceted parts |
| A surface no helper covers | `gridGeo`, the grid builder under `lathe` and `extrude` |
| Dial and other flat print | `mmCanvas`, `digits`, `letters`, `onCircle`, `arcLetters` in `site/watch3d/kit/type.js`; `planarUV` and `flatRing` in `geo.js` |
| Steel, lume, glass | `makeMaterials` |
| The loop | `solveLoop`, `widthAt`, `checkLoop` |
| Stage, camera, views, clock, presses | `mount` in `site/watch3d/kit/stage.js` |

### A new watch writes itself

Its dimensions, every profile and outline, the dial painter, its wording and emblems, the bracelet's numbers and row list, and its own notes.

### Plainly wanted by a second steel sports watch

These sit in the Navitimer folder today. Each could move into the kit once it takes its sizes as arguments.

- **From `bracelet.js`:** `rowsAt`, `relieve`, `linkProfile`, `rod`, the brick layout in `segmentGeometry`, `pose`, `claspPath`, `strip`, and the two extra checks (end link wider than the lug gap, pin inside the case). Together they are most of "a link bracelet from a list of rows".
- **From `case.js`:** the toothed-edge recipe in `bezel` (a `lathe` with `mod` and `shade`, taking a count and a tooth shape), the fluted `crown`, the two-shell `crystal`.
- **From `hands.js`:** `boss`, `turn`, `step`, and `sword` as one of several hand outlines.
- **From `dial.js`:** `canvasTexture` and the pattern of one painter run with two palettes.
- **From `dims.js`:** the pattern, not the numbers: one function for the lug's top curve, read by both the lug and the end link.
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
- **Two colours.** Paint both on one canvas so the boundary is a crisp line. As I remember it, red runs from 6 to 18 (the lower half with the triangle at the top) and blue from 18 to 6, and the boundary passes through the numerals 6 and 18. Confirm.
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
- **Four hands need four heights.** I believe the order from the dial up is hour, 24-hour, minute, seconds; a side-on macro photograph settles it. Keep 0.1 mm between hands and check the top of the stack clears the crystal by 0.2 mm or more. The flat crystal leaves less room than a dome.
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

For fair comparison, shots are taken at 1440 by 900 with `?time=10:08:30`, on the same machine and the same day.

### Point 1: research and plan (no page yet)

| # | Pass when | Evidence | Blocks |
|---|---|---|---|
| 1.1 | The reference is named exactly (126710BLRO on Jubilee) and each source is listed with what it supplied | The plan | Yes |
| 1.2 | A dimension table exists in which every number has a source or is marked as an estimate. It covers: case diameter, thickness, lug to lug, lug gap; bezel outer diameter, insert inner and outer radius, insert slope; crystal diameter and height above the bezel; dial opening; crown diameter and length; crown guard reach | The plan or a draft `dims.js` | Yes |
| 1.3 | The bracelet's numbers are all present: width at lug and clasp, taper length, pitch, thickness, each row's width and finish, links per half, clasp length, width and thickness | The plan | Yes |
| 1.4 | The bracelet numbers pass `checkLoop` with no failures, and seam, largest bend and pin count are quoted | Printed output in the plan | Yes |
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
| 3.7 | The maker's name, model name and bezel numerals read cleanly in the Front view at 1440 by 900; small lines read after zooming | Front view | Yes |
| 3.8 | All wording matches the list from point 1, and no text is mirrored or upside down, including the ring between dial and crystal | Close-ups | Yes |
| 3.9 | The date shows today's date and reads larger under the magnifier in the Front and Hero views | Front and Hero | Yes |
| 3.10 | The date window has depth, and the trick behind the magnifier does not show as a floating label in the Side view | Side and Hero close-ups | No |
| 3.11 | The minute track has 60 marks, evenly spaced | Front close-up | No |
| 3.12 | Chromium and Firefox show the same lettering, so no fallback font was used | The Front view in both | No |
| 3.13 | Textures stay within 4096 for colour and 2048 for surface maps | The code | No |

### Point 4: bracelet, end links, clasp and the whole watch

| # | Pass when | Evidence | Blocks |
|---|---|---|---|
| 4.1 | `report.bracelet.failures` is empty, the seam is within 0.01 mm and no joint bends more than 24° | The report or console | Yes |
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
| 4.12 | The page holds 50 frames a second or better at 1280 by 800 on a GPU, and triangle and draw-call counts are reported | Measured figures | No |
| 4.13 | Switching between the two watches five times leaves one canvas, and geometry and texture counts return to the same figures | Measured figures | Yes |
| 4.14 | Chromium and Firefox both load cleanly and match in at least the Hero and Back views | Shots from both | No |
| 4.15 | The Navitimer's six views still match its baseline | `tools/watch3d-compare.py` output | Yes |
| 4.16 | The notes list what was modelled, what was simplified, what is unsure, any change to light with its reason, and what was not tested | The notes | Yes |

## What I never tested

- Safari, and any real phone.
- Clicking or dragging in Firefox.
- The site page and the kit split as they now stand; I read them only.
- Any tone mapping other than Neutral.
- Everything in section 6.
