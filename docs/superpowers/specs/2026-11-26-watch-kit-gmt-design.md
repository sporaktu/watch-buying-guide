# A reusable 3D watch kit, and the GMT-Master II as its second watch

Date: 2026-11-26. Status: awaiting the owner's approval.

## Intent

The guide's masthead can swap its flat watch face for a 3D watch the reader can turn (Full watch mode, pull request 30). There is one such watch: a Breitling Navitimer, built in code by one Fable agent in about 1 hour 45 minutes (worktree made 19:12, last commit 20:56 on 2026-11-25) and 2,655 lines.

The owner wants that same treatment for many famous watches, and wants each one to cost less than the first. In the owner's words: "the rotatable 3d model is what I want to replicate for many famous watches" and "this should be a reusable kit". The second watch is the modern Rolex GMT-Master II "Pepsi".

While this design was being written the owner added: "I also want to full screen it on all device sizes". That is part of this work too.

So this work has two products of equal weight: a second watch at the Navitimer's standard, and a kit plus a written guide that the builder of the third watch starts from.

## Goals

1. `site/watch3d/` is split into a shared kit and one folder per watch.
2. The Navitimer looks the same after the split as before it.
3. A GMT-Master II, ref. 126710BLRO on the Jubilee bracelet, modelled to the Navitimer's standard: case, bezel, crystal, dial, hands, crown, case back, bracelet and clasp, turning in the masthead.
4. On the site, Full watch opens the model that belongs to the face being shown, and a link can open either watch.
5. The 3D watch can be made to fill the screen, on a phone, a tablet and a desktop, whichever watch is showing.
6. A guide for the builder of the next watch, and a measured answer to "how much less did the second watch cost?".

## Non-goals

- A general builder that turns a data file into a watch. Watches stay hand-written code that calls the kit. (The owner turned down the data-driven route: it gives flatter, less particular watches.)
- A third watch.
- Any change to the 43 flat faces. The flat "Two-tone GMT" face stays the 1954 design; the 3D watch is the modern one. The owner knows they differ, as the Navitimer's flat and 3D versions already do.
- Lowering the Navitimer's graphics-memory use (about 85 MB by a reviewer's estimate).
- A build step, a new dependency, or a change to the page's content-security policy.

## Anti-goals

The work has failed, even if it runs, if:

- the Navitimer looks different from how it looks on the live site today;
- anything under `site/watch3d/` is fetched before the reader presses Full watch or arrives by a `?full=1` link;
- the GMT is plainly a weaker model than the Navitimer (flat-looking steel, a bracelet that reads as stripes, lettering too coarse to read in the dial view);
- two watches' geometry and textures are held on the graphics card at once, or the feature holds more than one WebGL context;
- the kit is abstract for its own sake: options no watch uses, or a part made so general that a builder has to fight it to make one particular watch.

## Constraints

- The site is static files under `site/`, deployed to GitHub Pages on a push to `main`. No build step. three.js r187 is vendored in `site/watch3d/vendor/` and stays the only library.
- The content-security policy (`site/index.html` line 9) allows scripts, styles, images and fonts from the site itself only and no network connections. Module code is loaded by `import()` from the deferred classic script `site/watch3d.js`. Fonts must be self-hosted files with a free licence (Jost is already in `site/fonts/`).
- No downloaded meshes and no photographs. Geometry is made in code and textures are drawn on canvases at load, as in the Navitimer.
- Lettering: the owner decided for the Navitimer that the watch keeps its maker's and model's names on the dial and case back. The same holds here. Emblems (the Rolex coronet) are the builder's own drawing, not a traced logo, as the Navitimer's wings are.
- Units are millimetres; the dial faces +Z, 12 o'clock is +Y, 3 o'clock is +X; z = 0 is the underside of the mid-case.
- A user-visible change needs a release note in `site/releases.js` (the next id is 31: full screen takes 31 and the GMT 32) and the README kept true.

## Approaches

Three ways to get a second watch were considered.

**A. A kit used as a library; each watch is its own code (chosen).** Shared modules hold everything that is not about one watch: materials, lighting, glass, shape tools, lettering tools, the bracelet-loop solver, the stage (renderer, camera, views, dragging, failure handling) and, as watches turn out to share them, part makers that take numbers (a turned case band, lugs from a profile, a fluted crown, a link bracelet from a list of rows, hand shapes). A watch is a folder of code that calls these with its own dimensions and writes by hand whatever is peculiar to it. It keeps the hand-built quality, a fix to the steel or the lighting reaches every watch, and each watch adds to what the next can reuse. Its cost is the discipline of deciding what belongs in the kit.

