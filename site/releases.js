// What's new. One entry per merge to main, newest first.
// To publish a release, add an entry at the top with the next id (the pull request number works well),
// the merge date, a short title, and optional notes. The bell beside the dial shows a dot
// until the reader has opened the newest entry.
const RELEASES = [
  {id: 22, date: "2026-11-25", title: "Twelve new watch faces, under a light from overhead", notes: ["Twelve new faces after watches in the picks, among them the Farer Resolute with ice-blue lume under its black numerals, the Tudor Black Bay GMT and Chrono, and the Trafford Crossroads.", "The newest faces now come first in the menu under the dial.", "The light on the face now comes from far overhead and is wider than the watch, so the whole face brightens and dims as you move."]},
  {id: 21, date: "2026-11-24", title: "Click a photo for the full details", notes: ["Click the photo on a pick and a window opens with the photo larger, the price, every spec, why we picked it and where to buy.", "Click a thumbnail under Main models for that model's type, sizes, movement, price and description."]},
  {id: 20, date: "2026-11-24", title: "Softer light on the watch face", notes: ["The light that follows your pointer across the watch face is now broad and diffuse, not a bright spot."]},
  {id: 19, date: "2026-11-24", title: "The bell moved beside the watch face", notes: ["The bell now floats at the top left of the watch face, and the notes open in a window over the page."]},
  {id: 18, date: "2026-11-24", title: "What's new: release notes behind the bell", notes: ["The bell beside the watch face opens these notes. It shows a red dot when there is something you haven't read."]},
  {id: 15, date: "2026-11-24", title: "Microbrands, hand-wound picks, and photos of the main models", notes: ["23 microbrands join the brand index, with their main models.", "Seven hand-wound picks, each with its photo.", "Two new filters above the picks: microbrands and hand-wound.", "Main models now shows a photo for 316 of its 384 model lines."]},
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
    if (open === box.open) return;
    if (!open) { box.close(); return; }
    box.showModal();
    btn.setAttribute('aria-expanded', 'true');
    dot.hidden = true;
    try { localStorage.setItem(KEY, String(latest)); } catch { /* private mode: the dot simply returns next visit */ }
  };
  btn.addEventListener('click', () => set(true));
  close.addEventListener('click', () => set(false));
  // A click on the dimmed backdrop lands on the dialog element itself; clicks on its content land on children.
  box.addEventListener('click', e => { if (e.target === box) set(false); });
  // Fires for the close button, the backdrop and Escape alike; the browser returns focus to the bell.
  box.addEventListener('close', () => btn.setAttribute('aria-expanded', 'false'));
})();
