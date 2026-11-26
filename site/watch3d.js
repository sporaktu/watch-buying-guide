// Full watch: a button under the masthead dial that swaps the flat dial for a 3D watch the reader can turn. The models
// are in site/watch3d/ (three.js, the shared kit, and one folder per watch). None of it is fetched until the button is
// first pressed; this file only owns the button, the view chooser, which watch belongs to which face, and when the
// model's frame loop runs. WATCHES names the faces that have a 3D watch. Pressing the button on one of them opens its
// watch; on any other face it switches the masthead to DEFAULT first. Choosing another face with a watch while the mode
// is on shows that watch instead; choosing a face without one leaves the mode. One watch is held at a time: the built
// one is kept, so a second press on the same face is instant, and another watch replaces it. The mode is in the page
// address (?full=1, and ?view= for any view but the three-quarter one), kept up to date as the reader goes in and out
// and changes view; that is the only way it carries between visits, so a link can open the 3D watch.
// Each time a watch is shown, its report (see the stage's comment: triangles, draw calls, warnings and the watch's own
// entries) is written as JSON into the stage's data-watch3d-report attribute, for tools/watch3d-shots.sh and anyone
// checking a watch without a console. Always, not only under ?debug, so a check loads exactly the address a reader
// would; it is a few hundred bytes. It is removed when the stage is thrown away after a failure.
(() => {
  'use strict';
  // Face name (as dials.js has it) to watch id (its folder under site/watch3d/watches/).
  const WATCHES = { 'Slide-rule chronograph': 'navitimer' };
  const DEFAULT = 'Slide-rule chronograph';
  const FAILED = 'The 3D watch could not be shown on this device.';
  const $ = id => document.getElementById(id);
  const stage = $('dialStage'), btn = $('dialFull'), view = $('dialView'), band = $('dialBand'), wrist = $('dialWrist');
  const cap = $('dialName'), wait = $('dialWait'), sayEl = $('dialSay'), dials = window.WBMDials;
  if (!stage || !btn || !view || !band || !wrist || !cap || !wait || !sayEl || !dials) return;   // the button stays hidden
  // What a screen reader is told. #dialWait is only the visible label: it is not in the accessibility tree while it is
  // empty, so it cannot be the live region; #dialSay is, always, and is not shown.
  const say = text => { sayEl.textContent = text; };

  let on = false;         // what the reader last asked for
  let want = null;        // the id of the watch the reader last asked for
  let handle = null;      // the stage, kept once it has been made, and the watch it holds
  let building = null;    // the promise of the stage, while the files load and the first watch builds
  let pending = null;     // the id of the watch the stage is switching to, while it builds
  let ticket = 0;         // the latest switch, so an overtaken one is ignored
  let inView = true;      // the stage is on screen
  let base = '';          // the dial's own caption, to put back
  let wristWas = false;   // whether On a wrist was disabled before the mode

  const full = () => stage.classList.contains('full');
  // The loop runs only while the watch is showing, the stage is on screen and the tab is visible.
  function run() {
    if (!handle) return;
    if (on && full() && !pending && inView && !document.hidden) handle.start(); else handle.stop();
  }
  // In the mode the caption names the watch that is modelled, when its about says so, and adds its hint.
  const caption = () => {
    base = cap.textContent;
    const about = handle.about;
    cap.textContent = (about.caption || base).replace(/[.\s]*$/, '') + '. ' + about.hint;
  };
  // The address says the 3D watch is showing and which view, so the link can be copied. The three-quarter view is the
  // default and is left out, and so is a watch turned by hand (the list's empty value): no view names where it is.
  const mark = () => dials.address({ full: '1', view: view.value && view.value !== 'hero' ? view.value : null });

  function show() {
    wait.textContent = '';
    const was = full();   // already in the mode: one watch is taking the place of another
    stage.classList.remove('loading'); stage.classList.add('full');
    handle.canvas.hidden = false;
    dials.pause(true);   // the flat dial is hidden under the watch: stop drawing it
    band.hidden = true; view.hidden = false;
    if (!was) { wristWas = wrist.disabled; wrist.disabled = true; }
    caption();
    try { stage.dataset.watch3dReport = JSON.stringify(handle.report); } catch (e) { delete stage.dataset.watch3dReport; }
    say('3D watch shown. Drag to turn it, or choose a view.');
    run();
  }

  // byDial: the masthead has just changed to another dial, so its caption is already the new dial's.
  function leave(byDial) {
    const was = full(), asked = on;
    on = false; btn.setAttribute('aria-pressed', 'false');
    if (asked) say('Flat watch face shown.');
    wait.textContent = '';
    stage.classList.remove('loading', 'full');
    if (handle) { handle.stop(); handle.canvas.hidden = true; }
    dials.pause(false);
    dials.address({ full: null, view: null });
    if (!was) return;
    view.hidden = true; band.hidden = false;
    wrist.disabled = wristWas;
    if (!byDial) cap.textContent = base;
    // band.js stood down while the watch had the stage; this is its cue to draw the band and its controls again. Not
    // wbm-dial: the dial has not changed.
    document.dispatchEvent(new Event('wbm-stage'));
  }

  function fail(err) {
    console.warn('The 3D watch could not be shown.', err);
    const was = on;
    ticket++; pending = null;   // a switch still building is forgotten
    if (handle) { handle.dispose(); handle = null; }   // a lost context: the next press builds afresh
    delete stage.dataset.watch3dReport;
    leave(false);
    if (was) { cap.textContent = FAILED; say(FAILED); }   // the caption stays until the dial next changes
  }

  // Bring the stage to the watch the reader asked for: show it if it is built, or build it, or switch to it.
  function open() {
    if (!on) return;
    if (handle && !pending && handle.about && handle.about.id === want) { show(); return; }
    if (handle) { handle.stop(); handle.canvas.hidden = true; }
    stage.classList.add('loading'); wait.textContent = 'Building the watch';
    say('Building the 3D watch');
    if (building) return;   // the stage is being made: open() runs again when it is
    if (!handle) { make(); return; }
    if (pending === want) return;
    // Another watch: the stage frees the one it holds and builds this one, which starts on the three-quarter view.
    const id = want, mine = ++ticket;
    pending = id;
    view.value = 'hero'; mark();
    handle.show(id).then(() => {
      if (mine !== ticket) return;   // overtaken by a later switch, or a failure
      pending = null;
      if (view.value && view.value !== 'hero') handle.setView(view.value, true);   // a view chosen while it was building
      open();   // shows it, or switches again if the reader has asked for another since, or nothing if they left
    }, err => { if (mine === ticket) fail(err); });
  }

  function make() {
    const options = {
      watch: want,
      shadowSize: matchMedia('(max-width: 720px)').matches ? 2048 : 4096,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onLost: () => fail(new Error('The WebGL context was lost.')),
      onError: err => fail(err),   // the watch's own code threw while it was showing
      onInteract: () => { view.value = ''; if (on) mark(); }   // the list reads Turned by hand, so any named view can be chosen again
    };
    // The page's ?time= freezes the flat dial's clock; the 3D watch's hands follow it, so screenshots can be compared.
    // The same checks as dials.js: a time out of range is ignored there, and the 3D watch then keeps the live time too.
    let time = null; try { time = new URLSearchParams(location.search).get('time'); } catch (e) {}
    const tm = time && /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
    if (tm && +tm[1] < 24 && +tm[2] < 60 && +(tm[3] || 0) < 60) options.time = time;
    // catch() after then(), so an error in showing the built watch is handled like one in building it.
    building = import('./watch3d/kit/stage.js').then(m => m.mount(stage, options)).then(h => {
      building = null; handle = h;
      h.canvas.classList.add('watch3d'); h.canvas.hidden = true;
      if (!view.value) view.value = 'hero';   // a new model starts on the three-quarter view, not where an old one was turned to
      h.setView(view.value, true);
      open();   // otherwise the reader left while it was loading: keep it for the next press
    }).catch(err => { building = null; fail(err); });
  }

  function enter() {
    const face = WATCHES[dials.current()] ? dials.current() : DEFAULT;
    if (!dials.choose(face)) { dials.address({ full: null, view: null }); return; }
    on = true; want = WATCHES[face]; btn.setAttribute('aria-pressed', 'true');
    mark();
    open();
  }

  btn.addEventListener('click', () => { if (on) leave(false); else enter(); });
  view.addEventListener('change', () => { if (!view.value) return; if (handle) handle.setView(view.value); if (on) mark(); });
  document.addEventListener('wbm-dial', () => {
    if (!on) return;
    const id = WATCHES[dials.current()];
    if (!id) leave(true);   // a face with no 3D watch ends the mode, even while one is building
    else if (id !== want) { want = id; open(); }   // a face with another watch: show that one
    else if (full() && !pending && handle && handle.about && handle.about.id === id) caption();   // the same dial was shown again (Pin), which wrote its plain caption
  });
  document.addEventListener('visibilitychange', run);
  if (window.IntersectionObserver) new IntersectionObserver(es => { inView = es[es.length - 1].isIntersecting; run(); }).observe(stage);
  btn.hidden = false;
  // ?full=1 opens the 3D watch on arrival, as a press of the button would; ?view= picks its view.
  let asked = null; try { asked = new URLSearchParams(location.search); } catch (e) {}
  if (asked && asked.get('full') === '1') {
    const v = asked.get('view');
    if (v && [...view.options].some(o => o.value === v)) view.value = v;
    enter();
  }
})();
