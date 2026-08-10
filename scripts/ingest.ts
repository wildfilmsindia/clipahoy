/**
 * Build data/index.json from the WildFilmsIndia YouTube channel.
 *
 *   npm run ingest                    # full crawl
 *   npm run ingest -- --limit 200     # first 200 videos
 *   npm run ingest -- --offline       # re-extract from cache, zero API calls
 *
 * Requires YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in .env.local.
 *
 * ---------------------------------------------------------------------------
 * QUOTA
 *
 * Free tier is 10,000 units/day. This never calls search.list (100 units a
 * page — the reason people believe the YouTube quota is small). It pages the
 * uploads playlist instead:
 *
 *   channels.list        1 unit    once, to find the uploads playlist
 *   playlistItems.list   1 unit    per 50 videos, WITH titles and descriptions
 *
 * A 50,000-video channel costs about 1,000 units. The app never calls the API
 * at all — it reads the JSON this produces, so traffic is free.
 *
 * Fetched pages are cached in data/.ingest-state.json. Because extraction is
 * the part that needs iterating, --offline re-runs extraction against that
 * cache without touching the network. Tune the extractor, re-run, compare.
 * ---------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import readline from 'node:readline';
import { createReadStream } from 'node:fs';
import path from 'node:path';

import type { Clip, RawPlace, Region, Subject, Terrain } from '../src/lib/types';
import {
  splitZones,
  extractPlace,
  extractSubjects,
  extractYear,
  isRejected,
  type GazetteerEntry,
} from './lib/extract';

const DATA_DIR = path.join(process.cwd(), 'data');
const OUT_FILE = path.join(DATA_DIR, 'index.json');
const STATE_FILE = path.join(DATA_DIR, '.ingest-state.json');
const CACHE_FILE = path.join(DATA_DIR, '.ingest-cache.jsonl');
const GAZETTEER_FILE = path.join(DATA_DIR, 'gazetteer.json');

const API = 'https://www.googleapis.com/youtube/v3';

/**
 * Quota accounting.
 *
 * Every endpoint this script uses costs exactly 1 unit — that is the whole
 * point of avoiding search.list, which costs 100. So counting calls counts
 * units. We stop at a budget below the 10,000/day ceiling rather than running
 * until YouTube returns 403, which leaves headroom for a rerun the same day
 * and avoids losing a part-fetched playlist.
 */
const DAILY_QUOTA = 10_000;
const DEFAULT_BUDGET = 9_000;

let unitsUsed = 0;

class QuotaPaused extends Error {
  constructor(public budget: number) {
    super('QUOTA_PAUSED');
  }
}

type YouTubeItem = {
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    resourceId: { videoId: string };
  };
  /**
   * The playlist this video was found in, when it came from the playlist
   * crawl. Channel-curated playlist names ("Gurudwara, Delhi") are the single
   * strongest place signal in the whole dataset — a human wrote them to group
   * footage, so they beat anything we can parse out of a description.
   */
  playlistTitle?: string;
};

type NamedEntry = GazetteerEntry & { name: string };

/**
 * Only the resume token and a count live in the state file. The videos
 * themselves are appended to a JSONL cache, one per line.
 *
 * The previous version kept every item in the state JSON and rewrote the
 * whole file after each page — quadratic, and fatal on a channel with tens of
 * thousands of uploads. Appending is constant time per page and the cache can
 * be streamed back rather than parsed whole.
 */
type State = {
  pageToken?: string;
  count: number;
  /** Playlist ids already fully crawled, so --playlists can resume. */
  donePlaylists?: string[];
};

