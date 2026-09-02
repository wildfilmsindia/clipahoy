# Clipahoy — current state

A single place to read where the product stands. Not an audit: AUDIT.md holds
the investigation and its evidence. This is what is true today.

Last updated: 2026-08-25 · `archive-discovery` (ahead of `main`).

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
| `/explore` | The archive's front page — the same for everyone, and where the logo goes |
| `/shared` | Someone else's curated feed, rebuilt from the answers in the link |
| `/about` | About us, mirroring wildfilmsindia.com/about minus "Our People" |
| `/contact` | Contact, mirroring the main site's contact section and posting to the same inbox. Accepts `?subject=` so the clip page can name the clip being enquired about |

**One page container.** `.shell` (max 1600px) is the only place the page width
is declared. Header, footer, `not-found` and `error` each hard-coded
`max-w-[1400px]`; below a 1400px viewport the two agree, which is why it went
unnoticed, but above it the logo and footer sat 100px further in than the
heading they were meant to align with. Measured at 1800px: logo 232px vs
heading 132px, now 132px for all three.

**`.field` is the form control.** `.taste-field` is a hero line of display type
and belongs only to onboarding; ordinary forms use `.field`, which carries the
same accent focus ring the rest of the site uses, plus `:disabled` and
`[aria-invalid]` states. The contact form was briefly hand-rolling these as a
concatenated class string, which is the thing the design system exists to stop.

**Licensing enquiries stay on the site.** "License footage", the search-results
footnote and the clip page's "Enquire" all used to open
wildfilmsindia.com/contact in a new tab. They now go to `/contact`, which posts
to the same inbox; from a clip page the subject arrives prefilled with that
clip's title, so nobody has to describe which of 108,000 clips they meant. The
one remaining outbound link (Wilderness Films, in the footer) is marked with an
icon and an "opens in a new tab" note.

---

## The onboarding questions

Ten questions, all free text. `interpret.ts` resolves answers against places,
states, regions, terrains and the closed subject vocabulary; anything it does
not recognise becomes a BM25 search term rather than being discarded.

| # | Question | Kind | What it contributes |
|---|---|---|---|
| 01 | Where were you born? | place | Place or state signal, autocompleted from the gazetteer including historical names (Bombay, Calcutta) and short forms (Bengal, Orissa) |
| 02 | Where are your parents from? | place | Second place signal |
| 03 | Where did you go to school? | place | Place **plus an implied `school` tag** (1,341 clips), so "Shimla" returns Bishop Cotton and St Bede's rather than the Mall road |
| 04 | Which part of India would you most like to explore? | region | Compass region — the coarsest signal in the set |
| 05 | What is your favourite food? | topic | `street food` tag plus free text |
| 06 | What is your favourite animal? | topic | `wildlife` tag plus the named species as a search term |
| 07 | What is your favourite festival? | topic | `festival` tag plus the named festival |
| 08 | What is your favourite flower? | topic | `flowers` tag plus the named species |
| 09 | What is your favourite bird? | topic | `birds` tag plus the named species |
| 10 | What is your favourite season? | topic | `monsoon`/`snow` tags plus the season word |

Five questions were cut from the earlier set of fifteen: *favourite place in
India*, *dream wildlife experience*, *favourite Indian city*, *one Indian
tradition you love*, and *what are you interested in*. The three place
questions that remain are the ones tied to a person's own history; the cut
ones asked for preferences the archive answers less distinctively, and the two
`open` questions went with them, so every question is now `place`, `region` or
`topic`. `TASTE_VERSION` went to 7, which retires any cookie holding answers to
the removed ids.

`kind` drives behaviour, not labelling: place and state do gazetteer lookups,
region resolves compass words, `topic` is a narrow subject question. Landscape
words are read out of the place and region questions but not out of `topic` —
"seafood" should not resolve to a coastline.

Autocomplete for the topical questions is a fixed list carried on the question
itself in `taste.ts`; places and states come from the archive at request time.

