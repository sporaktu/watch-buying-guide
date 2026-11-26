# Floating bar: search everything, and a phone layout of its own

Date: 2026-11-25. Approved by the owner in conversation.

## Why

The floating bar (`site/nav.js`, shipped in pull request 27) already lists the four sections and every place inside them. Its search does much less than the owner wants: it only narrows the brand list, by exact text, shows nothing to click, and only appears after the first screen. On a phone the bar is the desktop rail sliding in from the side.

The owner wants one bar that is always there, jumps to any section, and has a typo-forgiving search over the whole guide that lists matches and goes to the one clicked. The phone gets a design of its own; that design was left to us.

## Goals

- One search box, always visible in the bar, over everything a reader can go to: sections, guide headings, picks, working models, brands and main model lines.
- Matching that forgives typos and shorthand: "navitmer", "blk bay", "speedmastr" find the watch.
- Results listed as you type, grouped by kind, best match first, with the matched letters marked.
- Clicking a result goes to that thing on the page and marks it for a moment.
- A phone layout designed for a phone.

## Not goals

- Hiding parts of the page as you type. Results are a list; the page does not rearrange under the reader. (Owner agreed.)
- Changing how the brand list's own search box and filters behave.
- Searching the body text of guide paragraphs, release notes, or card small print.
- New dependencies, a build step, or any outbound request. The site is plain files under a strict Content-Security-Policy.

## Anti-goals

- A search that feels slower than the page. Every keystroke must update without visible lag on a mid-range phone.
- A phone bar that covers content the reader cannot scroll into view, or that fights the on-screen keyboard.
- Losing what the bar does today: the section lists, the place-in-page marker, the brand filters.

## Approaches considered

1. **Results list in the bar, own small matcher (chosen).** The bar builds an index from the page and the data already loaded, scores entries itself, and shows results in place of the section lists. No dependency, works under the existing security policy, and the page stays still.
2. **Filter the page in place.** Typing hides every card, row and heading that does not match. Rejected: the page jumps under the reader, the brand list already has its own filters to keep in step, and there is nothing obvious to click.
3. **A fuzzy search library (Fuse.js or similar), vendored.** Rejected: the index is about a thousand short strings, a hand-written matcher of a few dozen lines is enough, and the site has no dependencies today.

## Design

### The index

Built in `nav.js` from what is already on the page and in the loaded data, rebuilt when the bar rebuilds its lists.

| Kind | What is searched | Going to it |
|---|---|---|
| Section | the four section names | scroll to the section |
| Guide | each `#guide h3` | scroll to the heading |
| Pick | pick name, brand, chips or tags | clear the picks filter if it hides the card, scroll to the card |
| Working model | each tab in `#labTabs` | scroll to `#lab` and switch to the tab |
| Brand | brand name, country, standout watch | `BRAND_INDEX.reveal(x)` in `app.js`, which already clears hiding filters, scrolls, focuses and marks the row |
| Model line | model name with its brand | reveal the brand's row, open its Main models, scroll to that model |

### Matching

A small scorer, built as `site/find.js` (`FIND`), which knows nothing about the page; `nav.js` builds the index and calls it. Case and accents are ignored. The query is split into words and every word must match somewhere in the entry. A word matches, best first, as: an exact word, the start of a word, inside a word, letters in order with gaps ("blk" in "black"), or within one or two edits of a word for queries long enough to bear it ("navitmer"). Earlier and tighter matches score higher; a match in the name beats one in the secondary text. Ties fall back to page order. Show the best few per kind with a way to see the rest of a kind, so one kind cannot crowd out the others.

Added in review, after the first build:

- A brand is also found by its standout watch ("royal oak" finds Audemars Piguet), since the brand's row shows it and most brands have no model lines.
- Numbers match exactly: a word with a digit in it gets no letters-in-order or typo matching, "1,500" and "39.5" are each one number, and two numbers are never run together, so "44mm" finds only 44mm watches.
- When something matches a whole word, the start of a word or words run together, entries that match only loosely (letters in order with gaps, or a typo of the start of a longer word) are dropped, so "try" does not list Tourby. A typo of a whole word is never dropped, so "seko" still finds Seiko beside Sekonda.
- The looser kinds need the first letter right.

### Wide windows (1200px and up)

The rail stays where it is. The search box sits at the top of the rail from the first screen on. While the box is empty the rail shows the section lists as now. While it has text, the results take the place of the section lists: grouped under kind headings with a count, matched letters marked, a clear "nothing matches" line.

Keyboard: `/` (when not already typing in a field) focuses the box; Down and Up move through results; Enter goes to the marked result, or the first; Escape clears the box, and a second Escape leaves it.

The Filters button and its controls stay, still acting only on the brand list, and still appear once the reader is past the first screen. The bar's box no longer drives the brand list's own search box.

### Phones and narrow windows (under 1200px)

A bar fixed along the bottom, clear of the home indicator, with two things: a Sections button that names the section being read, and a search field that takes most of the width.

- **Search** opens a full-screen sheet. The box is at the top with a Cancel button, so the keyboard never covers it; results fill the space between box and keyboard and scroll on their own. Rows are at least 48px tall, with the kind shown on each row. Tapping a result closes the sheet and goes there. Use `visualViewport` so the list ends at the keyboard.
- **Sections** opens a sheet that slides up from the bottom, not in from the side: the four sections as large rows, the current one open with its places, and the brand filters behind a Filters row. It closes by tapping outside, the close button, Escape, or going somewhere.
- While a sheet is open the page behind does not scroll, and focus stays inside the sheet. Closing returns focus to what opened it.

### Kept as it is

The section lists and the marker for where the reader is; reduced-motion handling; print rules; the way `nav.js` reads the page without `app.js`, `map.js` or `lab.js` knowing about it (calling `BRAND_INDEX.reveal` is the one thing it uses from them, and it must cope if that is missing).

## Upkeep the change carries

- A release note at the top of `RELEASES` in `site/releases.js`, as the README requires for anything readers see.
- The README's description of the floating bar, if it has one, brought up to date.

## Left to the builder

Exact scoring weights, how many results per kind, the look of the result rows and sheets within the site's existing style (square corners, ink and paper colours, Jost), and whether the new code stays in `nav.js` or the matcher moves to a file of its own.
