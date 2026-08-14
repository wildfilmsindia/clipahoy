# Clipahoy — current state

A single place to read where the product stands. Not an audit: AUDIT.md holds
the investigation and its evidence. This is what is true today.

Last updated: 2026-08-14 · `archive-discovery` (ahead of `main`).

---

## What the product is

A personalised front door to the Wilderness Films India archive. A first-time
visitor answers a set of typed questions; the answers are resolved against the
archive's own vocabulary and turned into a ranked feed. Search, subject and
place browsing sit alongside it as the non-personalised way in.

Route map:

| Route | What it does |
|---|---|
| `/` | Onboarding for a new visitor, personalised feed once answered, generic feed if skipped |
| `/start` | The same questions on a stable URL, pre-filled for re-tuning |
| `/search` | BM25 free-text search with subject and place facets |
| `/subjects`, `/subject/[slug]` | Browse the 34-tag vocabulary |
| `/places`, `/place/[slug]` | Browse by town and state |
| `/clip/[id]` | Watch page — the only route that ever mounts a player |

---

## The onboarding questions

Fifteen questions, all free text. `interpret.ts` resolves answers against
places, states, regions, terrains and the closed subject vocabulary; anything
it does not recognise becomes a BM25 search term rather than being discarded.

| # | Question | Kind | What it contributes |
|---|---|---|---|
| 01 | Where did you grow up? | place | Place or state signal, autocompleted from the gazetteer including historical names (Bombay, Calcutta) and short forms (Bengal, Orissa) |
| 02 | Where are your parents from? | place | Second place signal |
| 03 | Where did you go to school? | place | Place **plus an implied `school` tag** (1,341 clips), so "Shimla" returns Bishop Cotton and St Bede's rather than the Mall road |
| 04 | Which part of India would you most like to explore? | region | Compass region — the coarsest signal in the set |
| 05 | What is your favourite food? | topic | `street food` tag plus free text |
| 06 | What is your favourite animal? | topic | `wildlife` tag plus the named species as a search term |
| 07 | What is your favourite place in India? | place | Third place signal |
| 08 | What is your favourite festival? | topic | `festival` tag plus the named festival |
| 09 | What is your favourite flower? | topic | `flowers` tag plus the named species |
| 10 | What is your favourite bird? | topic | `birds` tag plus the named species |
| 11 | What is your dream wildlife experience? | open | Unguided — no autocomplete, reaches ranking through BM25 alone |
| 12 | What is your favourite season? | topic | `monsoon`/`snow` tags plus the season word |
| 13 | What is your favourite Indian city? | place | Fourth place signal |
| 14 | What is one Indian tradition you love? | open | Unguided |
| 15 | What are you interested in — music, dance, cinema, sport, culture? | topic | `music`/`dance`/`sport` tags plus free text |

`kind` drives behaviour, not labelling: place and state do gazetteer lookups,
region resolves compass words, `topic` is a narrow subject question, `open` is
deliberately unguided. Landscape words are read out of the first four but not
out of `topic` — "seafood" should not resolve to a coastline.

Autocomplete for the topical questions is a fixed list carried on the question
itself in `taste.ts`; places and states come from the archive at request time.

**Five of the fifteen are place-type**, which outweighs any single typed
phrase, so two slots in the opening feed row are reserved for what was typed
rather than relying on the weights landing correctly. Measured with all fifteen
answered, the non-place signals reach 8 of the 9 opening cards.

Every example chip is run through the recommender before shipping. All 60
current chips return on-topic footage and none fall through to the generic
feed. Four were dropped in earlier rounds for returning nothing or the wrong
thing: **Seafront roads** (led with a Casablanca corniche), **Tram lines**
(resolved to `bus`, returned Delhi bus stops), **Steam engines** and **Fish
curry** (13 clips).

**Known concern: length.** Fifteen questions is roughly three to four minutes,
against the 30–60 seconds the flow was designed for. Every question is
skippable and the recommender works from partial answers, but nobody has
watched a real visitor go through all fifteen. Worth measuring before treating
the count as settled.

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
| Channel total (`channels.list` `videoCount`) | 126,221 |
| Rows in the crawl cache | 126,648 |
| Distinct videos crawled | 88,283 (70% of the channel) |
| Clips indexed and reachable | **73,525** (83.3% of distinct) |
| Clips with a place | 58,473 (79.5%) |
| Clips with at least one subject tag | 61,542 (83.7%) |
| Clips with a year | ~27.3% — see caveat below |
| Gazetteer places | 231 (185 India, 46 outside) |
| States represented | 73 |
| Places browsable in the UI (town-level, ≥20 clips) | 123 |
| Subject vocabulary | 34 tags, closed |