**Nothing under a question names a specific answer.** Each question used to
carry a support line and four example chips ("Kerala", "Punjab", "Bengal",
"Tamil Nadu"). Four concrete nouns sitting under every field read as the
permitted set rather than as hints, which is the opposite of what these
questions want. Both are gone; in their place is one line naming the *shapes*
of answer that work — "A town, district, state, village, or any place you
remember…". It is rendered as visible text rather than as the field's
placeholder because these run to eighty-odd characters and the field is a
single line of 2rem display type, which clipped them mid-sentence. Typed
suggestions still appear once someone starts typing.

**The feed is a set of playlists, one per answer.** Each answered question
gets its own labelled row of **at most five clips** — fewer when that is all
the archive genuinely holds, never more. Rows appear in the order the questions
were asked, so the page reads as a tour of what the visitor said. There is no
mixed feed and no discovery padding: every clip on the page traces to one
answer. Measured with all ten answered: 10 rows, 50 clips, every row full,
zero duplicates across rows. (The equivalent figure on the earlier
fifteen-question set was 15 rows, 75 clips, 100% on-topic.)

**Rows are diversified by shoot.** A day's filming produces fifteen or twenty
clips of one location, and their titles repeat, so straight relevance order
gave five clips of one afternoon: every biryani row was the Nizamuddin haleem
stall, every Kerala row a backwater houseboat. Two guards run over the
already-eligible candidates — pairwise title overlap, which catches
near-identical captions, and a cap of two on any one distinctive word, which
catches a shoot whose titles are worded differently but keep naming the same
thing. Words the visitor asked for are exempt: "biryani" is expected in every
title of a biryani row and is not evidence of repetition. Both guards relax in
passes so a genuinely repetitive subject still fills its row. Measured on the
earlier fifteen-answer set, worst pairwise similarity within any row is 0.33 and Kerala
now spans backwaters, coast, beach, a Cochin ferry and a lagoon.

**Nothing repeats across the page.** De-duplication spans every row, so a clip
shown under one answer never reappears under another.

**A curated feed can be shared.** The homepage has promised "curate your own
India and share a virtual tour of your very own journey" for some time with no
way to do it. The feed is a pure function of the answers, so the answers *are*
the shareable object: they travel base64url-packed in the link, positionally
rather than as JSON, which puts a full ten-answer share at 126 characters —
short enough that WhatsApp will not truncate it. There is no stored record, no
account, and nothing to expire.

`/shared` renders the same `PersonalFeed` as `/`, differing only in its
masthead ("Their India") and its call to action ("Curate your own India").
Opening someone's link deliberately ignores the visitor's own cookie and never
writes one, so a shared India cannot silently re-personalise itself or
overwrite what the visitor curated for themselves. Link previews carry the
person's actual answers — "Curated from Kerala · Rajasthan · biryani" — and the
route is `noindex`, since a share is one person's answers rather than a page
worth indexing, and there are unlimited variants of it.

Malformed links fail to an explanation and a way in, never a 404: a stale
version prefix, junk, an empty parameter and a missing one all land on "This
link didn't open". A link truncated in transit still renders whatever answers
survived, which is a better outcome than an error page for something a friend
sent.

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

**Someone talking ABOUT a thing is not footage OF it.** Searching "bird"
returned, at number one, a celebrity interview — "Malika Arora talks on Macao
bird 'This is not an ordinary bird…'" — above 4,538 clips of actual birds,
because the word appears twice in the title and titles count triple. The clip is
tagged `wildlife, birds`, so no subject filter would have caught it either; the
tagger read the word too.

The fix is not a Bollywood blocklist. This archive's value is footage, and press
meets, interviews, film launches and quoted statements are all people speaking to
camera. 1,984 clips, 1.83%, scored at **0.3×**.

Two escape hatches, because a demotion that cannot be switched off is a filter:

- **Naming something turns it off.** Measured across the archive, plain nouns
  score low on term rarity — festival 0.40, bird 0.61, dance 0.61, monsoon 0.81 —
  while names sit high: malaika 1.60, emraan 1.60, rupin 1.50, arora 1.50. Any
  query term at or above **1.15** means the person or thing IS the subject, and
  the penalty is skipped. This is literally the rule "no Bollywood unless you
  mention their name".
- **Asking for the format turns it off.** Otherwise "press conference" ranked a
  protest to "press for rollback of constitutional amendments" above actual
  press conferences.