**B. One general builder driven by a data file per watch.** Cheapest per watch once it exists, but every watch is limited to what the builder's options can express, which is exactly the flatness the owner wants to get away from. Rejected.

**C. Copy the Navitimer's folder for each watch and rewrite it.** No design work, but nothing is shared: a fix has to be made in every copy, the download grows by a whole model each time, and the tenth watch costs what the second did. Rejected: it is not a kit.

The owner asked for a reusable kit and left how to me; A is my pick.

## The design

### Layout

```
site/watch3d/
  vendor/                  three.js and its two add-ons, where they are now
  kit/                     nothing in here names a watch
    stage.js               today's mount.js: renderer, lights, camera, views, pointer handling, frame loop, dispose
    materials.js env.js geo.js type.js loop.js
    ...                    part makers, as they become shared
  watches/
    navitimer/             index.js (today's watch.js), dims.js, case.js, dial.js, hands.js, back.js, bracelet.js
    gmt-master-ii/         the same shape
```

### What a watch is, to the kit

Each `watches/<id>/index.js` exports two things. The exact names and shapes are the builder's to settle; this is what they must carry.

- **About the watch:** its id, the sentence a screen reader is given for the canvas, the caption and hint shown under it in Full watch mode, and any camera views that differ from the kit's six (three-quarter, front, side, case back, clasp, bracelet).
- **A build function:** given the shared materials and the renderer, it returns the watch as one group, a `tick(date, dt, camera)` that moves its hands, and a list of parts the reader can press, each with what pressing does. The Navitimer's two pushers become two entries in that list; the stage's pusher code becomes code for "pressable parts" and stops knowing what a pusher is.

The stage must contain no watch's name, dimensions or behaviour. Its handle keeps what `site/watch3d.js` uses today (canvas, views, setView, start, stop, running, dispose) and gains a way to show a different watch on the same renderer.

### Three steps, three pull requests

