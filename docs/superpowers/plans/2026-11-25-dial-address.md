# The address names the watch face and the 3D watch: plan

Design: `docs/superpowers/specs/2026-11-25-dial-address-design.md`. Read it first. This lands on `sporaktu/full-watch`, on top of full watch mode, in the same pull request.

## Global constraints

- Static site, no build step, no dependencies. The Content-Security-Policy line in `site/index.html` must not change.
- Only `site/dials.js`, `site/watch3d.js`, `site/releases.js` and `README.md` change. Do not touch `site/watch3d/`.
- Match the code style already in each file (dense, `const`, arrow functions, a comment that says why).
- Every address write goes through one function and is wrapped in `try`/`catch`, so a browser that refuses `replaceState` (a `file:` page, a sandbox) loses nothing but the address update.
- One commit per task. No push, no pull request.

## Task 1: `site/dials.js` reads a name and writes the address

1. Near the code that chooses the first face (the lines starting `let idx, pinned = get(LS, 'wbm-dial-pin');`), add:

```js
  // A face is named in the address by a slug of its name: lower case, no accents or apostrophes, hyphens between words.
  const slug = s => ('' + s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Bring the address up to date without adding to the back button's history. null removes a parameter.
  const address = changes => { try { const u = new URL(location.href); for (const k in changes) { if (changes[k] == null) u.searchParams.delete(k); else u.searchParams.set(k, changes[k]); } history.replaceState(history.state, '', u); } catch (e) {} };
  let asked = null; try { asked = new URLSearchParams(location.search).get('dial'); } catch (e) {}
  // ?dial= is a slug, or a number: the position in the list as it stands (the test tools use this).
  const named = asked === null ? null : /^\d+$/.test(asked) ? (+asked >= 1 && +asked <= D.length ? +asked - 1 : null) : (i => i < 0 ? null : i)(D.findIndex(d => slug(d.n) === slug(asked)));
```

   and replace the old `const q = /[?&]dial=(\d+)/.exec(location.search), chosen = ...` and `if (q && ...) idx = +q[1] - 1;` with `const chosen = get(SS, 'wbm-dial-session');` and `if (named !== null) idx = named;`. The rest of the `else if` chain stays.

2. `show(i)` gains a second parameter: `function show(i, first)`. At its end: `if (!first || asked !== null) address({ dial: slug(D[i].n) });`. The one call at start-up becomes `show(idx, true)`. Every other call (list, click, Pin, Randomize, `WBMDials.choose`) is unchanged and so writes the address. Note `show` dispatches `wbm-dial` before this line; that order is fine because `watch3d.js` writes different parameters.

3. Add `address` to `window.WBMDials` (`address(changes) { address(changes); }` or the function itself), with a word in the comment above it.

4. Update the comment at the top of the file (`// Page parameters. ?dial=N shows design N.`) to describe the slug, the number and that the address is kept up to date.

5. Check with node before the browser: extract the names and confirm 43 names give 43 different slugs, none all digits, none empty. (Already checked when this plan was written; re-check after your edit by running the same `slug` on the names.) `node --check site/dials.js`.

6. Commit: `Name the masthead dial in the address`.

## Task 2: `site/watch3d.js` reads and writes `full` and `view`

1. `enter()`: after `on = true; btn.setAttribute('aria-pressed', 'true');` add `mark();` where

```js
  // The address says the 3D watch is showing and which view, so the link can be copied; the three-quarter view is the default and is left out.
  const mark = () => dials.address({ full: '1', view: view.value === 'hero' ? null : view.value });
```

2. `leave()`: remove both on every exit, before the `if (!was) return;` line: `dials.address({ full: null, view: null });`. This covers the button, another dial, Randomize, leaving while loading, and `fail()` (which calls `leave`).

3. The view list's `change` handler: `if (handle) handle.setView(view.value); if (on) mark();`.

4. At the end of the file, after `btn.hidden = false;`, read the address:

```js
  // ?full=1 opens the 3D watch on arrival, as a press of the button would; ?view= picks its view.
  let asked = null; try { asked = new URLSearchParams(location.search); } catch (e) {}
  if (asked && asked.get('full') === '1') {
    const v = asked.get('view');
    if (v && [...view.options].some(o => o.value === v)) view.value = v;
    enter();
  }
```

   `enter()` already calls `h.setView(view.value, true)` when the model is built, so the view from the address is the first one shown. If `dials.choose(NAME)` fails `enter()` returns before `on` is set; in that case remove `full` and `view` from the address (call `dials.address({ full: null, view: null })` on that path).

5. Update the comment at the top of the file: the mode is in the address, and that is the only way it carries between visits.

6. `node --check site/watch3d.js`. Commit: `Open the 3D watch from the address`.

## Task 3: check in the browser, then the release note and README

Serve with `python3 /tmp/nostore-server.py 8772` from the worktree root if nothing is listening on 8772 (it sends `Cache-Control: no-store`; a plain `http.server` lets the Orca browser serve stale scripts). Page: `http://127.0.0.1:8772/site/`. Clear `localStorage` and `sessionStorage` between cases that depend on them. For each case record the observed values.

1. Bare address: after load `location.search` is `''`, a face shows, and there are 0 requests under `/watch3d/`.
2. `?dial=panda-chronograph`: the list reads `Panda chronograph`; `location.search` is `?dial=panda-chronograph`; `localStorage['wbm-dial-pin']` is still unset.
3. With a pin set to another face and a session choice set to a third: `?dial=panda-chronograph` still shows Panda, and the pin is unchanged after.
4. `?dial=28`: shows the 28th face in the list and the address becomes that face's slug.
5. `?dial=no-such-face` and `?dial=999`: the page chooses as usual and the address ends up naming the face shown.
6. `?dial=Pilot%E2%80%99s%20watch%2C%20type%20A` shows that face; address becomes `?dial=pilots-watch-type-a`.
7. From a bare address: choose a face from the list, click the face to step, press Randomize, press Pin. After each, `dial` names the face shown and `history.length` has not grown.
8. `?time=10:08:30&band=steel#picks` plus choosing a face: `time`, `band` and the hash are still there and still work after a reload (hands frozen at 10:08:30, metal bracelet showing).
9. Press Full watch: the address gains `full=1` at once and `dial=slide-rule-chronograph`. Choose Case back: `view=back`. Choose Three-quarter: no `view`. Press the button again: `full` and `view` gone, `dial` stays.
10. In full mode choose another face, and separately Randomize: `full` and `view` gone, `dial` is the new face.
11. Load `?full=1`: the 3D watch opens without a press; address `?dial=slide-rule-chronograph&full=1`. Load `?dial=panda-chronograph&full=1&view=back`: the 3D watch opens on the case back, the view list reads Case back, `dial` becomes `slide-rule-chronograph`.
12. Load `?full=1&view=nonsense`: opens on the three-quarter view, `view` removed or left out once the address is next written; say which.
13. Load `?view=back` without `full`: no 3D files are fetched.
14. Force a failure with `?full=1` (for example lose the WebGL context after it opens): the flat face returns and `full` is gone from the address.
15. At 390 x 844 (`viewport ... --mobile`, re-run after each reload): cases 2, 9 and 11.
16. Console: nothing new, nothing about the Content-Security-Policy.

Then:

- `site/releases.js`: release note id 30 has not shipped yet, so add one sentence to its notes rather than a new note: the address bar now names the watch face and the 3D view being looked at, so the address can be copied to share that exact one.
- `README.md`: in the `site/dials.js` row or the full watch section, document `?dial=<slug or number>`, `?full=1` and `?view=`, and that the address is kept up to date with `replaceState`.
- Commit: `Record the address parameters in the release note and README`.

## Report

Per task: done with commit hash, or not. Per check 1 to 16: passed, failed or not run, with observed values. Anything departed from and why. Anything not checked.