A flat penalty was tried first and was wrong, on reasoning that sounded right:
"a name is rare, so nothing competes with it." That only holds for names
appearing once. For anyone the archive covers repeatedly it failed badly —
"Rupin Dang rhododendron" put the founder himself at rank 79 of 95, "Asiatic
lions Gujarat" at 111 of 113, "Dalai Lama compassion" past rank 500. All three
are now in the top ten. Benchmark queries `talkinghead-1..3` lock both
directions in.

Note this demotes legitimate interviews too — a Kumaoni forager, an avalanche
instructor, the Dalai Lama — and that is intended rather than overlooked. They
are still talking heads, they are demoted rather than removed, and naming any of
them brings them straight back.

**Tags outrank category words within the on-topic set.** Both count as evidence,
but they are not equal, and the difference answers a whole family of wrong-sense
matches. A species name is often a modifier inside a *different* species' name:
"Rose-ringed Parakeet" under *favourite flower*, "Orange Minivet" under
*favourite food*, "Formosan Swift butterflies" under *favourite bird*. Every one
is tagged for what it actually is — `birds`, not `flowers` — so the tags already
know the answer where the title text does not. Clips the tags agree with lead;
the rest are demoted rather than dropped, because a correct clip is not always
tagged.

**A wrong sense with nothing to redeem it returns nothing.** "Jaguar" under
*favourite animal* used to return Indian Air Force Jaguar fighter jets and a
Connaught Place car showroom — four clips, no cat — because the evidence rule
only asks whether the word is in the title. When a context question finds
nothing on topic, the row is now empty, which is the judgement the Nowruz rule
already makes for the archive as a whole.

With one exception, found by probing rather than by reasoning: a **multi-word**
answer whose every word is in the title is evidence in its own right. The strict
rule threw away "Chicken butter masala - made in Bangalore" for the answer
"butter chicken", because that clip carries no subject tags and its title uses
no food-category word. The context vocabulary cannot list every dish, bird and
bloom in India, so it must not be the only way to qualify. One ambiguous noun is
not the same evidence as two words landing together.

**Some questions carry `aliases`** — a correctly-spelled word this archive
writes differently. "Fall" under *favourite season* returned Jog Falls and
Kynrem Falls, four waterfalls and no autumn, because `fall` retrieves 500
waterfall clips here and `autumn` retrieves the Chinar trees in Kashmir and a
Garhwal morning. `fall → autumn`, `rains/rainy → monsoon`. Applied per word and
only for its own question; what the visitor typed is still shown back to them.

**Structural fallbacks are ranked, not just filtered.** When an answer yields no
title or place evidence, a state, subject or region tag can still fill the row —
but these used to return `getAllClips().filter(...)`, which is *archive order*.
"A small village near the sea" led with Shabana Azmi discussing a 2004 film and
a Vistara flight to Bagdogra, both merely tagged `village`. Sorting the same
candidates by how much of the answer their titles carry — weighted by term
rarity, so "sea" counts for more than "small" — now returns a village near
Bandipur, a Himalayan settlement near Gangotri and fishing boats on the Arabian
Sea.

**Real names are never "corrected".** Spelling repair is frequency-based, which
cannot tell a misspelling from a correct word the archive simply does not cover.
"Paris" appears fewer than four times, so it was eligible for repair, and "pari"
— Pari Tibba, a hill above Mussoorie — is one edit away and far commoner.
Answering "Paris" returned Pari Tibba sunsets and Plaster of Paris. Every word
in the gazetteer's place names and the closed subject vocabulary is now left
exactly as typed; real typos (`keralla`, `elefant`, `biriyani`, `hornbil`) still
correct as before.

**The match-reason label uses corrected spelling too.** It did not, so a typo'd
answer was badged "from the description" on clips whose titles plainly carried
the word — the retrieval was right and the explanation of it was wrong. Both
paths now share one `evidenceNeedles()`.

**A place name inside a dish is not a place.** "Shimla mirch" is capsicum.
Matching "shimla" on its own resolved the hill station, and because a
Shimla-tagged street-food clip is on topic for *favourite food* while "Shimla
Mirch or Capsicum" is not — "capsicum" being absent from the food vocabulary —
the row came back as one kebab filmed in Shimla, beating all seven capsicum
clips. On a `topic` question a place name must now cover the WHOLE answer before
it is believed, which is the same rule the terrain words already followed
("seafood" must not resolve to a coastline). `notWords` also applies inside the
multi-word escape hatch, so the same answer no longer returns "Capsicum Shimla
mirch **farming**" either.

