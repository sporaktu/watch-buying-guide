// The 3D watch in one element of the page: renderer, camera, lights, views, pointer handling and the frame loop.
// Adapted from the model's own full-window page (lab/fable-navitimer/src/main.js). The differences: it fills and
// follows a container instead of the window, it draws on a transparent ground (and the crystal's blending is set to
// suit one), the wheel is left to the page, options take the place of the page-address parameters, and the loop can
// be stopped and the whole thing disposed.
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { makeEnvironment } from './env.js';
import { makeMaterials } from './materials.js';
import { buildWatch } from './watch.js';

// Named views: camera direction from the target, distance, and where to look.
const VIEWS = {
  hero: { dir: [0.46, 0.28, 1], dist: 172, target: [0, 0, -9] },
  front: { dir: [0, 0, 1], dist: 166, target: [0, 0, 2] },
  side: { dir: [1, 0.06, 0.03], dist: 182, target: [0, 0, -19] },
  back: { dir: [0.6, 0.1, -0.79], dist: 164, target: [0, 0, -8] },
  clasp: { dir: [0.12, -0.16, -1], dist: 170, target: [0, 0, -30] },
  bracelet: { dir: [0.5, -0.9, 0.33], dist: 165, target: [0, -6, -19] },
};

/** Wall-clock source. A time of 'HH:MM:SS' pins it, so screenshots are comparable. */
function makeClock(time) {
  if (!time) return () => new Date();
  const [h, m, s] = String(time).split(':').map(Number);
  const fixed = new Date();
  fixed.setHours(h || 0, m || 0, s || 0, 0);
  return () => fixed;
}

/**
 * @param {HTMLElement} container  the watch fills this element and follows its size
 * @param {{ shadowSize?: 4096|2048, reducedMotion?: boolean, onLost?: () => void, time?: string }} [options]
 *        time: 'HH:MM:SS' freezes the hands, for comparable screenshots
 * @returns {Promise<Handle>} resolves when the first frame has been drawn; rejects if WebGL is missing or the build throws
 *
 * Handle:
 *   canvas: HTMLCanvasElement          appended to container by mount
 *   views: string[]                    ['hero', 'front', 'side', 'back', 'clasp', 'bracelet']
 *   setView(name: string, instant?: boolean): boolean
 *   start(): void                      begin the frame loop (idempotent)
 *   stop(): void                       cancel it (idempotent)
 *   running: boolean
 *   chrono: { toggle(): void, reset(): void }
 *   dispose(): void                    stop, free GL resources, remove the canvas and every listener
 */
