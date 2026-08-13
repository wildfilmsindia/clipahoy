# Clipahoy — current state

A single place to read where the product stands. Not an audit: AUDIT.md holds
the investigation and its evidence. This is what is true today.

Last updated: 2026-08-13 · `b7fbb4c` on `archive-discovery` and `main`.

---

## What the product is

A personalised front door to the Wilderness Films India archive. A first-time
visitor answers five typed questions; the answers are resolved against the
archive's own vocabulary and turned into a ranked feed. Search, subject and
place browsing sit alongside it as the non-personalised way in.

Route map:

| Route | What it does |
|---|---|
| `/` | Onboarding for a new visitor, personalised feed once answered, generic feed if skipped |
| `/start` | The same five questions on a stable URL, pre-filled for re-tuning |
| `/search` | BM25 free-text search with subject and place facets |
| `/subjects`, `/subject/[slug]` | Browse the 34-tag vocabulary |
| `/places`, `/place/[slug]` | Browse by town and state |
| `/clip/[id]` | Watch page — the only route that ever mounts a player |

---

## The five onboarding questions

Answers are free text. `interpret.ts` resolves them against places, states,
regions, terrains and the closed subject vocabulary; anything it does not
recognise becomes a BM25 search term rather than being discarded.

| # | Question | Kind | What it contributes |
|---|---|---|---|
| 01 | Where are your parents from? | place | Place or state signal. Autocompletes against the gazetteer, including historical names (Bombay, Calcutta, Madras…) and state short forms (Bengal, Orissa). |
| 02 | What do you want to see? | open | The catch-all. No autocomplete on purpose — this is where something outside the vocabulary is most likely to be typed, and it reaches ranking through BM25 alone. |
| 03 | What is your favourite food? | food | `street food` tag plus free text. Chips are limited to dishes with real footage behind them. |
| 04 | Where did you go to school? | place | Place signal **plus an implied `school` tag** (1,341 clips), so "Shimla" here returns Bishop Cotton and St Bede's rather than the Mall road. |
| 05 | What's your favourite Indian state? | state | State-level signal from the 73 gazetteer states. **The coarsest question in the set** — a whole state, not a town. |

Three of the five are place-type, which outweighs a single typed phrase. Two
slots in the opening feed row are therefore reserved for whatever was typed in
questions 2 and 3, rather than relying on the weights landing correctly.

Every example chip was tested through the recommender before shipping. Four
have been dropped for returning nothing or the wrong thing: **Seafront roads**
(led with a Casablanca corniche), **Tram lines** (resolved to `bus`, returned
Delhi bus stops), **Steam engines** and **Fish curry** (13 clips — fell through
to the generic feed).

---

## Search benchmark

**97.0% precision@20** across 25 fixed queries.

`scripts/benchmark-queries.json` holds the queries and their relevance rules;
`npx tsx --conditions=react-server scripts/benchmark.ts` re-scores them. The
rules live in the file so the number means the same thing in a later session.

What it covers: the 8 queries from AUDIT.md §G, plus 17 chosen from cases this
system has actually failed on — out-of-vocabulary festivals, low-count places,
two-word names at risk of splitting, person-name collisions, food, school and
open curiosity phrases.

**What the number means, and does not.** It measures whether returned clips are
topically about the query, judged by conjunctive concept rules over title and
prose. It does **not** measure whether the footage visually shows the thing —
no automated rule can. 23 of the 25 queries sit at 100%; the mean is dragged
down almost entirely by one query.

Two changes were tested and **not shipped** because the benchmark did not move:
BM25 `k1` × `b` across sixteen combinations, and title weight across five
values — all scored identically. The constants are env-overridable
(`BM25_K1`, `BM25_B`, `BM25_TITLE_WEIGHT`) so the sweep is repeatable.

---

## Archive numbers

| | |
|---|---|
| Records crawled from the channel | 126,524 |
| Clips indexed and reachable | **73,415** (58.0% of crawled) |
| Clips with a place | 58,393 (79.5%) |
| Clips with at least one subject tag | 61,434 (83.7%) |
| Clips with a year | 20,072 (27.3%) — see caveat below |
| Gazetteer places | 231 (185 India, 46 outside) |
| States represented | 73 |
| Places browsable in the UI (town-level, ≥20 clips) | 123 |
| Subject vocabulary | 34 tags, closed |

