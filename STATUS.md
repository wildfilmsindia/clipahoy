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

**The feed is a set of playlists, one per answer.** Each answered question
gets its own labelled row of **at most five clips** — fewer when that is all
the archive genuinely holds, never more. Rows appear in the order the questions
were asked, so the page reads as a tour of what the visitor said. There is no
mixed feed and no discovery padding: every clip on the page traces to one
answer. Measured with all fifteen answered: 15 rows, 75 clips, **100% on-topic**,
zero duplicates across rows.

**Rows are diversified by shoot.** A day's filming produces fifteen or twenty
clips of one location, and their titles repeat, so straight relevance order
gave five clips of one afternoon: every biryani row was the Nizamuddin haleem
stall, every Kerala row a backwater houseboat. Two guards run over the
already-eligible candidates — pairwise title overlap, which catches
near-identical captions, and a cap of two on any one distinctive word, which
catches a shoot whose titles are worded differently but keep naming the same
thing. Words the visitor asked for are exempt: "biryani" is expected in every
title of a biryani row and is not evidence of repetition. Both guards relax in
passes so a genuinely repetitive subject still fills its row. Measured across
fifteen answers, worst pairwise similarity within any row is 0.33 and Kerala
now spans backwaters, coast, beach, a Cochin ferry and a lagoon.

**Nothing repeats across the page.** De-duplication spans every row, so a clip
shown under one answer never reappears under another.

**Answers are read in the context of their question.** A bare word means
different things depending on what was asked: "crane" under *favourite bird*
returned construction cranes at Paradeep Port, "rice" under *favourite food*
returned paddy cultivation, "hornbill" under *favourite festival* returned the
bird. Each topical question now carries a context — subject tags plus words —
and a clip must match one of them, checked against the **title only** so a
passing mention in a description cannot qualify.

Some questions also carry `notWords`, a named wrong sense that overrides
everything else. This exists because the subject tags are noisy: the Paradeep
port clip is tagged `birds`, so no amount of positive evidence would keep it
out. Naming the wrong sense ("vessel", "shipment", "cargo") is the only
reliable way past a bad tag.

If **any** clip is on topic, only those are shown — even if that means a row of
two. Padding to five with off-topic footage is what produced the cranes and the
paddy fields in the first place.

**A clip only qualifies on evidence.** The answer's words must appear in the
clip's *title* — which in this archive describes what the camera saw — or, for
a place answer, the clip must be tagged with that place. Prose-only matches are
dropped, because a passing mention is not footage. Asking for "Nowruz" used to
return Ladakh polo and a militant attack: all four clips mentioning the word do
so in passing ("festive occasions like Losar and Nowruz"). The archive holds no
Nowruz footage, and an empty row says so honestly where five wrong clips did
not. Across two dozen answers, real subjects keep 15–20 of their top 20 under
this rule; Nowruz was the only one that kept none.

Place answers are ranked by BM25 like everything else. They used to bypass
search and sort tagged clips by a "representativeness" heuristic, which
surfaced whatever happened to carry the tag — Mumbai led with two celebrity
interviews. Ranking by the words gives Kerala houseboats, Varanasi ghats and
Mumbai rush hour.

A full fifteen-answer feed renders in ~1.3s on the dev server, roughly half
that in production.

Every example chip is run through the recommender before shipping. All 60
current chips return on-topic footage and none fall through to the generic
feed. Four were dropped in earlier rounds for returning nothing or the wrong
thing: **Seafront roads** (led with a Casablanca corniche), **Tram lines**
(resolved to `bus`, returned Delhi bus stops), **Steam engines** and **Fish
curry** (13 clips).

**There is a way out of the questions.** For a first-time visitor `/` *is*
the flow, so the logo leads back to it and there was no route to the rest of
the site short of skipping every question one at a time. "Skip all this and
just browse the archive" writes an empty answer set and lands on the generic
feed. The reveal says something different when nothing was answered — claiming
"a sense of your India" from an empty form would be a small lie.

**Browse tiles read over the watermark.** Every thumbnail in this archive
carries a "www.wildfilmsindia.com" watermark across roughly the band where a
tile's label sits, and the scrim only reached 55% opacity there — so subject
names were read on top of a URL. The gradient is now solid under the text and
clear by two-thirds up: the label wins without flattening the frame.

**Grids are denser on wide screens.** Three cards across a 1280px browser left
a video archive looking sparse and pushed most results below the fold. Four
keeps cards comfortably above 280px while showing a third more per screen.

**The watch page's "More from X" rail is ranked.** It used to slice straight
off a place filter with no ordering, so a clip of Goa rice fields opened its
sidebar with two celebrity interviews that merely carried a Goa tag. Ranking by
subject overlap with the clip being watched gives paddy interfaces, Western
Ghats forest and Mandovi mangroves instead.

