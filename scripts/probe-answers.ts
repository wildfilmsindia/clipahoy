/**
 * Answer probe.
 *
 * Runs deliberately awkward answers through the real recommender, one question
 * at a time, and prints what comes back. This is a reading tool, not a pass/fail
 * test: the failures here are wrong-sense matches and empty rows, which a
 * relevance regex cannot judge but a person can see at a glance.
 *
 *   npx tsx --conditions=react-server scripts/probe-answers.ts [filter]
 */
import { recommend } from '../src/lib/recommend';
import { QUESTIONS } from '../src/lib/taste';

type Probe = { q: string; a: string; note: string };

const PROBES: Probe[] = [
  // ---- polysemy: the word means something else in another context
  { q: 'bird', a: 'crane', note: 'machine vs bird' },
  { q: 'bird', a: 'kite', note: 'toy/festival vs bird' },
  { q: 'bird', a: 'swift', note: 'adjective vs bird' },
  { q: 'bird', a: 'robin', note: 'personal name vs bird' },
  { q: 'animal', a: 'jaguar', note: 'car vs cat' },
  { q: 'animal', a: 'mouse', note: 'device vs animal' },
  { q: 'flower', a: 'iris', note: 'eye vs flower' },
  { q: 'flower', a: 'jasmine', note: 'name/tea vs flower' },
  { q: 'flower', a: 'rose', note: 'past tense vs flower' },
  { q: 'food', a: 'rice', note: 'paddy farming vs a plate' },
  { q: 'food', a: 'orange', note: 'colour vs fruit' },
  { q: 'food', a: 'date', note: 'calendar vs fruit' },
  { q: 'season', a: 'spring', note: 'water spring vs season' },
  { q: 'season', a: 'fall', note: 'falling vs autumn' },
  { q: 'festival', a: 'hornbill', note: 'bird vs Nagaland festival' },
  { q: 'festival', a: 'kite', note: 'bird vs kite festival' },

  // ---- polysemy, round two
  { q: 'animal', a: 'bat', note: 'cricket bat vs mammal' },
  { q: 'animal', a: 'seal', note: 'seal stamp vs mammal' },
  { q: 'animal', a: 'bear', note: 'verb vs animal' },
  { q: 'animal', a: 'tiger', note: 'beer/bank vs cat' },
  { q: 'flower', a: 'palm', note: 'hand vs tree' },
  { q: 'flower', a: 'lily', note: 'name vs flower' },
  { q: 'food', a: 'mango', note: 'Mango bird vs fruit' },
  { q: 'bird', a: 'mango bird', note: 'two words, a real bird' },
  { q: 'festival', a: 'holi', note: 'prefix of holiday' },
  { q: 'grewup', a: 'Nagpur', note: 'contains "nag"' },
  { q: 'food', a: 'shimla mirch', note: 'place name inside a vegetable' },

  // ---- Hinglish and transliteration
  { q: 'food', a: 'paneer', note: 'hinglish' },
  { q: 'food', a: 'roti', note: 'hinglish' },
  { q: 'festival', a: 'mela', note: 'hinglish, very common word' },
  { q: 'explore', a: 'ghat', note: 'hinglish landform' },
  { q: 'grewup', a: 'haveli', note: 'hinglish building' },

  // ---- shape of the input
  { q: 'animal', a: 'elephants', note: 'plural' },
  { q: 'bird', a: "birds'", note: 'possessive apostrophe' },
  { q: 'flower', a: 'ROSES', note: 'caps + plural' },
  { q: 'food', a: 'बिरयानी', note: 'Devanagari' },
  { q: 'animal', a: '🐘', note: 'emoji only' },
  { q: 'grewup', a: 'a', note: 'single character' },
  { q: 'season', a: 'winter winter winter', note: 'repetition' },

  // ---- aliases: right idea, word the archive does not use
  { q: 'season', a: 'rainy season', note: 'alias -> monsoon' },
  { q: 'season', a: 'the rains', note: 'alias -> monsoon' },
  { q: 'season', a: 'early fall', note: 'alias inside a phrase' },

  // ---- common, high-frequency answers (the easy path must stay good)
  { q: 'bird', a: 'peacock', note: 'national bird' },
  { q: 'animal', a: 'cow', note: 'livestock vs wildlife' },
  { q: 'flower', a: 'tulip', note: 'Kashmir tulip garden' },
  { q: 'food', a: 'butter chicken', note: 'two-word dish' },
  { q: 'food', a: 'chai', note: 'ubiquitous' },
  { q: 'festival', a: 'Christmas', note: 'non-Hindu festival' },
  { q: 'festival', a: 'Eid', note: 'short word, non-Hindu' },
  { q: 'grewup', a: 'Ladakh', note: 'region as birthplace' },
  { q: 'explore', a: 'south', note: 'bare compass word' },

  // ---- typos
  { q: 'grewup', a: 'keralla', note: 'typo' },
  { q: 'grewup', a: 'rajastan', note: 'typo' },
  { q: 'animal', a: 'elefant', note: 'typo' },
  { q: 'food', a: 'biriyani', note: 'common alt spelling' },
  { q: 'bird', a: 'hornbil', note: 'typo' },
  { q: 'explore', a: 'himalyas', note: 'typo' },

  // ---- multi-entity
  { q: 'animal', a: 'cats and dogs', note: 'idiom trap' },
  { q: 'food', a: 'tea and coffee', note: 'two drinks' },
  { q: 'flower', a: 'lotus, rose and marigold', note: 'three flowers' },
  { q: 'grewup', a: 'Delhi and Mumbai', note: 'two cities' },

  // ---- sentences rather than nouns
  { q: 'season', a: 'I love the smell of rain in the mountains', note: 'full sentence' },
  { q: 'food', a: 'something my grandmother used to make', note: 'no nameable entity' },
  { q: 'grewup', a: 'a small village near the sea', note: 'descriptive, not named' },

  // ---- out of scope
  { q: 'grewup', a: 'Paris', note: 'non-Indian place' },
  { q: 'food', a: 'sushi', note: 'non-Indian food' },
  { q: 'animal', a: 'penguin', note: 'not in the archive' },
  { q: 'festival', a: 'Nowruz', note: 'mentioned but never filmed' },

  // ---- junk
  { q: 'grewup', a: 'asdfgh', note: 'nonsense' },
  { q: 'food', a: '12345', note: 'digits' },
  { q: 'grewup', a: '   Kerala   ', note: 'whitespace' },
  { q: 'grewup', a: 'KERALA!!!', note: 'shouting + punctuation' },

  // ---- ambiguous / cross-border places
  { q: 'grewup', a: 'Punjab', note: 'India and Pakistan' },
  { q: 'grewup', a: 'Kashmir', note: 'disputed / cross-border' },
  { q: 'grewup', a: 'Bombay', note: 'historical name' },
];

const filter = process.argv[2]?.toLowerCase();
const probes = filter
  ? PROBES.filter((p) => `${p.q} ${p.a} ${p.note}`.toLowerCase().includes(filter))
  : PROBES;

let empty = 0;
let short = 0;

for (const probe of probes) {
  const question = QUESTIONS.find((q) => q.id === probe.q);
  if (!question) {
    console.log(`!! unknown question id "${probe.q}"`);
    continue;
  }

  const rec = recommend({ [probe.q]: probe.a });
  const group = rec.groups[0];

  const head = `[${probe.q}] "${probe.a}"`.padEnd(46);
  if (!group || group.clips.length === 0) {
    empty++;
    console.log(`${head} 0 clips   (${probe.note})${rec.thin ? '  [thin]' : ''}`);
    continue;
  }
  if (group.clips.length < 5) short++;

  console.log(`${head} ${group.clips.length} clips   (${probe.note})`);
  group.clips.forEach((c, i) => {
    console.log(`      ${group.reasons[i].padEnd(7)} ${c.title.slice(0, 96)}`);
  });
  console.log('');
}

console.log(`\nprobes: ${probes.length}   empty: ${empty}   under-filled: ${short}`);