**Foreign footage no longer leaks into an India feed.** `isIndian(null)` returns
true, because an untagged clip is usually a close-up of a bird with no place to
give — but 21,566 clips carry no place and a few hundred are plainly abroad. So
"winter" returned a commuter train in Helsinki and "spring" reached Keukenhof in
the Netherlands. `isIndianClip()` excludes an unplaced clip whose title names a
distant country, unless the title also names India or an Indian place. **329
clips, 0.3%.**

Three things were learned by checking the exclusions rather than trusting the
rule:

- Building the list from the gazetteer's own non-India entries was **worse**. It
  keys on nationality adjectives and flagged "Japanese Flowering Quince" (grown
  here), "Kalimpong rafting with Nepali friends" (Kalimpong is in Bengal) and
  the Dalai Lama at Tabo.
- **Turkey tail is a fungus.** The country cost three woodland clips before the
  list was checked against what it actually removed. Istanbul and Ankara stay,
  and still catch all nine genuinely Turkish clips.
- **Sydney Point is at Panchgani, Maharashtra**, and the gazetteer holds only
  186 Indian places, so nothing was left to rescue it. The India signal also had
  to learn "Indo-", which `\bindia\b` does not match.

Nepal, Bhutan, Sri Lanka, Bangladesh, Pakistan, Tibet and Myanmar are
deliberately absent from the list: the archive is India *and her neighbours*.

**Adding words to a query no longer empties it.** The majority rule stops a
two-word query being answered by clips matching only its commonest word, but
applied rigidly it fell off a cliff: "Kolkata tram" found 58 clips and "Kolkata
tram monsoon railway" found **one**, because three of those four words now had
to appear together. Eight unrelated words found nothing at all. Search now
relaxes the requirement a step at a time until it has at least 8 results — and
this costs nothing, because the postings are already walked and the per-document
match counts are in hand, so lowering the bar re-filters a map that already
exists. The eight-word query now returns 91 clips led by "Trams moving in the
streets of Kolkata". It cannot affect queries that already work: it only fires
below 8 results, and the benchmark is unchanged at 99.5%.

**Out-of-range pages are clamped, on all three paged routes.** `?page=999999`
sliced past the end of the results and rendered an **empty grid under a header
still claiming 2,840 results** — the one failure that reads as "the search is
broken" rather than "the list ran out". `/subject/[slug]` and `/place/[slug]`
had it worse: a completely blank page, no hero, no grid, no explanation. Pages
are now floored (`?page=2.7` sliced from a half-offset straddling two pages) and
clamped to the last real page. URLs are editable and crawlers invent deep pages,
so clamping is right where a 404 would not be.

`searchPage()` was deleted rather than fixed — it had the same off-range flaw
and no callers anywhere in the app.

**Singular and plural were in different buckets.** The stemmer stripped "es"
from anything and "s" from everything else, which broke two whole classes of
word. "Horses" became "hors" while "horse" stayed "horse", so they never met;
"glass" became "glas" while "glasses" became "glass", so the singular was
stemmed *further* than its own plural. Measured overlap between the result sets:

| | overlap before | after |
|---|---|---|
| horse / horses | 11% | 100% |
| house / houses | 4% | 100% |
| glass / glasses | 2% | 100% |
| dress / dresses | 1% | 100% |

Now Porter's step 1a minus the syllable measure: "-ss" is protected, "-sses" and
the epenthetic "-xes/-ches/-shes" lose the whole "es", everything else loses
only the "s". A short exception table handles the plurals no suffix rule can
reach — men, women, children, buses, leaves, mice. Fifteen singular/plural pairs
now overlap 100%, and the recall gain is large in a documentary archive about
people: `woman` went from 1,883 clips to 6,565, `child` from 763 to 2,870.

`INDEX_VERSION` exists for exactly this and had to be bumped twice. The terms on
disk were produced by the tokeniser of the day, so a stemmer fix with the
version left alone loads a stale index and **silently does nothing** — correct
code, unchanged behaviour.

