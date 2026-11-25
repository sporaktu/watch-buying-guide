// What's new. One entry per merge to main, newest first.
// To publish a release, add an entry at the top with the next id (the pull request number works well),
// the merge date, a short title, and optional notes. The bell at the top of the page shows a dot
// until the reader has opened the newest entry.
const RELEASES = [
  {id: 16, date: "2026-11-24", title: "New pick: the Trafford Crossroads S 40 Fern", notes: ["A Texas-made watch joins the picks, with its photo, movement and where to buy it."]},
  {id: 14, date: "2026-11-24", title: "Brand index: Maen added"},
  {id: 13, date: "2026-11-22", title: "New pick: the Tudor Black Bay Chrono \"Flamingo Blue\""},
  {id: 12, date: "2026-11-22", title: "Six more travel watches, and a second time zone filter", notes: ["Six picks that show a second time zone, chosen around the Black Bay GMT.", "A new filter above the picks shows only the travel watches."]},
  {id: 11, date: "2026-11-22", title: "New pick: the Tudor Black Bay GMT with the opaline dial"},
  {id: 10, date: "2026-11-21", title: "Sinn cards corrected: the clasp has six positions, not six steps"},
  {id: 9, date: "2026-11-21", title: "Bracelet, clasp and strap details on every pick", notes: ["Each pick now says how its bracelet or strap adjusts and what clasp it has.", "Two new filters: easy to adjust, and folding clasp."]},
  {id: 8, date: "2026-11-21", title: "Seven extra tough picks with hardened cases"},
  {id: 7, date: "2026-11-21", title: "A thirty-first masthead dial: a slide-rule chronograph"},
  {id: 6, date: "2026-11-21", title: "Slide rule explained as a times table you set, with sums worked in steps"},
  {id: 5, date: "2026-11-19", title: "Six more chronographs, and working models to try", notes: ["How to use each chronograph function, with models you can operate on the page."]},
  {id: 4, date: "2026-11-19", title: "Photos for the 14 picks of 41mm and up"},
  {id: 3, date: "2026-11-19", title: "Picks for larger wrists", notes: ["Watches from 41 to 43mm, and advice on choosing a size."]},
  {id: 2, date: "2026-11-17", title: "Phone layout: the dial is full width and centred"},
  {id: 1, date: "2026-11-17", title: "The dial's lamp follows the tilt of your phone"}
];

(() => {
  const btn = document.querySelector('#newsBtn');
  const box = document.querySelector('#news');
  const dot = document.querySelector('#newsDot');
  if (!btn || !box || !RELEASES.length) return;
  const KEY = 'wbm-news';
  const latest = RELEASES[0].id;
  const el = (tag, text, attrs) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    return n;
  };
  const day = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
  const entry = (parent, r) => {
    parent.append(el('time', day(r.date), {datetime: r.date}), el('h3', r.title));
    if (r.notes && r.notes.length) {
      const ul = el('ul');
      for (const n of r.notes) ul.append(el('li', n));
      parent.append(ul);
    }
  };
  const close = el('button', '\u00d7', {type: 'button', class: 'news-close', 'aria-label': 'Close'});
  box.append(close, el('h2', "What's new"));
  entry(box, RELEASES[0]);
  if (RELEASES.length > 1) {
    const more = el('details');
    more.append(el('summary', `Earlier releases (${RELEASES.length - 1})`));
    for (const r of RELEASES.slice(1)) entry(more, r);
    box.append(more);
  }
  let seen = null;
  try { seen = Number(localStorage.getItem(KEY)); } catch { seen = null; }
  dot.hidden = seen === latest;
  const set = open => {
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (!open) return;
    dot.hidden = true;
    try { localStorage.setItem(KEY, String(latest)); } catch { /* private mode: the dot simply returns next visit */ }
  };
  btn.addEventListener('click', () => set(box.hidden));
  close.addEventListener('click', () => { set(false); btn.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) { set(false); btn.focus(); } });
  document.addEventListener('click', e => { if (!box.hidden && !e.target.closest('.news-bar')) set(false); });
})();
