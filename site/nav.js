// The floating bar: a search box over the whole guide, filters for the brand list, and a list of the page's sections,
// all of which stay on screen. On a wide window it is a rail down the left edge, as tall as the window. On a narrow one
// it is a bar along the bottom with a Sections button and a search field: search opens the rail as a full-screen sheet,
// and Sections opens it as a sheet that slides up from the bottom.
// It reads the page as app.js, map.js and lab.js drew it, and the data they loaded, and drives the brand list through
// the list's own controls, so those files don't know it exists. The one thing it calls is BRAND_INDEX.reveal in app.js.
// The matching itself is in find.js.
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width:1200px)');
  const SECTIONS = [['guide', 'How to buy'], ['picks', 'Picks'], ['lab', 'Try them out'], ['index', 'Every brand']];
  if (!$('index') || !$('rows')) return;
  // A browser can hold an older copy of the page, without find.js, for a few minutes after an update. The bar then has no search box.
  const can = typeof FIND !== 'undefined';

  const rail = el('nav', 'rail'); rail.id = 'rail';
  const shade = el('div', 'rail-shade'); shade.hidden = true;
  const dock = el('div', 'dock');

  // ---- Filters for the brand list. Each control here sets the matching control in the list and lets app.js redraw.
  const tools = el('div', 'rail-tools'); tools.hidden = true;
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
  tools.append(fBtn, fBox, count);

  // After a change made from the bar, bring the list into view unless its top is already on screen.
  const toList = () => { const r = $('rows').getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * .6) $('rows').scrollIntoView({block: 'start'}); };
  const send = (target, type, value) => { target.value = value; target.dispatchEvent(new Event(type, {bubbles: true})); toList(); };
  showSel.addEventListener('change', () => { $('show').querySelector(`[data-k="${showSel.value}"]`).click(); toList(); });
  tierSel.addEventListener('change', () => { $('tabs').querySelector(`[data-t="${tierSel.value}"]`).click(); toList(); });
  landSel.addEventListener('change', () => send($('country'), 'change', landSel.value));
  sortSel.addEventListener('change', () => send($('sort'), 'change', sortSel.value));
  lo.addEventListener('input', () => send($('pmin'), 'input', lo.value));
  hi.addEventListener('input', () => send($('pmax'), 'input', hi.value));
  reset.addEventListener('click', () => { $('reset').click(); toList(); });
  // In the Sections sheet the open filters take the room of the places list.
  fBtn.addEventListener('click', () => { fBox.hidden = !fBox.hidden; fBtn.setAttribute('aria-expanded', String(!fBox.hidden)); rail.classList.toggle('filtering', !fBox.hidden); });
  const pressed = box => { const b = box.querySelector('[aria-pressed="true"]'); return b ? b.dataset.k || b.dataset.t : ''; };
  function syncTools(){
    showSel.value = pressed($('show')); tierSel.value = pressed($('tabs'));
    landSel.value = $('country').value; sortSel.value = $('sort').value;
    if (document.activeElement !== lo) lo.value = $('pmin').value;
    if (document.activeElement !== hi) hi.value = $('pmax').value;
    count.textContent = $('count').textContent;
    // A search in the list's own box looks through every brand, so Show reads All brands while it lasts. That isn't a filter the reader set.
    const n = [!$('q').value && showSel.value !== 'rec', tierSel.value !== 'all', landSel.value, sortSel.value !== 'tier', lo.value, hi.value].filter(Boolean).length;
    fBtn.textContent = n ? `Filters (${n})` : 'Filters';
  }

  // ---- The sections. Each has a heading link and a list of the places inside it. Only the section being read shows its
  // list, and that list scrolls inside the bar when it is longer than the room left.
  const secs = el('div', 'rail-secs');
  let parts = [];   // {id, label, sec, node, head, list, items: [{a, target}]}
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
    const was = parts.some(p => p.node.classList.contains('on'));
    secs.textContent = ''; parts = [];
    for (const [id, label] of SECTIONS) {
      const sec = $(id); if (!sec || sec.hidden) continue;
      const node = el('div', 'rs'), head = el('a', 'rs-h', label), list = el('div', 'rs-list');
      head.href = '#' + id; head.addEventListener('click', go(sec));
      node.append(head, list); secs.append(node);
      parts.push({id, label, sec, node, head, list, items: places(id, list)});
    }
    current = null; here = null;
    if (was) mark();
    track();
    buildIndex(); search();
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
        // Keep it in view inside its own list without moving the page: when it has left the list's window, put it in the middle.
        const l = p.list, box = l.getBoundingClientRect(), r = it.a.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom) l.scrollTop += r.top - box.top - (l.clientHeight - r.height) / 2;
      }
    }
  }
  // Put the marker for where the reader is back in view, after its list was out of sight or scrolled by hand.
  function showHere(){ if (here) here.a.classList.remove('here'); here = null; mark(); }
  function track(){
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false; mark();
      // On a wide window the filters join the bar once the first screen has scrolled away, and stay while one of them is in use.
      // On a narrow one they are always in the Sections sheet.
      const past = scrollY > innerHeight * .85, was = tools.hidden;
      if (!wide.matches) tools.hidden = false;
      else if (past || !tools.contains(document.activeElement)) tools.hidden = !past;
      if (tools.hidden !== was) point();      // the results under them moved
    });
  }

  // ---- Search over the whole guide. The index is one entry for everything a reader can go to: the sections, the guide's
  // headings, the picks, the working models, every brand (whatever the filters show) and every main model line.
  // Each entry has a name, secondary text that is also searched (pieces joined by SEP), and a way to go there.
  const KINDS = [['sec', 'Sections', 'Section'], ['guide', 'Guide headings', 'Guide'], ['pick', 'Picks', 'Pick'], ['lab', 'Working models', 'Working model'], ['brand', 'Brands', 'Brand'], ['model', 'Model lines', 'Model line']];
  const FEW = 5;        // how many of a kind are listed before "Show all"
  const SEP = ' \u00b7 ';
  let index = [], brandIndex = null;
  // The data comes from the other files' top-level names. One that is missing, or that its file never got as far as
  // setting because it stopped on an error, must not stop the bar: reading it is tried, and nothing is a fine answer.
  const data = read => { try { return read(); } catch (e) { return undefined; } };
  const uniq = list => { const seen = new Set(); return list.filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase())); };
  // keep: how many of the secondary pieces always show on the result. The rest show only when they matched.
  const add = (kind, name, sub, keep, to) => index.push({kind, name: FIND.prep(name), sub: sub ? FIND.prep(sub) : null, keep, to});
  function buildIndex(){
    index = [];
    if (!can) return;
    for (const p of parts) {
      const h = p.sec.querySelector('h2'), long = h ? h.textContent.trim() : '';
      add('sec', p.label, long.toLowerCase() === p.label.toLowerCase() ? '' : long, 1, () => land(p.sec, h));
    }
    document.querySelectorAll('#guide h3').forEach(h => add('guide', h.textContent, '', 0, () => land(h)));
    // A pick is found by its brand and name, and by its chips and the filters it belongs to.
    const picks = data(() => PICKS) || [];
    if (picks.length) {
      const tag = {}; if ($('pfilter')) $('pfilter').querySelectorAll('button').forEach(b => { tag[b.dataset.k] = b.textContent; });
      for (const p of picks) add('pick', p.brand + ' ' + p.model, uniq([...(p.chips || []), ...(p.tags || []).map(t => tag[t])]).join(SEP), 0, () => toPick(p));
    }
    // A working model is found by its tab, and by the names the cards use for what it shows ("GMT" for the second time zone).
    const how = data(() => HOW);
    if ($('lab') && !$('lab').hidden) document.querySelectorAll('#labTabs button').forEach(b => {
      const id = b.dataset.id, name = b.textContent;
      const also = !how || !id ? [] : Object.values(how).filter(h => h.demo && h.demo.split('-')[0] === id).map(h => h.n);
      add('lab', name, uniq([name, ...also]).slice(1).join(SEP), 0, () => toLab(name));
    });
    brandIndex = data(() => BRAND_INDEX) || null;
    const brands = brandIndex && brandIndex.all || [];
    // A brand is found by its name, its country and its standout watch ("royal oak"), which its row shows.
    for (const x of brands) add('brand', x.r[0], [x.r[1], x.r[4]].filter(Boolean).join(SEP), x.r[1] ? 1 : 0, () => toBrand(x));
    for (const x of brands) (x.models || []).forEach((m, i) => add('model', m.name, x.r[0], 1, () => toModel(x, i)));
  }

  // Mark something for a moment. The mark starts once the page has stopped moving, so it isn't spent before the reader
  // gets there: a smooth scroll down a page this long can take seconds. The browser says when a scroll ends (scrollend);
  // where it doesn't, or when there was nothing to scroll, the page counts as stopped once it has stayed put for a while.
  let lit = null, litT = 0, litF = 0, litEnd = null;
  function flash(node){
    clearTimeout(litT); cancelAnimationFrame(litF); if (litEnd) removeEventListener('scrollend', litEnd); if (lit) lit.classList.remove('nav-found');
    lit = node;
    const y = scrollY, tells = 'onscrollend' in window;
    let from = 0, at = y, since = 0, frames = 0, moving = false;
    const show = () => {
      cancelAnimationFrame(litF); removeEventListener('scrollend', litEnd); litEnd = null;
      lit.classList.add('nav-found');
      litT = setTimeout(() => { lit.classList.remove('nav-found'); lit = null; }, 2600);
    };
    litEnd = () => { if (moving || scrollY !== y) show(); };
    addEventListener('scrollend', litEnd);
    // Counted from the first frame, and over a few frames: the click's own work can hold the first one back.
    const wait = now => {
      if (!from) from = since = now;
      frames++;
      if (scrollY !== at) { at = scrollY; since = now; moving = true; }
      const quiet = moving ? tells ? 1500 : 200 : 400;
      if ((frames < 3 || now - since < quiet) && now - from < 6000) litF = requestAnimationFrame(wait); else show();
    };
    litF = requestAnimationFrame(wait);
  }
  // Arrive somewhere: scroll to it, move the keyboard there so Tab carries on from it, and mark it.
  function land(target, shown, block){
    shown = shown || target;
    if (shown.tabIndex < 0) { shown.tabIndex = -1; shown.addEventListener('blur', () => shown.removeAttribute('tabindex'), {once: true}); }
    shown.focus({preventScroll: true});
    target.scrollIntoView({block: block || 'start', behavior: still() ? 'auto' : 'smooth'});
    flash(shown);
  }
  // A pick's card is only on the page while the picks filter keeps it, so a hidden one puts the filter back to All first.
  function toPick(p){
    const card = () => { const b = document.querySelector(`#picks .zoom[data-pick="${CSS.escape(p.key)}"]`); return b ? b.closest('.card') : [...document.querySelectorAll('#picks .card')].find(c => { const h = c.querySelector('h3'); return h && h.textContent === p.model; }); };
    let c = card();
    if (!c) { const all = document.querySelector('#pfilter [data-k="all"]'); if (all) all.click(); c = card(); }
    if (c) land(c);
  }
  function toLab(name){
    const b = [...document.querySelectorAll('#labTabs button')].find(t => t.textContent === name);
    if (!b) return;
    b.click(); land($('lab'), b);
  }
  // reveal() in app.js clears the filters that hide a brand, scrolls to its row and focuses it. Its own mark starts at
  // once and can be over before a long scroll ends, so the bar's mark takes its place. Returns the row.
  const rowOf = x => document.querySelector(`#rows .row[data-b="${x.i}"]`);
  function showBrand(x){
    if (!brandIndex || !brandIndex.reveal) { const row = rowOf(x); if (row) land(row, null, 'center'); return row; }
    brandIndex.reveal(x);
    const row = rowOf(x); if (row) row.classList.remove('found');
    return row;
  }
  function toBrand(x){ const row = showBrand(x); if (row) flash(row); }
  // A model line is inside its brand's row, under Main models: show the row, open the list, and go to the line.
  function toModel(x, i){
    const row = showBrand(x), box = row && row.querySelector('details.models'), line = box && box.querySelectorAll('li')[i];
    if (!line) { if (row) flash(row); return; }
    box.open = true;
    land(line, null, 'center');
  }

  const find = el('div', 'rail-q');
  const rq = el('input'); rq.type = 'search'; rq.id = 'railQ'; rq.placeholder = 'Search the guide'; rq.setAttribute('aria-label', 'Search the whole guide');
  rq.setAttribute('role', 'combobox'); rq.setAttribute('aria-autocomplete', 'list'); rq.setAttribute('aria-controls', 'railRes'); rq.setAttribute('aria-expanded', 'false');
  rq.autocomplete = 'off'; rq.spellcheck = false; rq.setAttribute('autocapitalize', 'off'); rq.setAttribute('autocorrect', 'off'); rq.enterKeyHint = 'go';
  const key = el('span', 'rail-key', '/'); key.setAttribute('aria-hidden', 'true'); key.title = 'Press / to search';
  const cancel = el('button', 'rail-cancel', 'Cancel'); cancel.type = 'button';
  find.append(rq, key, cancel); find.hidden = !can;
  const res = el('div', 'rail-res'); res.id = 'railRes'; res.setAttribute('role', 'listbox'); res.setAttribute('aria-label', 'Search results'); res.hidden = true;
  const hint = el('p', 'rail-hint', 'Search the sections, the guide, the picks, the working models, every brand and their main models. Close is good enough: “blk bay” finds the Black Bay.');
  const said = el('p', 'vh'); said.setAttribute('role', 'status');

  // Text from..to with the matched letters marked.
  function paint(into, text, from, to, hits){
    for (let i = from; i < to;) {
      const on = hits.has(i); let j = i + 1;
      while (j < to && hits.has(j) === on) j++;
      into.append(on ? el('mark', '', text.slice(i, j)) : text.slice(i, j)); i = j;
    }
  }
  let rows = [], active = -1, typed = '', full = new Set();   // rows: what the arrow keys move through, {node, run}
  function option(cls, run){
    const n = el('div', cls), i = rows.length; n.id = 'railOpt' + i; n.setAttribute('role', 'option'); n.setAttribute('aria-selected', 'false');
    rows.push({node: n, run}); return n;
  }
  function result(e, qs, kind){
    const [inName, inSub] = FIND.marks(qs, e.name, e.sub);
    const n = option('fr', () => { if (!wide.matches) close(false); e.to(); });
    const name = el('span', 'fr-n'); paint(name, e.name.text, 0, e.name.text.length, inName); n.append(name);
    if (e.sub) {
      const sub = el('span', 'fr-s'), text = e.sub.text; let from = 0;
      for (const [n, piece] of text.split(SEP).entries()) {
        const to = from + piece.length; let show = n < e.keep;
        for (let i = from; !show && i < to; i++) show = inSub.has(i);
        if (show) { if (sub.firstChild) sub.append(SEP); paint(sub, text, from, to, inSub); }
        from = to + SEP.length;
      }
      if (sub.firstChild) n.append(sub);
    }
    n.setAttribute('aria-label', [...n.children].map(c => c.textContent).concat(kind).join(', '));
    n.append(el('span', 'fr-k', kind));
    return n;
  }
  // Score every entry against what is typed and list the matches: grouped by kind, the kind with the best match first,
  // the best few of each kind and a way to see the rest.
  function search(){
    const qs = can ? FIND.words(rq.value) : [], on = qs.length > 0, was = rail.classList.contains('finding');
    const same = rq.value === typed, top = res.scrollTop;
    if (!same) { typed = rq.value; full.clear(); active = -1; }
    rail.classList.toggle('finding', on); res.hidden = !on; rq.setAttribute('aria-expanded', String(on));
    const text = rq.value.trim();
    dockQ.textContent = text || 'Search the guide'; dockField.classList.toggle('has', !!text);
    res.textContent = ''; rows = [];
    if (!on) {
      said.textContent = ''; active = -1; rq.removeAttribute('aria-activedescendant');
      if (was) showHere();      // the section lists are back
      return;
    }
    const by = new Map();
    for (const m of FIND.all(qs, index)) { if (!by.has(m.e.kind)) by.set(m.e.kind, []); by.get(m.e.kind).push(m); }
    // Entries are in page order and the sort keeps ties as they were, so equal scores stay in page order.
    const groups = KINDS.filter(k => by.has(k[0])).map(k => ({k, list: by.get(k[0]).sort((a, b) => b.s - a.s)})).sort((a, b) => b.list[0].s - a.list[0].s);
    let total = 0;
    for (const {k, list} of groups) {
      total += list.length;
      const box = el('div', 'fg'), head = el('div', 'fg-h', k[1]); head.id = 'railKind-' + k[0]; head.append(el('span', '', String(list.length)));
      box.setAttribute('role', 'group'); box.setAttribute('aria-labelledby', head.id); box.append(head);
      const all = full.has(k[0]) || list.length <= FEW + 1;
      for (const x of all ? list : list.slice(0, FEW)) box.append(result(x.e, qs, k[2]));
      if (!all) {
        const at = rows.length;
        box.append(option('fr fr-more', () => { full.add(k[0]); active = at; search(); }));
        rows[at].node.textContent = `Show all ${list.length} ${k[1].toLowerCase()}`;
      }
      res.append(box);
    }
    if (!total) res.append(el('p', 'fr-none', `Nothing in the guide matches “${text}”.`));
    said.textContent = total ? `${total} ${total === 1 ? 'match' : 'matches'}` : 'Nothing matches';
    if (active >= rows.length) active = rows.length - 1;
    if (same) res.scrollTop = top;
    point();
  }
  // Show which result the arrow keys are on, and keep it in view inside the list.
  function point(){
    rows.forEach((r, i) => { r.node.classList.toggle('on', i === active); r.node.setAttribute('aria-selected', String(i === active)); });
    if (active < 0) { rq.removeAttribute('aria-activedescendant'); return; }
    const n = rows[active].node, r = n.getBoundingClientRect(), box = res.getBoundingClientRect();
    rq.setAttribute('aria-activedescendant', n.id);
    const head = n.parentNode.firstChild.offsetHeight;      // the kind's heading stays stuck to the top of the list
    if (r.top < box.top + head) res.scrollTop -= box.top + head - r.top;
    else if (r.bottom > box.bottom) res.scrollTop += r.bottom - box.bottom;
  }
  rq.addEventListener('input', search);
  rq.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault(); active = e.key === 'ArrowDown' ? Math.min(active + 1, rows.length - 1) : Math.max(active - 1, 0); point();
    } else if (e.key === 'Enter') {
      e.preventDefault(); const r = rows[Math.max(active, 0)]; if (r) r.run();
    } else if (e.key === 'Escape') {
      // Escape clears the box, and a second Escape leaves it.
      e.preventDefault(); e.stopPropagation();
      if (rq.value) { rq.value = ''; search(); } else if (wide.matches) rq.blur(); else close();
    }
  });
  // A click on a result must not take the keyboard out of the box first.
  res.addEventListener('mousedown', e => { if (e.target.closest('.fr')) e.preventDefault(); });
  res.addEventListener('click', e => { const n = e.target.closest('.fr'), i = rows.findIndex(r => r.node === n); if (i < 0) return; active = i; point(); rows[i].run(); });
  cancel.addEventListener('click', () => { rq.value = ''; search(); close(); });

  // ---- The bottom bar and the two sheets, for narrow windows.
  const dockSecs = el('button', 'dock-secs'); dockSecs.type = 'button'; dockSecs.setAttribute('aria-controls', 'rail'); dockSecs.setAttribute('aria-haspopup', 'dialog');
  const dockName = el('b', '', 'Sections'); dockSecs.append(el('span', '', 'Sections'), dockName);
  const dockFind = el('button', 'dock-find'); dockFind.type = 'button'; dockFind.setAttribute('aria-controls', 'rail'); dockFind.setAttribute('aria-haspopup', 'dialog'); dockFind.setAttribute('aria-label', 'Search the guide'); dockFind.hidden = !can;
  const dockField = el('span', 'dock-field'), dockQ = el('span', 'dock-q', 'Search the guide');
  const glass = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); glass.setAttribute('viewBox', '0 0 20 20'); glass.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of [['circle', {cx: 8.5, cy: 8.5, r: 5.5}], ['path', {d: 'M13 13l5 5'}]]) { const s = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const a in attrs) s.setAttribute(a, attrs[a]); glass.append(s); }
  dockField.append(glass, dockQ); dockFind.append(dockField);
  const head = el('div', 'rail-head'), shut = el('button', 'rail-close', '\u00d7'); shut.type = 'button'; shut.setAttribute('aria-label', 'Close');
  head.append(el('b', '', 'Sections'), shut);
  dock.append(dockSecs, dockFind);
  let opener = null, mode = '', hushed = [];
  // The search sheet ends where the on-screen keyboard begins, so the results are never under it.
  const vv = window.visualViewport;
  function fit(){
    const on = vv && mode === 'find' && rail.classList.contains('open') && vv.scale < 1.01;
    rail.style.height = on ? vv.height + 'px' : ''; rail.style.top = on ? vv.offsetTop + 'px' : '';
  }
  function open(m){
    if (wide.matches) return;
    const was = rail.classList.contains('open');
    if (!was) opener = document.activeElement;
    mode = m;
    rail.classList.toggle('find', m === 'find'); rail.classList.add('open'); rail.inert = false;
    rail.setAttribute('aria-label', m === 'find' ? 'Search the guide' : 'Sections and filters');
    shade.hidden = false; document.documentElement.classList.add('rail-open');
    // The page behind can't be scrolled or reached with the keyboard while a sheet is open.
    if (!was) { hushed = [...document.body.children].filter(n => n !== rail && n !== shade && n.tagName !== 'SCRIPT' && !n.inert); hushed.forEach(n => { n.inert = true; }); }
    dockSecs.setAttribute('aria-expanded', String(m !== 'find')); dockFind.setAttribute('aria-expanded', String(m === 'find'));
    fit();
    if (m === 'find') { rq.focus(); rq.select(); }
    else { showHere(); (current ? current.head : shut).focus(); }
  }
  // Closing puts the keyboard back where it was, unless the reader chose somewhere to go.
  function close(back){
    if (!rail.classList.contains('open')) return;
    rail.classList.remove('open'); shade.hidden = true; document.documentElement.classList.remove('rail-open');
    hushed.forEach(n => { n.inert = false; }); hushed = [];
    dockSecs.setAttribute('aria-expanded', 'false'); dockFind.setAttribute('aria-expanded', 'false');
    fit(); layout();
    if (back !== false && opener && opener.focus) opener.focus({preventScroll: true});
    opener = null;
  }
  // On a wide window the rail is part of the page. On a narrow one it is a sheet: a dialog while open, and out of the
  // tab order while closed. The filters sit under the search box in the rail and under the sections in the sheet.
  function layout(){
    const w = wide.matches;
    if (w && rail.classList.contains('open')) close(false);
    if (w) { rail.removeAttribute('role'); rail.removeAttribute('aria-modal'); rail.setAttribute('aria-label', 'Search, filters and page sections'); rail.inert = false; }
    else { rail.setAttribute('role', 'dialog'); rail.setAttribute('aria-modal', 'true'); if (!rail.classList.contains('open')) rail.inert = true; }
    const before = w ? res : null;
    if (tools.parentNode !== rail || tools.nextElementSibling !== before) rail.insertBefore(tools, before);
    track();
  }
  dockSecs.setAttribute('aria-expanded', 'false'); dockFind.setAttribute('aria-expanded', 'false');
  dockSecs.addEventListener('click', () => open('secs'));
  dockFind.addEventListener('click', () => open('find'));
  shut.addEventListener('click', () => close());
  shade.addEventListener('click', () => close());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rail.classList.contains('open')) { e.preventDefault(); close(); return; }
    // "/" goes to the search box from anywhere, unless the reader is typing in a field or has a window open over the page.
    if (e.key !== '/' || !can || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (wide.matches) { rq.focus(); rq.select(); } else open('find');
  });
  wide.addEventListener('change', layout);
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }

  rail.append(head, find, res, hint, secs, said);
  document.body.append(rail, shade, dock);
  layout(); syncTools(); build();

  // Redraw the lists and the search index when the page behind them changes: the brand list, the picks, and the sections that arrive late.
  let again = 0;
  const rebuild = () => { clearTimeout(again); again = setTimeout(() => { syncTools(); build(); }, 60); };
  document.addEventListener('wbm-index', rebuild);
  const watch = new MutationObserver(rebuild);
  for (const id of ['pickGrid', 'stepGrid', 'labTabs']) if ($(id)) watch.observe($(id), {childList: true});
  for (const id of ['lab', 'map']) if ($(id)) watch.observe($(id), {attributes: true, attributeFilter: ['hidden']});
  addEventListener('scroll', track, {passive: true});
  addEventListener('resize', track);
  addEventListener('load', rebuild);
})();
