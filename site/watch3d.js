// Full watch: a button under the masthead dial that swaps the flat dial for a 3D watch the reader can turn. The model
// is in site/watch3d/ (three.js and the watch's own modules). None of it is fetched until the button is first pressed;
// this file only owns the button, the view chooser and when the model's frame loop runs. Pressing the button switches
// the masthead to the Slide-rule chronograph dial, which is the watch the model is of, and choosing any other dial
// leaves the mode. The built model is kept, so a second press is instant. The mode is in the page address (?full=1, and
// ?view= for any view but the three-quarter one), kept up to date as the reader goes in and out and changes view; that is
// the only way it carries between visits, so a link can open the 3D watch.
(() => {
  'use strict';
  const NAME = 'Slide-rule chronograph';
  const HINT = 'Drag to turn. Press the pushers to run the stopwatch.';
  const FAILED = 'The 3D watch could not be shown on this device.';
  const $ = id => document.getElementById(id);
  const stage = $('dialStage'), btn = $('dialFull'), view = $('dialView'), band = $('dialBand'), wrist = $('dialWrist');
  const cap = $('dialName'), wait = $('dialWait'), sayEl = $('dialSay'), dials = window.WBMDials;
  if (!stage || !btn || !view || !band || !wrist || !cap || !wait || !sayEl || !dials) return;   // the button stays hidden
  // What a screen reader is told. #dialWait is only the visible label: it is not in the accessibility tree while it is
  // empty, so it cannot be the live region; #dialSay is, always, and is not shown.
  const say = text => { sayEl.textContent = text; };

  let on = false;         // what the reader last asked for
  let handle = null;      // the built watch, kept once it has been made
  let building = null;    // the promise of one, while the files load and the model builds
  let inView = true;      // the stage is on screen
  let base = '';          // the dial's own caption, to put back
  let wristWas = false;   // whether On a wrist was disabled before the mode

  const full = () => stage.classList.contains('full');
  // The loop runs only while the watch is showing, the stage is on screen and the tab is visible.
  function run() {
    if (!handle) return;
    if (on && full() && inView && !document.hidden) handle.start(); else handle.stop();
  }
  const caption = () => { base = cap.textContent; cap.textContent = base.replace(/[.\s]*$/, '') + '. ' + HINT; };
  // The address says the 3D watch is showing and which view, so the link can be copied. The three-quarter view is the
  // default and is left out, and so is a watch turned by hand (the list's empty value): no view names where it is.
  const mark = () => dials.address({ full: '1', view: view.value && view.value !== 'hero' ? view.value : null });

  function show() {
    wait.textContent = '';
    stage.classList.remove('loading'); stage.classList.add('full');
    handle.canvas.hidden = false;
    dials.pause(true);   // the flat dial is hidden under the watch: stop drawing it
    band.hidden = true; view.hidden = false;
    wristWas = wrist.disabled; wrist.disabled = true;
    caption();
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
    if (handle) { handle.dispose(); handle = null; }   // a lost context: the next press builds afresh
    leave(false);
    if (was) { cap.textContent = FAILED; say(FAILED); }   // the caption stays until the dial next changes
  }

  function enter() {
    if (!dials.choose(NAME)) { dials.address({ full: null, view: null }); return; }
    on = true; btn.setAttribute('aria-pressed', 'true');
    mark();
    if (handle) { show(); return; }
    stage.classList.add('loading'); wait.textContent = 'Building the watch';
    say('Building the 3D watch');
    if (building) return;
    const options = {
      shadowSize: matchMedia('(max-width: 720px)').matches ? 2048 : 4096,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onLost: () => fail(new Error('The WebGL context was lost.')),
      onInteract: () => { view.value = ''; if (on) mark(); }   // the list reads Turned by hand, so any named view can be chosen again
    };
    // The page's ?time= freezes the flat dial's clock; the 3D watch's hands follow it, so screenshots can be compared.
    let time = null; try { time = new URLSearchParams(location.search).get('time'); } catch (e) {}
    if (time && /^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) options.time = time;
    // catch() after then(), so an error in showing the built watch is handled like one in building it.
    building = import('./watch3d/kit/stage.js').then(m => m.mount(stage, options)).then(h => {
      building = null; handle = h;
      h.canvas.classList.add('watch3d'); h.canvas.hidden = true;
      if (!view.value) view.value = 'hero';   // a new model starts on the three-quarter view, not where an old one was turned to
      h.setView(view.value, true);
      if (on) show();   // otherwise the reader left while it was loading: keep it for the next press
    }).catch(err => { building = null; fail(err); });
  }

  btn.addEventListener('click', () => { if (on) leave(false); else enter(); });
  view.addEventListener('change', () => { if (!view.value) return; if (handle) handle.setView(view.value); if (on) mark(); });
  document.addEventListener('wbm-dial', () => {
    if (!on) return;
    if (dials.current() !== NAME) leave(true);
    else if (full()) caption();   // the same dial was shown again (Pin), which wrote its plain caption
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