**Playlist rows are swipeable on a phone.** Five capped picks in a 2-column
grid took three vertical screens per answer at 375px, so a long archive was an
enormous scroll. Below `lg` a row is a snap-scrolling rail that bleeds to the
screen edge, so a cut-off card advertises the gesture; above `lg` it is an
ordinary row of five and the horizontal scrolling disappears.

**You can stop at any point.** Once at least one question is answered, a
"Build it with these N" control appears beside Continue. Before it existed the
only route from question three to your archive was pressing "Skip this one"
twelve times, which is the real cost of a fifteen-question flow — not the
questions themselves.

**Known concern: length.** Fifteen questions is roughly three to four minutes,
against the 30–60 seconds the flow was designed for. Finishing early takes the
edge off, but nobody has watched a real visitor go through it. Worth measuring
before treating the count as settled.

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
| — of those, confirmed gone from YouTube | 457 (tombstoned, excluded) |
| Clips indexed and reachable | **108,148** (85.5% of live) |
| Clips with a place | 86,582 (80.1%) |
| Clips with at least one subject tag | 91,077 (84.2%) |
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

**Append-only, deliberately** — `--since` notices arrivals, never departures.
Departures are handled separately:

    npm run ingest -- --reconcile             # check every cached id, tombstone the gone
    npm run ingest -- --reconcile --dry-run   # report, write nothing

That sweeps all 126,874 ids at 50 per quota unit (**2,538 units, ~11 minutes**)
and writes `data/tombstones.json`. Extraction skips tombstoned ids, so a
deleted or privated video stops reaching the product without the append-only
cache ever being rewritten — it is ~480 MB and, per AUDIT.md §A, cannot be
fully reproduced. A tombstoned id that answers again is automatically revived.

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
5. **Sync drift from takedowns — reconciled 2026-08-19, now a routine.**
   `--since` and `--backfill` are append-only, so departures were invisible.
   `npm run ingest -- --reconcile` now checks every cached id against the API
   and writes `data/tombstones.json`; extraction skips those ids, so a
   departed video stops reaching the product. Full sweep: 126,874 ids, **2,538
   quota units, ~11 minutes, 457 gone**. Only one of the 457 was still
   user-visible — the rest had already failed extraction — so the index went
   108,149 → 108,148. Re-run whenever it matters; there is no automatic
   trigger.

   **A note on the earlier estimate.** This was previously recorded as "1,602
   clips may no longer play", taken from ids absent from the Studio export.
   That was wrong by roughly 3×: checked against the API, **1,145 of those
   1,602 are alive** — the export has gaps and is not a reliable list of what
   is live. Only 457 were genuinely gone, and the full sweep confirmed there
   are no departed videos *inside* the export. Absence from an export is not
   evidence of deletion.
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

0. **`notFound()` returns HTTP 200 in production.** `/clip/nope`,
   `/subject/nope` and `/place/nope` render the correct not-found UI but with a
   200 status; only a route that does not exist at all (`/nowhere`) returns a
   real 404. The pages stream, so the status line is already sent by the time
   `notFound()` runs. This is pre-existing and unrelated to loading states —
   `clip/[id]` has no `loading.tsx` and behaves the same. It matters for SEO:
   a search engine will index a soft-404. **Earlier sessions reported "404s
   intact" from dev-mode checks; the dev server and a production build differ
   here, and only the production build is the truth.**


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

## Deploying

**This app is not serverless-shaped, and Netlify Functions cannot run it.**
Measured on the real index:

| | |
|---|---|
| `data/index.json` | **112 MB** (79.8 MB of it clip prose, 71%) |
| Load + build the BM25 index | **9.8 s** |
| Heap after load | **961 MB** (715 MB RSS) |

A Netlify Function has 1 GB of memory and a 10 s timeout, so a cold start
would exhaust both before serving anything — and the 112 MB file cannot be
bundled into a function in the first place. It is also gitignored, past
GitHub's own 100 MB file limit, so a fresh checkout has no archive at all.
That is why a Netlify upload fails: the build throws on the missing file.
`archive.ts` now says so explicitly instead of surfacing a bare ENOENT.

The architecture is deliberate and fine — a long-lived process loads the index
once and answers from memory. It just needs a host that keeps a process alive:
Render, Fly, Railway, a small VPS. The alternative is moving search to a real
engine (Postgres FTS, Typesense, Meilisearch), which would make it deployable
anywhere but is a rewrite of the search layer, not a config change.

Either way, the data still has to get to the host: it is too big for git, so it
travels as the 35 MB zstd backup or is rebuilt with
`npm run ingest -- --offline` from the cache.

## Repository state

All work sits on `archive-discovery`, and `main` is now fast-forwarded to the
same commit. **There is no git remote configured**, so nothing has been pushed
anywhere — `git remote -v` is empty and there are no remote refs. Adding an
origin and pushing is a separate, deliberate step.