export async function mount(container, options = {}) {
  const reducedMotion = !!options.reducedMotion;
  const shadowSize = options.shadowSize === 2048 ? 2048 : 4096;

  // The lettering is drawn on canvases in Jost, which the page's stylesheet declares.
  await document.fonts.load('600 40px Jost');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D model of a blue and cream chronograph on a steel bracelet. Drag to turn.');

  // Everything that has to be undone; dispose works back through it.
  const undo = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); undo.push(() => target.removeEventListener(type, fn, opts)); };
  let renderer = null, scene = null, disposed = false, ready = false, raf = 0;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    while (undo.length) { try { undo.pop()(); } catch (e) { /* keep undoing */ } }
    if (scene) {
      const seen = new Set();
      const drop = (x) => { if (x && typeof x.dispose === 'function' && !seen.has(x)) { seen.add(x); x.dispose(); } };
      scene.traverse((o) => {
        drop(o.geometry);
        for (const m of [].concat(o.material || [])) {
          for (const v of Object.values(m)) if (v && v.isTexture) drop(v);
          drop(m);
        }
        if (o.isLight && o.shadow) drop(o.shadow);
      });
      drop(scene.environment);
    }
    if (renderer) {
      renderer.dispose();
      // Browsers allow only a few live contexts; give this one back now rather than when the canvas is collected.
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    }
    canvas.remove();
  }

  try {
    container.append(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);   // the page's own ground shows round the watch

    scene = new THREE.Scene();
    scene.environment = makeEnvironment(renderer, 512);
    scene.environmentIntensity = 1.0;

    const camera = new THREE.PerspectiveCamera(26, 1, 2, 3000);
    const controls = new OrbitControls(camera, canvas);
    undo.push(() => controls.dispose());
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 520;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.9;
    controls.enablePan = false;
    // The wheel belongs to the page, so it scrolls with the pointer over the watch. The controls' own wheel
    // listener zooms and swallows the event, so it is taken off; a two-finger pinch still zooms.
    canvas.removeEventListener('wheel', controls._onMouseWheel);

    // A key lamp for cast shadows (hands on the dial, bezel on the case) and for the sunray sweep.
    const key = new THREE.DirectionalLight(0xfff4e6, 2.3);
    key.position.set(-70, 85, 100);
    key.castShadow = true;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = key.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 320;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 2.2;
    key.target.position.set(0, -4, -22);
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xdde8ff, 0.9);
    rim.position.set(95, 20, 50);
    scene.add(rim);
    const back = new THREE.DirectionalLight(0xe8eeff, 1.1);
    back.position.set(-45, 45, -95);
    scene.add(back);

    const M = makeMaterials(renderer);
    // The crystal only adds its reflections to what is behind it. On a transparent canvas it must not add to the
    // alpha as well, or the glass shows as an opaque dark shape wherever the page, not the watch, is behind it.
    for (const glass of [M.crystal, M.crystalInner]) {
      glass.blending = THREE.CustomBlending;
      glass.blendEquation = THREE.AddEquation;
      glass.blendSrc = THREE.SrcAlphaFactor; glass.blendDst = THREE.OneFactor;
      glass.blendSrcAlpha = THREE.ZeroFactor; glass.blendDstAlpha = THREE.OneFactor;
    }
    undo.push(() => { M.brushN.dispose(); M.brushC.dispose(); });
    const clock = makeClock(options.time);
    const built = await buildWatch({ M, renderer, frozen: !!options.time });
    scene.add(built.group);
    const tick = built.tick, chrono = built.chrono;

    let flight = null;
    // Views are composed for a wide window; a narrow one stands further back by this factor.
    let fit = 1;
    function setView(name, instant = false) {
      const v = Object.prototype.hasOwnProperty.call(VIEWS, name) ? VIEWS[name] : null;
      if (!v || disposed) return false;
      const dir = new THREE.Vector3(...v.dir).normalize();
      const target = new THREE.Vector3(...v.target);
      const pos = target.clone().addScaledVector(dir, v.dist * fit);
      if (instant || reducedMotion) {
        camera.position.copy(pos); controls.target.copy(target); controls.update(); flight = null;
        if (ready && !raf) renderOnce();   // the loop is stopped, so show the new view now
      } else {
        flight = { t: 0, p0: camera.position.clone(), p1: pos, q0: controls.target.clone(), q1: target };
      }
      return true;
    }
    controls.addEventListener('start', () => { flight = null; });

    // The pushers work: the upper one starts and stops the chronograph, the lower one resets it.
    const pushers = built.parts.case ? built.parts.case.pushers : null;
    if (pushers && chrono) {
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      const targets = [pushers.start, pushers.reset];
      const hit = (ev) => {
        const r = canvas.getBoundingClientRect();
        ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const found = ray.intersectObjects(targets, true)[0];
        if (!found) return null;
        let o = found.object;
        while (o && !targets.includes(o)) o = o.parent;
        return o;
      };
      let held = null;
      // capture phase, so the orbit controls can be told to sit this gesture out before they see it
      listen(canvas, 'pointerdown', (ev) => {
        held = hit(ev);
        if (!held) return;
        controls.enabled = false;
        held.userData.pressed = true;
        if (held === pushers.start) chrono.toggle(); else chrono.reset();
      }, { capture: true });
      const release = () => {
        if (!held) return;
        held.userData.pressed = false; held = null; controls.enabled = true;
      };
      listen(window, 'pointerup', release);
      listen(window, 'pointercancel', release);
      listen(canvas, 'pointermove', (ev) => {
        if (ev.buttons === 0) canvas.style.cursor = hit(ev) ? 'pointer' : 'grab';
      });
    }

    function renderOnce() {
      controls.update();
      tick(clock(), 0, camera);
      renderer.render(scene, camera);
    }

    let width = 0, height = 0;
    function resize() {
      const w = Math.round(container.clientWidth), h = Math.round(container.clientHeight);
      if (!w || !h || (w === width && h === height)) return false;
      width = w; height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const next = Math.max(1, 0.86 / camera.aspect);
      if (next !== fit) {
        // keep the watch the same size across the element when its shape changes
        camera.position.sub(controls.target).multiplyScalar(next / fit).add(controls.target);
        if (flight) flight.p1.sub(flight.q1).multiplyScalar(next / fit).add(flight.q1);
        fit = next;
      }
      return true;
    }
    // Resizing clears the canvas, and the observer runs after this frame's draw, so draw again at once. A canvas that
    // is stopped and not displayed is left alone; start() fits it before its first frame.
    const ro = new ResizeObserver(() => {
      if (disposed || (!raf && !canvas.getClientRects().length)) return;
      if (resize()) renderOnce();
    });
    ro.observe(container);
    undo.push(() => ro.disconnect());
    resize();
    setView('hero', true);

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let last = 0, stoppedAt = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / 1.1);
        const k = ease(flight.t);
        // Swing round the target rather than cutting through the watch.
        const a = flight.p0.clone().sub(flight.q0), b = flight.p1.clone().sub(flight.q1);
        const la = a.length(), lb = b.length();
        const q = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
        const dirNow = a.clone().normalize().applyQuaternion(new THREE.Quaternion().slerp(q, k));
        const tgt = flight.q0.clone().lerp(flight.q1, k);
        camera.position.copy(tgt).addScaledVector(dirNow, la + (lb - la) * k);
        controls.target.copy(tgt);
        if (flight.t >= 1) flight = null;
      }
      controls.update();
      tick(clock(), dt, camera);
      renderer.render(scene, camera);
    }
    function start() {
      if (raf || disposed) return;
      const now = performance.now();
      // The stopwatch counts frame by frame, so give it the time it missed while the loop was stopped.
      if (chrono && chrono.running && stoppedAt !== null) chrono.elapsed += Math.max(0, now - stoppedAt) / 1000;
      stoppedAt = null;
      last = now;
      resize();
      raf = requestAnimationFrame((t) => { last = t; frame(t); });
    }
    function stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      stoppedAt = performance.now();
    }

    // A context lost during the build is reported by the rejection below; onLost is for one lost afterwards.
    listen(canvas, 'webglcontextlost', () => {
      stop();
      if (ready && !disposed && typeof options.onLost === 'function') options.onLost();
    });

    renderOnce();   // the first frame, which also compiles the shaders
    if (renderer.getContext().isContextLost()) throw new Error('The WebGL context was lost while the watch was being built');
    stoppedAt = performance.now();
    ready = true;

    return {
      canvas,
      views: Object.keys(VIEWS),
      setView,
      start,
      stop,
      get running() { return raf !== 0; },
      chrono: { toggle() { chrono.toggle(); }, reset() { chrono.reset(); } },
      dispose,
    };
  } catch (err) {
    dispose();
    throw err;
  }
}