**Step 1: the split. No visible change.** A mechanical move by an Opus builder (the owner's standing preference for work that is not 3D modelling).

- Files move into `kit/` and `watches/navitimer/` and their imports are fixed.
- Numbers and colours that are the Navitimer's leave the shared files: the bracelet's dimensions in `loop.js` become an argument to the solver, and the dial's blue and cream leave `materials.js`. Steel, rhodium, lume, glass and the brushed grain stay shared.
- `mount.js` becomes `kit/stage.js` and takes the watch to show.
- `site/watch3d.js` gets a table from face name to watch id, with one row.
- `site/watch3d.js` passes the page's existing `?time=HH:MM:SS` on to the stage, which already accepts a frozen time, so screenshots can be compared.
- **The check that matters:** screenshots of all six views at a frozen time, at the same size, taken before and after, are compared pixel by pixel. They must match, apart from differences small enough to be the graphics card's own noise (the builder reports the count and the largest difference; I look at any view that differs).
- No release note, as a reader sees nothing new. The README's description of the files is corrected.

**Step 2: full screen.** An Opus builder, on a branch cut from `main` after step 1 is merged. Described under "Full screen" below. It comes before the GMT because it belongs to the stage, which every watch shares, and the owner gets it for the Navitimer straight away.

**Step 3: the GMT-Master II.** A Fable agent started through Orca in its own workspace, as the Navitimer's was, on a branch cut from `main` after step 2 is merged.

- **Research first.** The repo has no part-by-part file for this reference (`research/dial-finishes/design-26.json` is the 1954 ref. 6542). The agent writes `research/watch3d/gmt-master-ii-126710blro.md`: each dimension and finish with its source and how sure it is, in the manner of the dial-finish files, before modelling. This file is also the pattern for later watches.
- **Build** in `watches/gmt-master-ii/`, calling the kit.
- **Grow the kit** as described under "What goes in the kit".
- **Protect the Navitimer:** after any change to a kit file, the step 1 screenshot comparison is run again and must still pass.
- **Write the guide** (below) and its notes, including the cost measures.

### What goes in the kit

A part moves into `kit/` when it takes its sizes as arguments, carries no maker's or model's words, and either both watches use it or the next steel sports watch plainly will. Otherwise it stays in the watch's folder. Nothing is added to the kit on speculation.

The Navitimer is not rewritten onto new kit parts unless its screenshots stay the same. Where they would not, it keeps its own code and the guide says so.

What I expect the GMT to add to the kit (the builder decides): a gloss ceramic material; a flat crystal with a date magnifier; a bezel grip edge with a given number of teeth; a link bracelet described as a list of rows (width, finish, crowned or flat) so the seven-row and five-row bracelets come from one maker; a folding clasp with a cover; a solid screwed case back; hand shapes (Mercedes hour hand, lollipop seconds hand, an arrow 24-hour hand). What stays the GMT's own: its dimensions, the dial print, the bezel's numerals, the coronet, the crown guards.

### The GMT model

The reference is the Rolex GMT-Master II ref. 126710BLRO on the Jubilee bracelet. The list below is from my memory and is there to set the scope; the agent's research file is what the model follows, and where the two disagree the research wins.

- **Case:** steel, 40 mm, brushed lug tops, polished flanks, crown guards, a fluted screw-down crown with the coronet on its end.
- **Bezel:** turns both ways, with a gloss ceramic insert, red for the day hours (6 to 18) and blue for the night hours, engraved 24-hour numerals filled in a pale metal colour, a triangle at 24, and a toothed grip edge.
- **Crystal:** flat sapphire with a magnifier over the date at 3 o'clock. The kit's glass reflects but does not bend light, so the larger date is a trick of the builder's choosing; it must read as larger under the lens from the front and three-quarter views.
- **Dial:** gloss black; applied markers with white-metal surrounds and lume (triangle at 12, bars at 6 and 9, dots elsewhere); printed minute track and wording; the engraved ring between dial and crystal.
- **Hands:** Mercedes hour hand, minute hand, lollipop seconds hand, and a red 24-hour hand with a triangular tip.
- **Case back:** solid, screwed, with a fluted edge.
- **Bracelet:** five rows (brushed outer links, three narrow polished centre links), tapering, with fitted end links and a folding clasp with a cover, draped in a closed loop by the kit's solver.

Behaviour:

- The hour, minute and seconds hands show the reader's current time; the seconds hand moves in the small steps of the real movement.
- The 24-hour hand shows UTC against the bezel, so the watch does what a GMT watch is for.
- The date shows today's date.
- As the Navitimer's pushers work, something on the GMT should: pressing or dragging the bezel turns it in 24 steps. If that cannot be made to feel right alongside dragging to turn the watch, the bezel stays fixed and the notes say so.

### The site

`site/watch3d.js` holds a table from face name to watch: `Slide-rule chronograph` to `navitimer`, `Two-tone GMT` to `gmt-master-ii`.

- **Pressing Full watch on a face in the table** opens that face's watch.
- **Pressing it on any other face** does what it does today: the masthead switches to the Slide-rule chronograph and the Navitimer opens.
- **Choosing another face while the 3D watch is showing:** if the new face is in the table, the mode stays on and its watch replaces the one showing; if not, the mode ends, as today. (My call.)
- **Caption:** in the mode, the caption names the watch that is modelled, since the GMT's face caption names the 1954 watch. For the GMT: "After the Rolex GMT-Master II, ref. 126710BLRO." followed by its hint. The Navitimer's caption and hint stay as they are.
- **Address:** `?dial=two-tone-gmt&full=1`, with `&view=` as now, opens the GMT. `?full=1` alone still opens the Navitimer.
- **One watch at a time:** one canvas and one WebGL context for the feature. Showing a second watch frees the first one's geometry and textures. Going back builds it again; the files are already in the browser's cache. The "Building the watch" label shows while that happens.
- **Loading:** nothing under `site/watch3d/` before the first press. Opening one watch does not fetch the other watch's folder.
- Release note 32 and the README.

### Full screen

In Full watch mode a **Full screen** button sits with the view list. Pressing it makes the 3D watch fill the screen.

- **Two layers, so it works everywhere.** The base is the page's own doing: the stage is laid over the whole window (fixed, edge to edge, above everything, the page behind it not scrollable and not reachable by keyboard or screen reader). On top of that the browser's real full-screen mode is asked for, which also hides the browser's bars. Some browsers refuse that for anything but video (iPhone Safari, as far as I know; the builder confirms what it can); there the window-filling layer is what the reader gets, and it must be a complete result on its own, not a broken state.
- **What is on screen:** the watch on the page's own ground, the view list, a Close button, and the caption with its hint. Controls keep clear of a phone's notch and home bar (safe-area insets) and are big enough to touch.
- **Ways out:** the Close button, the Escape key, and the browser's own way of leaving full screen (which the page hears and follows). Leaving returns to the 3D watch in the masthead, the same watch in the same view, with the page scrolled where it was. Leaving Full watch mode altogether is still done from there.
- **Wheel:** in the masthead the wheel scrolls the page and does not zoom. In full screen there is no page to scroll, so the wheel zooms. Pinch zooms in both.
- **Size changes:** turning a phone or resizing the window refits the watch. The kit already stands the camera further back for a tall, narrow shape; the watch, bracelet included, must be whole on screen in each of the six views in portrait and landscape.
- **Speed:** a full-screen canvas on a large, dense display is many times the masthead's pixels. The builder measures frames a second at full screen on this machine and, if it falls under 30, lowers the canvas's pixel density in full screen only until it holds.
- **Not in the address.** A link cannot switch a browser into full screen (browsers require a press), so there is no address parameter for it. (My call.)
- **No history entry.** As with the rest of the masthead, nothing is added to the back button's history; on a phone Back leaves the page as it does today. (My call.)
- **Only the 3D watch.** The flat faces do not get a full-screen button. (My reading of the request.)
- It lives in the stage and `site/watch3d.js`, so it works for every watch with no code in a watch's folder.
- Release note 31 and the README.

### The guide for the next builder

`docs/watch3d-kit.md`, written by the step 3 agent and checked by me:

- how to add a watch: the folder, what its `index.js` must export, the one line in the site's table;
- each kit module in a line or two: what it makes and its arguments;
- the conventions (units, axes, heights, how brushed parts carry their grain);
- the research file to write first, with the GMT's as the example;
- how to check a watch: the frozen time, the six views, close-ups, the Navitimer comparison after any kit change, Firefox;
- what must not go in the kit;
- what each of the two watches cost (below), so the owner can price the next ones.

### Measuring what the kit saved

The step 3 agent records its start and finish times and, at the end, the lines it wrote in `watches/gmt-master-ii/`, the lines it added to or changed in `kit/`, and the lines of kit it used unchanged. Set against the Navitimer's 1 hour 45 minutes and 2,655 lines, that is the answer to the owner's question. Step 1's time is reported separately as the one-off cost of making the kit.

### Checks before either pull request is merged

- **Step 1:** the screenshot comparison; every check from pull request 30 still passes (no requests before the press, the three ways out, quick repeated presses, leaving while loading, resize, stopping off screen, a forced context loss, phone size 390 by 844, the address cases, the screen-reader messages).
- **Step 2:** full screen entered and left by each way out, at 390 by 844 portrait, 844 by 390 landscape, 820 by 1180 and 1440 by 900, with the six views whole on screen at each; the window-filling layer on its own, with the browser's full-screen call made to fail; focus goes to the Close button and comes back to the Full screen button; the page behind neither scrolls nor takes focus; the wheel zooms in full screen and scrolls the page out of it; frames a second at full screen; Chromium and Firefox. A real iPhone is not available here and that gap is reported, not hidden.
- **Step 3:** the GMT's six views and close-ups of dial, bezel, crown, clasp and bracelet, by eye against the research; Chromium and Firefox; switching between the two watches five times leaves one canvas and one context, and the renderer's counts of geometries and textures return to the same figures; opening the GMT fetches nothing from `watches/navitimer/`.
- An independent review by an Opus reviewer of each step, then my own look in the browser, then screenshots to the owner before the GMT is merged.

## Left to the builder

- Names and exact shapes of the kit's functions, the watch module's exports and the stage's handle.
- Which parts end up in the kit, within the rule above.
- The lettering face for the GMT (a free, self-hosted font, or Jost), and the drawing of the coronet.
- How the date is made to read larger under the magnifier.
- Whether the bezel turns, and how.
- The clasp's detail, and every dimension the research cannot settle (estimated from pictures and listed in the notes, as the Navitimer's were).

## My calls, for the owner to check

These were not asked of the owner; each can be changed.

1. Three pull requests: the split first with nothing visible, then full screen, then the GMT.
2. The split and full screen are done by Opus builders; the GMT by a Fable agent through Orca.
3. On a face with no 3D watch, Full watch still jumps to the Navitimer.
4. Changing face while in the mode keeps the mode on when the new face has a watch.
5. Only one watch is held on the graphics card at a time, so going back to a watch rebuilds it.
6. The GMT's 24-hour hand shows UTC.
7. The GMT keeps Rolex's wording on the dial, as the Navitimer keeps Breitling's.
8. Full screen: where a browser will not give real full screen, the watch fills the window instead; it is not in the address; it adds nothing to the back button; only the 3D watch gets it.
9. The guide lives at `docs/watch3d-kit.md` and each watch's research at `research/watch3d/`.
