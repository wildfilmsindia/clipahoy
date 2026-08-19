# Clipahoy — current state

A single place to read where the product stands. Not an audit: AUDIT.md holds
the investigation and its evidence. This is what is true today.

Last updated: 2026-08-19 · `archive-discovery` (ahead of `main`).

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

**The feed is built for breadth, not top score.** The opening picks are drawn
round-robin across every answered question — one clip per answer before any
answer gets a second — so each thing the visitor typed is represented. This
replaced a global top-score pick, which handed all nine opening cards to
whichever answer was rarest: a specific festival swept the row while "peacock"
and "monsoon" produced nothing at all. Measured with all fifteen answered, all
fifteen now appear in the feed and the opening row reads as a tour of the
answers in order.

**Discovery is gated on hit rate.** "Go a little further" (interest matches
from outside the named places) only shows when the direct matches are thin —
few answers, short feed. When the answers already fill the page it is
suppressed, so a rich answer set is not padded with loosely-related footage.

The place-based sections still come from a single structural scoring pass
(place / state / region / subject, no text search), which keeps a full
fifteen-answer feed to a few hundred ms in production. `thin` — the fall-back
to the generic feed — is measured over everything the answers reach, so a
purely free-text set like "Ambassador cars" still personalises.

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

**99.4% precision@20** across 25 fixed queries.

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

The number rose from 97.0% when the archive grew from 73,525 to 108,149 clips:
more real footage dilutes the collisions. "Meenakshi" went 30% → 85% because
the enlarged index finally holds more temple footage than politician mentions.

Two changes were tested and **not shipped** because the benchmark did not move:
BM25 `k1` × `b` across sixteen combinations, and title weight across five
values — all scored identically. The constants are env-overridable
(`BM25_K1`, `BM25_B`, `BM25_TITLE_WEIGHT`) so the sweep is repeatable.

---

## Archive numbers

| | |
|---|---|
| Channel total (`channels.list` `videoCount`) | 126,221 |
| Rows in the crawl cache | 165,239 |
| Distinct videos held | 126,874 (**~100% of the channel**) |
| Clips indexed and reachable | **108,149** (85.2% of distinct) |
| Clips with a place | 86,583 (80.1%) |
| Clips with at least one subject tag | 91,078 (84.2%) |
| Clips with a year | 32,952 (30.5%) — see caveat below |
| Gazetteer places | 233 (186 India, 47 outside) |
| States represented | 74 |
| Places browsable in the UI (town-level, ≥20 clips) | 133 |
| Subject vocabulary | 34 tags, closed |

A clip is admitted if it has a place **or** a subject. The excluded remainder
is mostly records with neither; 468 were rejected outright as deleted/private
placeholders, which is the only content rejection rule still active.

Row count exceeds distinct videos because a video legitimately appears in
several playlists; dedup is by `snippet.resourceId.videoId` and first
occurrence wins. Verified against `channels.list`, after a Studio Analytics
screenshot scoped to "last 28 days" suggested a much smaller channel: the crawl
and index were correct, the screenshot was filtered.

**The API-unreachable third is closed (2026-08-19).** The uploads playlist caps
at 20,000 items and `search.list` does not expose a back catalogue at all, so
crawling alone plateaued at 88,283 distinct videos — 70% of the channel.
Discovery was the only thing ever blocked. Given a Studio export of 125,272
title+id rows, `videos.list` fetched the 38,591 unseen videos at 50 ids per
quota unit: **772 units, zero unavailable, ~5 minutes**. The index went
73,525 → 108,149 clips.

    python3 scripts/parse-studio-export.py <export.xlsx>   # build the id list
    npm run ingest -- --backfill --dry-run                 # report, write nothing
    npm run ingest -- --backfill                           # fetch and re-extract

Backfilled records carry title, description and publishedAt but **no
`playlistTitle`** — they were not found inside a curated playlist, so the
strongest place signal is unavailable for them and they rely on title and
prose. Re-run the parser whenever a fresh export arrives; it only fetches ids
the cache does not already hold.

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
5. **Sync drift from takedowns — now measured at 1,602 clips.** `--since` and
   `--backfill` are both append-only, so a video deleted or made private after
   caching stays in the index. The Studio export makes this countable for the
   first time: 1,602 cached ids are absent from a 125,272-row export of the
   live channel. That is 1.3% of the index pointing at videos that may no
   longer play. Reconciling means re-checking every known id (~2,540 units per
   pass at 50 ids/unit) — cheap enough now that the export gives an exact
   target list. Worth doing next.
6. **18,257 held videos are unreachable.** They carry neither a place nor a
   subject, so nothing in the product can surface them: 126,874 distinct videos
   held, 108,149 indexed, 468 rejected as placeholders. Not a bug, but it bounds
   what the archive can answer.

### Ranking and search

7. **Meenakshi improved to 85% p@20 on its own.** It sat at 30% when the
   archive was 73,525 clips: of 53 mentions, 29 were the politician Meenakshi
   Lekhi and 2 the temple. The backfill added enough real temple footage to
   outweigh the collision without any code change — a reminder that some
   ranking problems are corpus-size problems. The narrow exclusions (the
   actress Seshadri, both spellings, and Kailash Kher, bare one-word query
   only) remain.
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

11. **The channel's 20,000-item API ceiling still applies to discovery.** The
    uploads playlist caps at 20,000 regardless of quota, and `search.list`
    returns nothing useful. Crawling plateaued at 70% of the channel; the rest
    came from a Studio export plus `--backfill`. Any future gap is closed the
    same way — a platform limit worked around, not engineered away.
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