**The spelling repair judged "known" against the wrong vocabulary.** The index
is keyed by stems, so a word whose stem differs from itself has no entry under
its own spelling and looks unknown however common it is. "Iris" is stored as
"iri", `df.get('iris')` was 0, and the repair turned the flower into **"Irish"**
— one edit away and far commoner. The feed then looked for "irish" in the titles
and threw away all five Iris clips. Every singular ending in -s was exposed:
iris, gas, lens, campus, virus, atlas. "Known" is now tested against the stemmed
form too. This was a latent bug the stemmer work exposed rather than caused, and
the answer probe is what caught it.

**Question words counted as content.** "How do they make jaggery" returned
Pipistrelle bats and Himalayan butterflies. `how`, `do` and `they` were being
treated as search terms, so five terms meant three had to appear together — and
"How do they get rhythm and percussion so right?" satisfies three of them while
"Making Jaggery Punjabi style" satisfies one. Searching `jaggery` alone finds 96
clips. STOPWORDS now covers question words, auxiliaries, pronouns and
quantifiers; the query returns jaggery, "what is holi" returns Holi, "where is
the taj mahal" returns the Taj Mahal.

Words that could name something on screen were deliberately left out: `make`
and `making`, `can` (an oil can), `may` (the month), and `up`/`down`/`out`/
`over`/`under`, which describe position — "sunrise over the mountains" and
"water from a well" still return exactly what they should. `no` and `not` ARE
stopwords: there is no negation to honour, so "not tigers" is best read as
"tigers". The index shrank from 46.0 MB to 43.5 MB.

**Adjacency is now worth something.** BM25 is a bag of words and cannot tell
"Republic Day" the name from "Day" and "1997" in different halves of a sentence.
The archive holds no Republic Day 1997 footage, so both a Manipur observance
("…Day in Manipur - 1997") and a real Republic Day clip satisfied two of three
words, and "1997" being rarer than "republic" won the tie. Most multi-word
answers here are names — Republic Day, Kumbh Mela, Dal Lake, Chandni Chowk — and
adjacency is what makes them names. Titles containing a query bigram get a 35%
bonus, applied to the top 400 only: a clip far down on BM25 cannot reach the
first page on a 35% nudge, so scoring the tail buys nothing. Substring matching
rather than positional postings, because the index stores frequencies and adding
offsets would grow it for a tie-breaker.

**The search box knew nothing about alternate names.** `interpret.ts` has
resolved "Bombay" to Mumbai for the onboarding feed all along, but `/search`
did not, so the box found only the clips that spelled it the old way. One fact,
applied in one place and not the other.

| | before | after |
|---|---|---|
| Mumbai / Bombay | 15% overlap | 100% |
| Kolkata / Calcutta | 18% | 100% |
| Chennai / Madras | 14% | 100% |
| Prayagraj / Allahabad | 4% | 100% |
| puja / pooja | 4% | 100% |

`PLACE_ALIASES` is now exported and shared rather than duplicated, and a short
`WORD_SYNONYMS` table covers transliteration variants — pooja/puja,
deepavali/diwali, gurdwara/gurudwara, masjid/mosque, mandir/temple, saree/sari.
Every pair was counted in the corpus before being added; "riksha" was dropped
for having one clip against 936 for "rickshaw". Searching "Bombay" now reaches
3,511 clips instead of 955.

Matching any variant counts as satisfying that query term **once**, not once per
variant — otherwise a title saying both "Mumbai" and "Bombay" would clear the
majority rule on its own.

**"Related footage" ranked on tags and ignored the title.** For a placed clip
the pool is everything from that place — 13,886 clips for Delhi — so the watch
page for "Holi festival of colours" offered Jagannath Rath Yatra and a Kushti
wrestling competition. All three are Delhi clips tagged `festival`, which is the
only thing the ranking looked at. Tags say what *kind* of thing a clip is; the
title says *which one*.

Words now lead and tags break ties, weighted by rarity — sharing "holi" with the
clip being watched means far more than sharing "festival" or "India". Every seed
tested now returns its own subject: Holi returns Holi, the Kerala houseboat
returns houseboats, the 1989 Kolkata tram returns 1989 Kolkata, Kabaddi returns
Kabaddi.

