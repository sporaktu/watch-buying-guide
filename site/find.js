// The matcher behind the floating bar's search (nav.js). It knows nothing about the page: it gets text ready for
// matching, scores what was typed against an entry's name and its secondary text, and says which letters matched so
// they can be marked. It forgives typos and shorthand: "navitmer", "blk bay" and "speedmastr" all find the watch.
const FIND = (() => {
  // Case and accents are ignored. These letters don't split into a letter and an accent, so they are listed.
  const ODD = {'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ł': 'l', 'đ': 'd'};
  const plain = c => { c = c.toLowerCase(); return c.length === 1 && c < '\u0080' ? c : ODD[c] || c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };

  const NUM = /[0-9]/;
  // A piece of text made ready: its words, where each letter came from in the original (for marking), and the words
  // run together with no gaps, so "blackbay" can find "Black Bay".
  function prep(text){
    text = String(text == null ? '' : text);
    let flat = ''; const at = [];
    const digit = c => c >= '0' && c <= '9';
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ',' && digit(text[i - 1] || '') && digit(text[i + 1] || '')) continue;      // "1,500" is one number
      for (const c of plain(text[i])) { flat += c; at.push(i); }
    }
    const words = [], run = []; let tight = '';
    for (const m of flat.matchAll(/[\p{L}\p{N}]+/gu)) {
      words.push({w: m[0], a: m.index, o: tight.length}); tight += m[0];
      for (let j = 0; j < m[0].length; j++) run.push(at[m.index + j]);
    }
    return {text, words, at, tight, run};
  }
  // What was typed, as plain words.
  const words = q => prep(q).words.map(x => x.w);

  // The letters of q found in w in order, with gaps allowed: their positions in w, or null.
  function inOrder(q, w){
    const pos = []; let j = 0;
    for (let i = 0; i < w.length && j < q.length; i++) if (w[i] === q[j]) { pos.push(i); j++; }
    return j === q.length ? pos : null;
  }
  // How many edits (a letter added, dropped or changed, or two neighbours swapped) turn q into w, and into the start
  // of w that is nearest to q: [edits to all of w, edits to that start, the length of that start].
  function edits(q, w){
    const m = q.length, n = w.length;
    let before = null, prev = [], row;
    for (let j = 0; j <= n; j++) prev.push(j);
    for (let i = 1; i <= m; i++) {
      row = [i];
      for (let j = 1; j <= n; j++) {
        let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (q[i - 1] === w[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && q[i - 1] === w[j - 2] && q[i - 2] === w[j - 1]) v = Math.min(v, before[j - 2] + 1);
        row.push(v);
      }
      before = prev; prev = row;
    }
    let near = n;
    for (let j = n - 1; j > 0; j--) if (prev[j] < prev[near]) near = j;
    return [prev[n], prev[near], near];
  }

  // How well one typed word q matches one word w of an entry. 0 is no match, and higher is better. Best first:
  //   100      the whole word
  //   80-90    the start of it
  //   55-65    inside it
  //   44, 38   the whole word with one typo, or two ("navitmer", "seko" for Seiko, "divers" for diver)
  //   16-31    its letters in order with gaps ("blk" in "black")
  //   10, 6    the start of it with one typo, or two
  // A tighter fit, where q covers more of w, scores higher within a kind. The last two kinds are the loose ones: see all().
  // When pos is given, it is filled with the positions in w of the letters that matched.
  function word(q, w, pos){
    const fill = (from, to) => { if (pos) for (let i = from; i < to; i++) pos.push(i); };
    const fit = q.length / w.length;
    if (q === w) { fill(0, w.length); return 100; }
    if (w.startsWith(q)) { fill(0, q.length); return 80 + 10 * fit; }
    // Inside a word, but never from the middle of a number: "500" is not in "1500".
    let inside = q.length > 1 ? w.indexOf(q, 1) : -1;
    while (inside > 0 && NUM.test(q[0]) && NUM.test(w[inside - 1])) inside = w.indexOf(q, inside + 1);
    if (inside > 0) { fill(inside, inside + q.length); return 55 + 10 * fit; }
    // The kinds below need the first letter right and at least three letters to go on, or everything would match.
    // Numbers get none of them: "44mm" must not find a 42mm watch, or "1963" a 1965.
    if (q.length < 3 || q[0] !== w[0] || NUM.test(q) || NUM.test(w)) return 0;
    let best = 0, how = null;
    // Letters in order: the typed letters must be at least half of the word. One letter short of the whole word is a
    // typo of it ("ble" for "blue"), whatever the length.
    const gaps = q.length < w.length && q.length * 2 >= w.length ? inOrder(q, w) : null;
    if (gaps) { best = q.length === w.length - 1 ? 44 : 16 + 15 * fit; how = gaps; }
    // Typos: one edit for a word of four to seven letters, two from eight letters up. The word may also carry on past
    // what was typed, since the reader may not have finished typing it.
    const allow = q.length < 4 ? 0 : q.length < 8 ? 1 : 2;
    if (allow && w.length >= q.length - allow) {
      const whole = w.length <= q.length + allow;
      const [all, start, len] = edits(q, whole ? w : w.slice(0, q.length + allow));
      // A typo that only dropped letters marks the letters that are there; any other marks the word, or its start.
      if (whole && all <= allow) { best = Math.max(best, 50 - 6 * all); how = gaps || w.length; }
      else if (start <= allow && 14 - 4 * start > best) { best = 14 - 4 * start; how = len; }
    }
    if (pos && how != null) { if (typeof how === 'number') fill(0, how); else pos.push(...how); }
    return best;
  }

  // The best match for one typed word among a field's words: [score, which word, whether it ran words together].
  // Earlier words count for a little more in a name. In secondary text (early = false) the order means nothing.
  function best(q, f, early){
    let top = 0, at = -1, joined = false;
    for (let i = 0; i < f.words.length; i++) {
      const x = f.words[i]; let s = word(q, x.w), j = false;
      if (s < 72 && q.length > x.w.length && f.tight.startsWith(q, x.o)) { s = 72; j = true; }
      if (s) { if (early) s += Math.max(0, 6 - 2 * i); if (s > top) { top = s; at = i; joined = j; } }
    }
    return [top, at, joined];
  }

  // Score an entry for what was typed. Every typed word must match the name or the secondary text, and the name
  // counts for more. A name the typed words cover completely beats a longer name that merely contains them.
  // Returns null for no match, else {s, sure, loose}: the score; whether some typed word matched a whole word, the
  // start of one or words run together; and whether every typed word matched only by one of the two loose kinds,
  // its letters in order or a typo of the start of a word. hits, when given, is filled with
  // [field, word, joined, typed word] for each typed word.
  // A word's score, with its few points for coming early, is under LOOSE for the two loose kinds and SURE or more
  // for the three surest (see word and best).
  const SUB = .6, LOOSE = 38, SURE = 72;
  function match(qs, name, sub, hits){
    if (!qs.length) return null;
    let total = 0, inName = 0, sure = false, loose = true;
    for (const q of qs) {
      const a = best(q, name, true), b = sub ? best(q, sub, false) : null;
      const viaName = !b || a[0] >= b[0] * SUB, raw = viaName ? a[0] : b[0];
      if (!raw) return null;
      if (viaName) inName++;
      if (raw >= SURE) sure = true;
      if (raw >= LOOSE) loose = false;
      total += viaName ? raw : raw * SUB;
      if (hits) hits.push(viaName ? [name, a[1], a[2], q] : [sub, b[1], b[2], q]);
    }
    return {s: total / qs.length + 12 * Math.min(1, inName / Math.max(1, name.words.length)), sure, loose};
  }
  // Every match for what was typed, from a list of entries that each have a name and a sub (see prep), as
  // [{e, s}] in the order given. When something matches surely, the entries that only match loosely are noise
  // ("try" would find Tourby, "tank" Tangente) and are left out. A typo of a whole word is never loose, so "seko"
  // still finds Seiko beside Sekonda. When nothing matches surely ("blk"), the loose matches are the answer.
  function all(qs, entries){
    const out = []; let sure = false;
    for (const e of entries) { const m = match(qs, e.name, e.sub); if (m) { m.e = e; out.push(m); sure = sure || m.sure; } }
    return sure ? out.filter(m => !m.loose) : out;
  }

  // Which characters of an entry's name and secondary text matched, as positions in the original text: [name, sub].
  function marks(qs, name, sub){
    const hits = [], out = [new Set(), new Set()];
    if (!match(qs, name, sub, hits)) return out;
    for (const [f, i, joined, q] of hits) {
      const set = out[f === name ? 0 : 1], x = f.words[i];
      if (joined) for (let j = 0; j < q.length; j++) set.add(f.run[x.o + j]);
      else { const pos = []; word(q, x.w, pos); for (const p of pos) set.add(f.at[x.a + p]); }
    }
    return out;
  }

  return {prep, words, match, all, marks};
})();
