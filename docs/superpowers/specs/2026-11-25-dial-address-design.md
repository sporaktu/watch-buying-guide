# The address names the watch face and the 3D watch

Approved by the owner on 2026-11-25 ("address bar should change as you click around").

## What it is for

A link that opens the guide on one particular masthead watch face, or straight into the 3D watch, so a face can be shared or bookmarked. The address bar follows what the reader is looking at, so the link never has to be written by hand.

## Today

- `site/dials.js` reads `?dial=N`, where N is the face's position in the list (1 to 43). New faces go at the top of the list, so every position moves when one is added and a numbered link later points at a different face.
- Nothing in the address opens the 3D watch (`site/watch3d.js`).
- No script writes to the address.

## Design

Three parameters in the query string:

| Parameter | Values | Meaning |
|---|---|---|
| `dial` | a face's name as a slug (`panda-chronograph`), or a number | which face shows |
| `full` | `1` | the 3D watch is showing |
| `view` | `front`, `side`, `back`, `clasp`, `bracelet` | which view of the 3D watch; left out for the three-quarter view |

**The slug** is the face's name in lower case with accents and apostrophes removed and every other run of characters that are not letters or digits turned into one hyphen: `Pilot’s watch, type A` is `pilots-watch-type-a`, `Glashütte numerals` is `glashutte-numerals`. It is worked out from the name, not stored, so a new face needs nothing extra. Slugs are compared after both sides are slugged, so `?dial=Panda%20Chronograph` also works.

**Reading, on load.** A face named in the address wins over the one remembered for the session and over the pinned one, for that load. It does not change the pin. A number keeps today's meaning (position in the current list). An unknown name or a number out of range is ignored and the page chooses as it does now. `full=1` opens the 3D watch as if the Full watch button had been pressed, which also switches to the Slide-rule chronograph face, whatever `dial` says. `view` is read only together with `full=1`; an unknown view is ignored.

**Writing, as the reader clicks around.** Choosing a face from the list, stepping by clicking the face, Randomize, Pin, the Full watch button and the view list each bring the address up to date with `history.replaceState`, so the back button is not filled with entries. Entering the 3D watch sets `full=1` at once (while it is still building); leaving it, by any route including a failure, removes `full` and `view`. Other parameters (`time`, `light`, `gl`, `debug`, `band`, `wrist`) and the `#section` part are kept.

**A bare address stays bare on load.** A visitor who arrives with no `dial` in the address still gets a random unseen face and the address is not touched until they do something. If the address did carry a `dial` on load, it is rewritten to the slug of the face actually shown, which turns a number into a name and removes a name that matched nothing.

## My calls, not the owner's

- The names `dial`, `full`, `view`, and `full=1` rather than `watch=3d`: `dial` already exists, and `full` matches the button. If a second 3D watch is ever made, `full=1` applies to whichever face has one.
- After Randomize the address names the new face, so a reload keeps it. Before this change a reload after Randomize gave another random face. The address saying what is on screen matters more; a visit to the bare address still gets a random face.
- The bracelet and "On a wrist" settings are not written to the address. `?band=` and `?wrist=1` are still read, as before.
- The mode still is not remembered between visits other than through the address.

## Out of scope

No change to pinning, to the random choice, or to what the 3D watch shows. No back-button stepping through faces.