The first version of this called `tokenise()` on every candidate title, which
allocated an array and a Set for each of Delhi's clips and took **579ms** on one
watch page. Raw substring tests against a lowercased title give the same
comparison in 5–13ms; the slowest case is an unplaced clip, whose pool is every
clip sharing a subject tag, at 54ms.

**The browse pages were still judging India by the tag.** `isIndianClip` reads
the title for unplaced clips, and the feed used it — but `indiaFirst`, which
orders the subject pages, was still calling `isIndian` on the place id alone.
So the `railway` page opened with a Sahibabad Junction train and then "Winter
train journey through **Helsinki, Finland** on the HSL Commuter Railway", second
on the page. Twelve subject pages now check clean in their first thirty.

**A tile labelled Flowers showed plastic waste.** `coverForSubject` took the
first clip not already used by another tile, with no relevance test at all — so
once the better frames had gone, *Flowers* was fronted by "Plastic waste dumped
across a green Himalayan hillside", which carries the `flowers` tag. Covers now
prefer a clip whose TITLE says the subject, falling back to the old behaviour
for a subject too thin to offer one, and the candidate pool widened from 24 to
60 so there is something left to choose from after de-duplication. *Flowers* is
now "Blooming Oriental Poppy with emerging flower buds" and *Street food* a
Chole Bhature stall; all 34 tiles still show 34 different frames.

**Card descriptions were being invented.** `describeClip` fell back to a
template built from the clip's FIRST TAG whenever the title was under 20
characters or four words — so "Dubai beach" was displayed as **"Festival in
Dubai"**, which is simply not what the clip shows. 2,444 clips, 2.3% of the
archive, had a real title replaced this way: "Marine Drive, Mumbai", "Pied
Kingfisher trio!", "Wild strawberries", "Train to Kerala", "Coldest Desert -
Ladakh".

The length floor was aimed at camera-slate labels, but the ALL-CAPS test beside
it is what actually catches those — length was only ever a poor proxy. A real
title now always wins, however short. Nine clips still reach the template, every
one a shouted slate label.

`mentionsPlace` also gained a six-character prefix test, because titles and the
gazetteer disagree on spellings and an exact substring match appended a place
the sentence already named: "Ranthambhore, in Ranthambore". Checked across the
gazetteer, exactly one six-char prefix is shared by two places (Madhya Pradesh /
Madhyamaheshwar), where the worst case is skipping a redundant append.

**Place pages ordered on title length, so celebrities led them.** It is a rough
"better documented" proxy, and interview titles are long because they carry a
name and a quote — so Mumbai ran a marathon and then "Dusky Priyanka Chopra
dances, sips champagne at a Mumbai calendar launch", and Goa opened with a
Channel V calendar launch. Talking heads now sink before title length is
considered.

That exposed three gaps in the detector, each measured before being added:
single-name quotes ("Shaan: Film is important…", 6 clips), calendar launches (7
— and "launch" alone is far too broad, since rockets and ships launch too), and
the general shape of the whole class: **a name, a colon, and someone speaking in
the first person** — "Sushmita Sen: I'm an actor" — 304 clips, needing no film
vocabulary at all. The demoted set went from 1,984 to 2,207. Goa now opens with
the beaches at Arambol.

### Search-bar probe

`scripts/probe-search.ts` covers `/search` itself rather than the feed: query
shapes, paging, facets and top-hit relevance.

    npx tsx --conditions=react-server scripts/probe-search.ts

It confirms that empty, whitespace-only, stopword-only, punctuation-only,
Devanagari and emoji queries all return nothing without erroring; that `AND`,
`OR`, `+` and `-` are treated as ordinary words (`and`/`or` are stopwords) since
there is no boolean syntax to honour; that an invalid or wrongly-cased subject
facet yields an empty state rather than a crash; and that paging survives `0`,
`-5`, `abc`, `1.5`, `1e9`, `Infinity` and `NaN`.