/* ----------------------------------- env ---------------------------------- */

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing ${name}. Add it to .env.local.\n` +
        `The key only needs public read access — restrict it to ` +
        `"YouTube Data API v3" in the Google Cloud console.`,
    );
    process.exit(1);
  }
  return value;
}

/* --------------------------------- fetching -------------------------------- */

async function api<T>(endpoint: string, params: Record<string, string>, budget = Infinity): Promise<T> {
  if (unitsUsed >= budget) throw new QuotaPaused(budget);

  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  unitsUsed += 1;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes('quotaExceeded')) throw new Error('QUOTA_EXCEEDED');
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

/** Accepts a channel ID (UC...) or a handle (@WildFilmsIndia). 1 unit either way. */
async function uploadsPlaylistId(key: string, channel: string): Promise<string> {
  const selector: Record<string, string> = channel.startsWith('UC')
    ? { id: channel }
    : { forHandle: channel.startsWith('@') ? channel : `@${channel}` };

  const data = await api<{
    items: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
  }>('channels', { part: 'contentDetails', ...selector, key });

  const id = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`No uploads playlist found for "${channel}"`);
  return id;
}

/* -------------------------------- playlists -------------------------------- */

type PlaylistRef = { id: string; title: string; count: number };

/**
 * Every public playlist on the channel.
 *
 * This exists because the uploads playlist is hard-capped at 20,000 items by
 * the API — not by quota. This channel has 126,008 videos, so the uploads
 * route can only ever reach 16% of it. Individual playlists are not capped,
 * and 1,253 of them cover ~106,000 videos, at 1 unit per 50 items.
 */
async function listPlaylists(
  key: string,
  channelId: string,
  budget: number,
): Promise<PlaylistRef[]> {
  const out: PlaylistRef[] = [];
  let token: string | undefined;

  do {
    const data = await api<{
      items: { id: string; snippet: { title: string }; contentDetails: { itemCount: number } }[];
      nextPageToken?: string;
    }>(
      'playlists',
      {
        part: 'snippet,contentDetails',
        channelId,
        maxResults: '50',
        key,
        ...(token ? { pageToken: token } : {}),
      },
      budget,
    );

    for (const p of data.items ?? []) {
      out.push({ id: p.id, title: p.snippet.title, count: p.contentDetails.itemCount });
    }
    token = data.nextPageToken;
  } while (token);

  return out;
}

/** Page one playlist, tagging each video with the playlist's name. */
async function crawlPlaylist(
  key: string,
  playlist: PlaylistRef,
  budget: number,
): Promise<YouTubeItem[]> {
  const out: YouTubeItem[] = [];
  let token: string | undefined;

  do {
    const data = await api<{ items: YouTubeItem[]; nextPageToken?: string }>(
      'playlistItems',
      {
        part: 'snippet',
        playlistId: playlist.id,
        maxResults: '50',
        key,
        ...(token ? { pageToken: token } : {}),
      },
      budget,
    );

    for (const item of data.items ?? []) {
      if (item.snippet?.resourceId?.videoId) out.push({ ...item, playlistTitle: playlist.title });
    }
    token = data.nextPageToken;
  } while (token);

  return out;
}

/* ---------------------------------- cache ---------------------------------- */

function loadState(): State {
  if (!existsSync(STATE_FILE)) return { count: 0 };
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

    // Migrate the old format, which inlined every item into this file.
    if (Array.isArray(raw.items)) {
      if (raw.items.length && !existsSync(CACHE_FILE)) {
        appendFileSync(
          CACHE_FILE,
          raw.items.map((i: YouTubeItem) => JSON.stringify(i)).join('\n') + '\n',
          'utf8',
        );
      }
      return { pageToken: raw.pageToken, count: raw.items.length };
    }

    return raw as State;
  } catch {
    return { count: 0 };
  }
}

function saveState(state: State) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
}

function appendToCache(items: YouTubeItem[]) {
  if (items.length === 0) return;
  appendFileSync(CACHE_FILE, items.map((i) => JSON.stringify(i)).join('\n') + '\n', 'utf8');
}

/** Stream the cache so a large archive never has to be parsed in one piece. */
async function* readCache(limit: number): AsyncGenerator<YouTubeItem> {
  if (!existsSync(CACHE_FILE)) return;

  const rl = readline.createInterface({
    input: createReadStream(CACHE_FILE, 'utf8'),
    crlfDelay: Infinity,
  });

  let n = 0;
  for await (const line of rl) {
    if (n >= limit) break;
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as YouTubeItem;
      n++;
    } catch {
      /* skip a torn line rather than abandoning the whole crawl */
    }
  }
  rl.close();
}

/* ----------------------------------- pause --------------------------------- */

/**
 * Stop cleanly on either kind of quota stop, or rethrow anything else.
 *
 * Both paths are recoverable: completed playlist ids and the uploads page
 * token are checkpointed before this can fire, so a rerun resumes rather than
 * restarting. A part-fetched playlist is simply re-fetched, which costs a
 * handful of units and avoids writing a half-crawled playlist to the cache.
 */
function reportPause(err: unknown, progress: string): void {
  if (err instanceof QuotaPaused) {
    console.log(
      `\n\nPaused at the ${err.budget}-unit budget after ${progress}.\n` +
        `Progress is saved. Resume with the same command — it picks up where it stopped.\n` +
        `Raise the ceiling for this run with --budget ${DAILY_QUOTA}.`,
    );
    return;
  }

  if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
    console.log(
      `\n\nYouTube refused further calls — the daily quota is spent, after ${progress}.\n` +
        `Progress is saved. Quota resets at midnight Pacific; rerun then to resume.`,
    );
    return;
  }

  throw err;
}

/* ------------------------------------ run ---------------------------------- */

async function main() {
  const argv = process.argv;
  const offline = argv.includes('--offline');
  const playlistMode = argv.includes('--playlists');
  const limitArg = argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(argv[limitArg + 1]) : Infinity;

  const budgetArg = argv.indexOf('--budget');
  const budget = budgetArg > -1 ? Number(argv[budgetArg + 1]) : DEFAULT_BUDGET;

  if (!existsSync(GAZETTEER_FILE)) {
    console.error('No data/gazetteer.json. Run: npx tsx scripts/build-gazetteer.ts');
    process.exit(1);
  }
  const gaz = JSON.parse(readFileSync(GAZETTEER_FILE, 'utf8'));
  const gazetteer: Record<string, NamedEntry> = gaz.places;
  const aliases: Record<string, string> = gaz.aliases;

  const state = loadState();

  if (playlistMode) {
    const key = env('YOUTUBE_API_KEY');
    const channel = env('YOUTUBE_CHANNEL_ID');

    // playlists.list needs a channel id, not a handle.
    const channelId = channel.startsWith('UC')
      ? channel
      : (await api<{ items: { id: string }[] }>('channels', {
          part: 'id',
          forHandle: channel.startsWith('@') ? channel : `@${channel}`,
          key,
        })).items?.[0]?.id;

    if (!channelId) throw new Error(`Could not resolve channel "${channel}"`);

    const playlists = await listPlaylists(key, channelId, budget);
    const done = new Set(state.donePlaylists ?? []);
    const pending = playlists.filter((p) => !done.has(p.id) && p.count > 0);
    const needed = Math.ceil(pending.reduce((n, p) => n + p.count, 0) / 50);

    console.log(
      `${playlists.length} playlists · ${pending.length} still to crawl · ` +
        `${pending.reduce((n, p) => n + p.count, 0)} videos · ~${needed} units needed`,
    );
    console.log(`budget: ${budget} units of ${DAILY_QUOTA}/day\n`);

    const started = Date.now();
    let n = 0;

    try {
      for (const playlist of pending) {
        const items = await crawlPlaylist(key, playlist, budget);
        appendToCache(items);
        state.count += items.length;
        done.add(playlist.id);
        state.donePlaylists = [...done];
        saveState(state);

        n++;
        const mins = (Date.now() - started) / 60000;
        process.stdout.write(
          `\r${n}/${pending.length} playlists · ${state.count} rows · ` +
            `${unitsUsed} units · ${mins > 0 ? Math.round(state.count / mins) : 0}/min`,
        );
      }
    } catch (err) {
      reportPause(err, `${n} playlists`);
    }
    console.log('');
  } else if (!offline) {
    const key = env('YOUTUBE_API_KEY');
    const channelId = env('YOUTUBE_CHANNEL_ID');
    const playlistId = await uploadsPlaylistId(key, channelId);

    console.log(`Uploads playlist: ${playlistId}`);
    console.log(state.count ? `Resuming from ${state.count} videos.` : 'Starting.');

    const started = Date.now();

    try {
      while (state.count < limit) {
        const page = await api<{ items: YouTubeItem[]; nextPageToken?: string }>(
          'playlistItems',
          {
            part: 'snippet',
            playlistId,
            maxResults: '50',
            key,
            ...(state.pageToken ? { pageToken: state.pageToken } : {}),
          },
          budget,
        );

        const items = page.items ?? [];
        appendToCache(items);
        state.count += items.length;
        state.pageToken = page.nextPageToken;
        saveState(state);

        const mins = (Date.now() - started) / 60000;
        const rate = mins > 0 ? Math.round(state.count / mins) : 0;
        process.stdout.write(`\r${state.count} videos · ${rate}/min · ~${Math.ceil(state.count / 50)} units`);

        if (!page.nextPageToken) break;
      }
    } catch (err) {
      reportPause(err, `${state.count} videos`);
    }
    console.log('');
  } else {
    console.log(`Offline: re-extracting from ${state.count} cached videos. No API calls.`);
  }

  /* ------------------------------- extraction ------------------------------ */

  const clips: Clip[] = [];
  const usedPlaces = new Set<string>();
  const noPlace: { id: string; title: string }[] = [];
  const noSubject: { id: string; title: string }[] = [];
  const rejected: { id: string; title: string; why: string }[] = [];
  const bySource = { playlist: 0, hashtag: 0, title: 0, prose: 0 };

  let seen = 0;
  let duplicates = 0;
  const seenIds = new Set<string>();

  for await (const item of readCache(limit)) {
    const { title, description, resourceId } = item.snippet ?? {};
    if (!resourceId?.videoId || !title) continue;

    // A video can sit in several playlists and in the uploads feed, so the
    // cache holds duplicate rows by design. First occurrence wins.
    if (seenIds.has(resourceId.videoId)) {
      duplicates++;
      continue;
    }
    seenIds.add(resourceId.videoId);
    seen++;

    const zones = splitZones(description ?? '');

    const why = isRejected(title, zones);
    if (why) {
      rejected.push({ id: resourceId.videoId, title, why });
      continue;
    }

    const hit = extractPlace(title, zones, gazetteer, aliases, item.playlistTitle);

    /**
     * Subjects are optional when we have a place.
     *
     * Requiring one discarded 20,012 videos that had a perfectly good place —
     * tribal dance, acrobats, grain storage — simply because the 15-tag
     * vocabulary does not describe a general factual archive of this size.
     * Free-text search runs over the prose, so an untagged clip is still
     * findable; the tags only drive the browse-by-subject path.
     */
    const subjects = extractSubjects(title, zones);
    if (subjects.length === 0) noSubject.push({ id: resourceId.videoId, title });

    /**
     * A clip needs a place OR a subject — not both.
     *
     * Previously a missing place dropped the clip entirely, which silently
     * removed ~1,000 wildlife clips from search: "White-throated Kingfisher
     * perched and preening on tree branch" is perfectly good footage that
     * simply never had a location written down. Nature and wildlife material
     * is legitimately unplaceable (AUDIT.md §E-0 bucket 3), so it is admitted
     * with placeId null and surfaces on its title alone.
     *
     * A clip with neither a place nor a subject has nothing to describe it,
     * and is still recorded as unmatched.
     */
    if (!hit && subjects.length === 0) {
      noPlace.push({ id: resourceId.videoId, title });
      continue;
    }

    if (hit) {
      bySource[hit.source] += 1;
      usedPlaces.add(hit.placeId);
    } else {
      noPlace.push({ id: resourceId.videoId, title });
    }

    clips.push({
      id: resourceId.videoId,
      title,
      // Prose only — the hashtag block and SEO tail are dropped. Capped so a
      // few unusually long entries can't bloat the index; 800 characters is
      // well past the ~450 average.
      text: zones.prose.slice(0, 800),
      placeId: hit ? hit.placeId : null,
      subjects: subjects as Subject[],
      year: extractYear(title, zones),
      isPlaceholder: false,
    });
  }

  const places: RawPlace[] = [...usedPlaces].map((id) => {
    const e = gazetteer[id];
    return {
      id,
      name: e.name,
      district: e.district,
      state: e.state,
      region: e.region as Region,
      terrain: e.terrain as Terrain,
      lat: e.lat,
      lng: e.lng,
    };
  });

  writeFileSync(
    OUT_FILE,
    JSON.stringify({ source: new Date().toISOString(), places, clips }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(DATA_DIR, 'unmatched.json'),
    JSON.stringify({ noPlace, noSubject, rejected }, null, 2),
    'utf8',
  );

  /* --------------------------------- report -------------------------------- */

  const pct = (n: number) => `${((n / Math.max(seen, 1)) * 100).toFixed(1)}%`;

  console.log(`\n  unique      ${seen}\t(${duplicates} duplicate rows skipped)`);
  console.log(`  matched     ${clips.length}\t${pct(clips.length)}`);
  // These two are OVERLAYS on `matched`, not disjoint buckets: a clip with a
  // subject but no place is counted in both `matched` and `no place`. Only
  // `rejected` and clips with neither signal are actually excluded.
  console.log(`  no place    ${noPlace.length}\t${pct(noPlace.length)}\t(overlaps matched)`);
  console.log(`  no subject  ${noSubject.length}\t${pct(noSubject.length)}\t(overlaps matched)`);
  console.log(`  rejected    ${rejected.length}\t${pct(rejected.length)}\t(not place footage)`);
  console.log(`\n  places found: ${places.length}`);
  console.log(
    `  place from:   ${bySource.playlist} playlist · ${bySource.hashtag} hashtag · ` +
      `${bySource.title} title · ${bySource.prose} prose`,
  );
  console.log(`\nWrote data/index.json and data/unmatched.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