A clip is admitted if it has a place **or** a subject. The excluded remainder
is mostly records with neither; 468 were rejected outright as deleted/private
placeholders, which is the only content rejection rule still active.

---

## Left unfixed, documented

Ordered roughly by how much it would matter to fix.

### Data and accuracy

1. **AUDIT.md is stale.** §A contains a factually wrong claim about
   `search.list` date-windowing — the method returns `totalResults: 90` for the
   whole channel and 0 for every date window, so the "~312,000 units" estimate
   describes something that does not work at all. §D's counts predate the
   current 73,415. Never corrected across any session.
2. **Year is unreliable and stays hidden.** Present on 27.3% of clips and
   scraped from description prose, not a filming-date field. Where it can be
   checked against a decade named in the same text, **30.9% of values
   contradict it** — the Bombay Stock Exchange clip reads `1956` because its
   description mentions the year the BSE was recognised. Shown only on the
   watch page, attributed as "mentioned in description", never on cards.
3. **Duration does not exist** in any record. Fetching it would cost roughly
   1,800 additional API units.
4. **Subject tags are noisy.** The BSE clip carries *Railway · Fort · Bazaar*.
   Rule-based tagging over 34 closed tags; no per-clip correction pass.
5. **Foreign clips with no gazetteer row read as Indian.** A Helsinki commuter
   train has `placeId: null`, and `isIndian()` treats null as Indian because
   genuinely unplaceable wildlife footage also has null. Such clips can rank in
   an India-only feed.
6. **~58% admission rate.** 53,109 crawled records carry neither a place nor a
   subject and are unreachable. Not a bug, but it bounds what the archive can
   answer.

### Ranking and search

7. **Meenakshi stays at 30% p@20, by decision.** Of 53 clips mentioning it, 29
   are the politician Meenakshi Lekhi and 2 are the temple. Excluding Lekhi
   raises `/search` but starves the personalised feed below its threshold and
   drops it to generic. Archive composition, not a ranking defect. Only the
   actress (Seshadri, both spellings) and Kailash Kher are excluded, and only
   for the bare one-word query.
8. **Same-name collisions are handled case by case, not systematically.** Two
   gazetteer rows were removed outright (Kailash → the singer; Hong Kong → a
   stuntman's biography) and two names are filtered at search time. There is no
   general mechanism, so the next collision will surface the same way — by
   someone noticing a wrong result.
9. **`Mount Kailash` falls through to the generic feed.** 41 clips match
   exactly, which lands just under the 40-clip personalisation threshold after
   filtering. Honest behaviour at the margin; the threshold is a one-line
   change if it should be lower.
10. **`indiaFirst` orders within the current page**, not the whole result set,
    so a later page can still lead with foreign footage.
11. **Rarity-scaling, whole-phrase matching and accumulated boosts are
    recommender-only, deliberately.** They exist to blend competing signals;
    a single search query has none, and BM25's IDF already handles rarity.

### Product and platform

12. **The channel's 20,000-item API ceiling.** The uploads playlist caps at
    20,000 regardless of quota; coverage beyond that came from crawling 1,253
    individual playlists. A platform limit, not something to engineer around.
13. **Every route is server-rendered on demand**, because the layout reads the
    taste cookie to choose the nav label. `/subjects` and `/places` were static
    before; moving that read client-side would restore it.
14. **The mobile no-autofocus guard is unverified on a real device.** The
    `(pointer: fine)` check is correct, but the preview browser is desktop
    Chrome at a phone width and always reports `fine`, so the touch path has
    never actually executed.
15. **Re-tuning pre-fills but does not explain.** The five fields open with
    previous answers; there is no indication of what those answers produced.

---

## Repository state

All work sits on `archive-discovery`, and `main` is now fast-forwarded to the
same commit. **There is no git remote configured**, so nothing has been pushed
anywhere — `git remote -v` is empty and there are no remote refs. Adding an
origin and pushing is a separate, deliberate step.