Top-hit relevance is **18/18** across realistic queries — taj mahal, varanasi
ghats, sadhu at kumbh mela, snow leopard, backwater houseboat, tribal dance
northeast, monkey temple. Natural phrasing works because stopwords are stripped
first: "old man smoking a hookah in rajasthan" returns "Old village man smoking
Hookah in Rajasthan".

### Answer probe

`scripts/probe-answers.ts` runs 75 deliberately awkward answers through the real
recommender and prints what comes back:

    npx tsx --conditions=react-server scripts/probe-answers.ts [filter]

A reading tool, not a pass/fail test — the failures it finds are wrong senses
and junk rows, which a relevance regex cannot judge but a person can see at a
glance. It covers polysemy (`crane`, `kite`, `swift`, `jaguar`, `iris`, `date`,
`spring`, `fall`), typos, multi-entity answers, whole sentences, out-of-scope
answers (`Paris`, `sushi`, `penguin`, `Nowruz`), junk (`asdfgh`, `12345`,
whitespace, shouting) and cross-border place names.

Round two added polysemy (`bat`, `seal`, `bear`, `palm`, `lily`, `mango`,
`holi`), Hinglish (`paneer`, `roti`, `mela`, `ghat`, `haveli`), input shape
(plurals, possessives, ALL CAPS, Devanagari, an emoji, a single letter,
repetition) and place-names-inside-words (`Nagpur`, `shimla mirch`).

Current state: 10 empty rows, all of them correct. `seal` was checked against
the archive rather than assumed — the only two "seal" titles are the verb
("seal the riverbank", "hornbills seal nesting hollow"), so an empty row is the
honest answer. Two known limits, both left alone deliberately: **Devanagari
input returns nothing**, because the tokeniser keeps `[a-z0-9]` only; and a
multi-word answer needs EVERY word in one title, so "early fall" finds a single
clip. Loosening that would readmit the passing-mention matches the evidence rule
exists to stop.

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

A full fifteen-answer feed rendered in ~1.3s on the dev server, roughly half
that in production; the ten-answer feed does two thirds the work.

Example chips no longer ship — see the onboarding section above. The paragraph
below records what the vetting found while they existed, because it is the
evidence for which answers the archive genuinely covers.

Every example chip was run through the recommender before shipping. All 60
chips returned on-topic footage and none fell through to the generic
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
twelve times, which was the real cost of the old fifteen-question flow — not
the questions themselves.

**Length is no longer the open concern it was.** Fifteen questions ran roughly
three to four minutes against the 30–60 seconds the flow was designed for. Ten
questions is a third shorter, which should land nearer the target, but this is
inference from the count rather than a measurement — nobody has yet watched a
real visitor go through either version.

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

**It fits a serverless platform now.** Two blockers were removed:

| | Was | Now | Vercel Hobby / Netlify limit |
|---|---|---|---|
| Live heap | reported 943 MB | **~150 MB** | 1024 MB |
| Cold start | 7.0 s | **1.1 s** | 10 s |
| Data in bundle | missing | 66 MB traced | 250 MB |

**The 943 MB was a measurement error** — `heapUsed` sampled straight after the
index build, counting garbage the collector had not run on. Forcing a
collection first gives ~150 MB (134 MB archive, 16 MB index). Several sessions
of "this cannot run serverless" rested on that number and were wrong.

Cold start fell to 1.1 s by precomputing the search index at build time
(`data/search-index.bin`, written by a `prebuild` hook) instead of tokenising
108k documents on every boot.

`next.config.ts` names the data files in `outputFileTracingIncludes`, because
`archive.ts` and `search.ts` build their paths at runtime and Next cannot trace
a computed path — that is why the first Netlify attempt crashed with "an
unknown error has occurred". `instrumentation.ts` no longer throws on a bad
archive either; warming is an optimisation and the index builds lazily anyway,
so a data problem now surfaces as a readable error rather than a dead function.

**Cloudflare Workers remains out.** No filesystem, a script-size limit in the
low megabytes, and 128 MB of memory against our ~150 MB. It would need the
search layer ported to D1/SQLite.

## Repository state

All work sits on `archive-discovery`, and `main` is now fast-forwarded to the
same commit. **There is no git remote configured**, so nothing has been pushed
anywhere — `git remote -v` is empty and there are no remote refs. Adding an
origin and pushing is a separate, deliberate step.
