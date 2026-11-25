// The floating bar: a list of the page's sections that stays on screen, as tall as the window, with search and filters
// for the brand list once the reader has scrolled past the first screen. On a wide window it is a rail down the left
// edge. On a narrow one it is a bar along the bottom that opens the same rail as a drawer.
// It reads the page as app.js, map.js and lab.js drew it and drives the brand list through its own controls, so those
// files don't know it exists.
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width:1200px)');
  const SECTIONS = [['guide', 'How to buy'], ['picks', 'Picks'], ['lab', 'Try them out'], ['index', 'Every brand']];
  if (!$('index') || !$('rows')) return;

  const rail = el('nav', 'rail'); rail.id = 'rail'; rail.setAttribute('aria-label', 'Page sections, search and filters');
  const shade = el('div', 'rail-shade'); shade.hidden = true;
  const dock = el('div', 'dock');

  // ---- Search and filters for the brand list. Each control here sets the matching control in the list and lets app.js redraw.
  const find = el('div', 'rail-find'); find.hidden = true;
  const rq = el('input'); rq.type = 'search'; rq.id = 'railQ'; rq.placeholder = 'Search brands or models'; rq.setAttribute('aria-label', 'Search brands or models');
  const fBtn = el('button', 'rail-fbtn', 'Filters'); fBtn.type = 'button'; fBtn.setAttribute('aria-expanded', 'false'); fBtn.setAttribute('aria-controls', 'railFilters');
  const fBox = el('div', 'rail-filters'); fBox.id = 'railFilters'; fBox.hidden = true;
  const count = el('p', 'rail-count');
  const field = (label, control) => { const l = el('label', 'rail-fld'); l.append(el('span', '', label), control); fBox.append(l); return control; };
  const fromButtons = (box, key) => { const s = el('select'); box.querySelectorAll('button').forEach(b => { const o = el('option', '', b.firstChild.textContent); o.value = b.dataset[key]; s.append(o); }); return s; };
  const copyOf = src => { const s = el('select'); [...src.options].forEach(o => { const c = el('option', '', o.textContent); c.value = o.value; s.append(c); }); return s; };
  const showSel = field('Show', fromButtons($('show'), 'k'));
  const tierSel = field('Price', fromButtons($('tabs'), 't'));
  const landSel = field('Country', copyOf($('country')));
  const sortSel = field('Sort by', copyOf($('sort')));
  const num = ph => { const i = el('input'); i.type = 'number'; i.min = '0'; i.step = '50'; i.inputMode = 'numeric'; i.placeholder = ph; return i; };
  const lo = num('from'), hi = num('to'); lo.setAttribute('aria-label', 'Lowest price in dollars'); hi.setAttribute('aria-label', 'Highest price in dollars');
  const money = el('div', 'rail-fld rail-money'); money.setAttribute('role', 'group'); money.setAttribute('aria-label', 'Price range in dollars'); money.append(el('span', '', 'Budget $'), lo, hi); fBox.append(money);
  const reset = el('button', 'rail-reset', 'Reset'); reset.type = 'button'; fBox.append(reset);
  const findRow = el('div', 'rail-q'); findRow.append(rq, fBtn);
  find.append(findRow, fBox, count);

  // After a change made from the bar, bring the list into view unless its top is already on screen.
  const toList = () => { const r = $('rows').getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * .6) $('rows').scrollIntoView({block: 'start'}); };
  const send = (target, type, value) => { target.value = value; target.dispatchEvent(new Event(type, {bubbles: true})); toList(); };
  rq.addEventListener('input', () => send($('q'), 'input', rq.value));
  rq.addEventListener('keydown', e => { if (e.key === 'Enter') { toList(); if (!wide.matches) close(); } });
  showSel.addEventListener('change', () => { $('show').querySelector(`[data-k="${showSel.value}"]`).click(); toList(); });
  tierSel.addEventListener('change', () => { $('tabs').querySelector(`[data-t="${tierSel.value}"]`).click(); toList(); });
  landSel.addEventListener('change', () => send($('country'), 'change', landSel.value));
  sortSel.addEventListener('change', () => send($('sort'), 'change', sortSel.value));
  lo.addEventListener('input', () => send($('pmin'), 'input', lo.value));
  hi.addEventListener('input', () => send($('pmax'), 'input', hi.value));
  reset.addEventListener('click', () => { $('reset').click(); toList(); });
  fBtn.addEventListener('click', () => { fBox.hidden = !fBox.hidden; fBtn.setAttribute('aria-expanded', String(!fBox.hidden)); });
  const pressed = box => { const b = box.querySelector('[aria-pressed="true"]'); return b ? b.dataset.k || b.dataset.t : ''; };
  function syncFind(){
    if (document.activeElement !== rq) rq.value = $('q').value;
    showSel.value = pressed($('show')); tierSel.value = pressed($('tabs'));
    landSel.value = $('country').value; sortSel.value = $('sort').value;
    if (document.activeElement !== lo) lo.value = $('pmin').value;
    if (document.activeElement !== hi) hi.value = $('pmax').value;
    count.textContent = $('count').textContent;
    // A search looks through every brand, so Show reads All brands while it lasts. That isn't a filter the reader set.
    const n = [!$('q').value && showSel.value !== 'rec', tierSel.value !== 'all', landSel.value, sortSel.value !== 'tier', lo.value, hi.value].filter(Boolean).length;
    fBtn.textContent = n ? `Filters (${n})` : 'Filters';
  }

  // ---- The sections. Each has a heading link and a list of the places inside it. Only the section being read shows its
  // list, and that list scrolls inside the bar when it is longer than the room left.
  const secs = el('div', 'rail-secs');
  let parts = [];   // {id, node, head, list, items: [{a, target}]}
  const go = (target, act) => e => {
    e.preventDefault();
    if (act) act();
    if (!wide.matches) close();
    target.scrollIntoView({block: 'start', behavior: still() ? 'auto' : 'smooth'});
  };
  const item = (list, label, target, cls, act) => { const a = el('a', cls || '', label); a.href = target.id ? '#' + target.id : '#'; a.addEventListener('click', go(target, act)); list.append(a); return {a, target}; };
  function places(id, list){
    const out = [];
    if (id === 'guide') document.querySelectorAll('#guide h3').forEach(h => out.push(item(list, h.textContent, h)));
    if (id === 'picks') {
      const cards = (grid) => grid.querySelectorAll('.card').forEach(c => { const im = c.querySelector('.photo img'), h = c.querySelector('h3'); out.push(item(list, im ? im.alt : h ? h.textContent : 'Pick', c)); });
      cards($('pickGrid'));
      const step = $('stepHead');
      if (step && $('stepGrid').children.length) { out.push(item(list, 'Worth stretching for', step, 'sub')); cards($('stepGrid')); }
    }
    if (id === 'lab') document.querySelectorAll('#labTabs button').forEach(b => out.push(item(list, b.textContent, $('lab'), '', () => b.click())));
    if (id === 'index') {
      out.push(item(list, 'Search and filters', document.querySelector('#index .controls'), 'sub'));
      if ($('map') && !$('map').hidden) out.push(item(list, 'Brand map', $('map'), 'sub'));
      for (const n of $('rows').children) {
        if (n.classList.contains('tiername')) out.push(item(list, n.textContent, n, 'sub'));
        else if (n.dataset.b) { const name = n.querySelector('.n'); out.push(item(list, (name.querySelector('a') || name.firstChild).textContent, n)); }
      }
    }
    return out;
  }
  function build(){
    const open = parts.find(p => p.node.classList.contains('on'));
    secs.textContent = ''; parts = [];
    for (const [id, label] of SECTIONS) {
      const sec = $(id); if (!sec || sec.hidden) continue;
      const node = el('div', 'rs'), head = el('a', 'rs-h', label), list = el('div', 'rs-list');
      head.href = '#' + id; head.addEventListener('click', go(sec));
      node.append(head, list); secs.append(node);
      parts.push({id, sec, node, head, list, items: places(id, list)});
    }
    current = null; here = null;
    if (open) mark(true);
    track();
  }

  // ---- Which section, and which place in it, the reader is at: the last one whose top has passed a line a third of the way down.
  let current = null, here = null, queued = false;
  function mark(){
    const line = innerHeight * .34;
    let p = parts[0];
    for (const x of parts) if (x.sec.getBoundingClientRect().top <= line) p = x;
    if (!p) return;
    if (p !== current) {
      if (current) { current.node.classList.remove('on'); current.head.removeAttribute('aria-current'); }
      current = p; p.node.classList.add('on'); p.head.setAttribute('aria-current', 'true');
      dockName.textContent = p.head.textContent;
    }
    // The places are in page order, so a halving search finds the last one above the line.
    let a = 0, b = p.items.length - 1, hit = -1;
    while (a <= b) { const m = (a + b) >> 1; if (p.items[m].target.getBoundingClientRect().top <= line) { hit = m; a = m + 1; } else b = m - 1; }
    const it = hit < 0 ? null : p.items[hit];
    if (it !== here) {
      if (here) here.a.classList.remove('here');
      here = it;
      if (it) {
        it.a.classList.add('here');
        // Keep it in view inside its own list without moving the page.
        const l = p.list, top = it.a.offsetTop - l.offsetTop;
        if (top < l.scrollTop || top + it.a.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = top - l.clientHeight / 2;
      }
    }
  }
  function track(){
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false; mark();
      // Search and filters join the bar once the first screen has scrolled away, and stay while one of them is in use.
      const past = scrollY > innerHeight * .85;
      if (past || !find.contains(document.activeElement)) { find.hidden = !past; dockFind.hidden = !past; }
    });
  }

  // ---- The bottom bar and the drawer, for narrow windows.
  const dockSecs = el('button', 'dock-secs'); dockSecs.type = 'button'; dockSecs.setAttribute('aria-controls', 'rail');
  const dockName = el('b', '', 'Sections'); dockSecs.append(el('span', '', 'Sections'), dockName);
  const dockFind = el('button', 'dock-find', 'Search and filter'); dockFind.type = 'button'; dockFind.setAttribute('aria-controls', 'rail'); dockFind.hidden = true;
  const shut = el('button', 'rail-close', '\u00d7'); shut.type = 'button'; shut.setAttribute('aria-label', 'Close');
  dock.append(dockSecs, dockFind);
  let opener = null;
  function open(toFind){
    opener = document.activeElement;
    rail.classList.add('open'); rail.inert = false; shade.hidden = false; document.documentElement.classList.add('rail-open');
    dockSecs.setAttribute('aria-expanded', 'true');
    if (toFind) { find.hidden = false; fBox.hidden = false; fBtn.setAttribute('aria-expanded', 'true'); rq.focus(); }
    else (current ? current.head : shut).focus();
  }
  function close(){
    if (!rail.classList.contains('open')) return;
    rail.classList.remove('open'); shade.hidden = true; document.documentElement.classList.remove('rail-open');
    dockSecs.setAttribute('aria-expanded', 'false');
    layout();
    if (opener && opener.focus) opener.focus({preventScroll: true});
  }
  // On a narrow window the closed drawer is off screen, so it is taken out of the tab order as well.
  function layout(){ if (wide.matches) { rail.classList.remove('open'); shade.hidden = true; document.documentElement.classList.remove('rail-open'); rail.inert = false; } else if (!rail.classList.contains('open')) rail.inert = true; }
  dockSecs.setAttribute('aria-expanded', 'false');
  dockSecs.addEventListener('click', () => open(false));
  dockFind.addEventListener('click', () => open(true));
  shut.addEventListener('click', close);
  shade.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && rail.classList.contains('open')) { e.preventDefault(); close(); } });
  wide.addEventListener('change', layout);

  rail.append(shut, find, secs);
  document.body.append(rail, shade, dock);
  layout(); syncFind(); build();

  // Redraw the lists when the page behind them changes: the brand list, the picks, and the sections that arrive late.
  let again = 0;
  const rebuild = () => { clearTimeout(again); again = setTimeout(() => { syncFind(); build(); }, 60); };
  document.addEventListener('wbm-index', rebuild);
  const watch = new MutationObserver(rebuild);
  for (const id of ['pickGrid', 'stepGrid', 'labTabs']) if ($(id)) watch.observe($(id), {childList: true});
  for (const id of ['lab', 'map']) if ($(id)) watch.observe($(id), {attributes: true, attributeFilter: ['hidden']});
  addEventListener('scroll', track, {passive: true});
  addEventListener('resize', track);
  addEventListener('load', rebuild);
})();