A clip is admitted if it has a place **or** a subject. The excluded remainder
is mostly records with neither; 468 were rejected outright as deleted/private
placeholders, which is the only content rejection rule still active.

Row count exceeds distinct videos because a video legitimately appears in
several playlists; dedup is by `snippet.resourceId.videoId` and first
occurrence wins. Verified 2026-08-14 against `channels.list`, after a Studio
Analytics screenshot scoped to "last 28 days" suggested a much smaller channel:
the crawl and index were correct, the screenshot was filtered.

## Keeping it current

    npm run ingest -- --since             # fetch new uploads, re-extract
    npm run ingest -- --since --dry-run   # report what it would add

Walks the uploads playlist newest-first and stops after 100 consecutive
already-known ids. The channel uploads roughly 17–18 videos a day. Measured
costs: **6 quota units** to catch up a week (124 videos), **3 units** when
already current, against a 10,000/day free tier.

**Append-only, deliberately.** It notices new videos. It does not notice videos
deleted or made private after caching, because that needs re-checking all 88k
known ids rather than watching the front of one list. The index therefore
drifts slowly as clips come down — an accepted limitation, listed below.
Reaching the ~38,000 videos beyond the 20,000-item uploads window is a separate
problem this does not address; see AUDIT.md §A.

---

## Left unfixed, documented

Ordered roughly by how much it would matter to fix.

### Data and accuracy

1. **Year is unreliable and stays hidden.** Present on 27.3% of clips and
   scraped from description prose, not a filming-date field. Where it can be
   checked against a decade named in the same text, **30.9% of values
   contradict it** — the Bombay Stock Exchange clip reads `1956` because its
   description mentions the year the BSE was recognised. Shown only on the
   watch page, attributed as "mentioned in description", never on cards.
2. **Duration does not exist** in any record. Fetching it would cost roughly
   1,800 additional API units.
3. **Subject tags are noisy.** The BSE clip carries *Railway · Fort · Bazaar*.
   Rule-based tagging over 34 closed tags; no per-clip correction pass.
4. **Foreign clips with no gazetteer row read as Indian.** A Helsinki commuter
   train has `placeId: null`, and `isIndian()` treats null as Indian because
   genuinely unplaceable wildlife footage also has null. Such clips can rank in
   an India-only feed.
5. **Sync drift from takedowns.** `--since` is append-only, so a video deleted
   or made private after it was cached stays in the index until a full
   re-extract. Detecting removals means re-checking every known id (~1,770
   units per pass at 50 ids/unit), not watching the front of one list. Accepted
   for now; revisit if dead clips become visible in the product.
6. **14,290 crawled videos are unreachable.** They carry neither a place nor a
   subject, so nothing in the product can surface them: 88,283 distinct videos
   crawled, 73,525 indexed, 468 rejected as placeholders. Not a bug, but it
   bounds what the archive can answer.

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
10. **Rarity-scaling, whole-phrase matching and accumulated boosts are
    recommender-only, deliberately.** They exist to blend competing signals;
    a single search query has none, and BM25's IDF already handles rarity.

### Product and platform

11. **The channel's 20,000-item API ceiling.** The uploads playlist caps at
    20,000 regardless of quota; coverage beyond that came from crawling 1,253
    individual playlists. A platform limit, not something to engineer around.
12. **The mobile no-autofocus guard is unverified on a real device.** The
    `(pointer: fine)` check is correct, but the preview browser is desktop
    Chrome at a phone width and always reports `fine`, so the touch path has
    never actually executed.
13. **Re-tuning pre-fills but does not explain.** The five fields open with
    previous answers; there is no indication of what those answers produced.

---

## Repository state

All work sits on `archive-discovery`, and `main` is now fast-forwarded to the
same commit. **There is no git remote configured**, so nothing has been pushed
anywhere — `git remote -v` is empty and there are no remote refs. Adding an
origin and pushing is a separate, deliberate step.
