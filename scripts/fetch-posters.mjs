// Downloads the US poster of every movie listed in index.html from TMDB into images/posters.
// Usage: node scripts/fetch-posters.mjs [--dry-run] [--force] [--only <text>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'images', 'posters');
const OVERRIDES = join(ROOT, 'scripts', 'poster-overrides.json');
const API = 'https://api.themoviedb.org/3';
const IMAGES = 'https://image.tmdb.org/t/p/';
const POSTER_SIZE = 'w780';
const MIN_SCORE = 0.6;

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    only: { type: 'string' }
  }
});

function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function words(s) { return norm(s).replace(/&/g, ' and ').replace(/['’.]/g, '').match(/[a-z0-9]+/g) || []; }

function fileName(year, title) {
  return year + '-' + words(title).join('-');
}

function readMovies() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const movies = [];
  for (const [section, year] of html.matchAll(/<section class="year" data-year="(\d{4})"[\s\S]*?<\/section>/g)) {
    for (const [, text] of section.matchAll(/<span class="title">(.*?)<\/span>/g)) {
      const title = text.replace(/&amp;/g, '&').trim();
      movies.push({ year: Number(year), title, name: fileName(year, title) });
    }
  }
  return movies;
}

async function request(url, headers) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (res.status === 429 && attempt < 5) {
      const seconds = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return res;
  }
}

async function api(path, params = {}) {
  const url = API + path + '?' + new URLSearchParams(params);
  const res = await request(url, { Authorization: 'Bearer ' + process.env.TMDB_TOKEN });
  return res.json();
}

function similarity(a, b) {
  const x = new Set(words(a));
  const y = new Set(words(b));
  const shared = [...x].filter((w) => y.has(w)).length;
  return (2 * shared) / (x.size + y.size);
}

function score(movie, result) {
  const title = Math.max(similarity(movie.title, result.title), similarity(movie.title, result.original_title));
  return title + (result.genre_ids.includes(16) ? 0.1 : 0);
}

// The site's titles and years don't always agree with TMDB, so retry with a shorter title and the
// neighbouring years. Anything further off is left for scripts/poster-overrides.json.
async function findMovie(movie) {
  const noSuffix = movie.title.replace(/\s*[-–]\s*The Movie$/i, '');
  const queries = new Set([movie.title, noSuffix, noSuffix.split(': ').pop()]);
  for (const query of queries) {
    for (const year of [movie.year, movie.year - 1, movie.year + 1]) {
      const { results } = await api('/search/movie', { query, primary_release_year: year, language: 'en-US' });
      const best = results.map((r) => ({ ...r, score: score(movie, r) })).sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= MIN_SCORE) return best;
    }
  }
  return null;
}

// TMDB tags posters by language and region, so a US poster is en/US. English posters with no
// region are the fallback, then the movie's default poster, whatever its language.
function pickPoster(posters, primaryPath) {
  const english = posters.filter((p) => p.iso_639_1 === 'en' && p.file_path.endsWith('.jpg'));
  const us = english.filter((p) => p.iso_3166_1 === 'US');
  const pool = us.length ? us : english.filter((p) => !p.iso_3166_1);
  const voted = pool.toSorted((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count);
  const primary = posters.find((p) => p.file_path === primaryPath);
  return pool.find((p) => p === primary) || voted[0] || primary;
}

async function main() {
  try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
  if (!process.env.TMDB_TOKEN) {
    console.error('Missing TMDB_TOKEN. Add your API Read Access Token to a .env file (see scripts/README.md).');
    process.exit(1);
  }

  const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, 'utf8')) : {};
  const only = args.only && norm(args.only);
  const movies = readMovies().filter((m) => !only || norm(m.title).includes(only) || m.name.includes(only));
  const seen = new Map();
  const failed = [];
  let saved = 0;
  let skipped = 0;
  mkdirSync(OUT_DIR, { recursive: true });

  for (const movie of movies) {
    const file = join(OUT_DIR, movie.name + '.jpg');
    if (existsSync(file) && !args.force) { skipped++; continue; }
    const fail = (reason) => { failed.push(movie.name + ': ' + reason); console.log('FAIL ' + movie.name + ' - ' + reason); };

    try {
      const id = overrides[movie.name];
      const match = id ? await api('/movie/' + id, { language: 'en-US' }) : await findMovie(movie);
      if (!match) { fail('no match on TMDB'); continue; }
      if (seen.has(match.id)) { fail('same TMDB movie as ' + seen.get(match.id)); continue; }
      seen.set(match.id, movie.name);

      const { posters } = await api('/movie/' + match.id + '/images');
      const poster = pickPoster(posters, match.poster_path);
      if (!poster) { fail('no poster for TMDB ' + match.id); continue; }

      const exact = id || similarity(movie.title, match.title) === 1;
      const date = match.release_date ? match.release_date.slice(0, 4) : '????';
      console.log((exact ? 'ok   ' : 'near ') + movie.name + ' <- ' + match.title + ' (' + date + ') #' + match.id);
      if (poster.iso_639_1 !== 'en') console.log('     no US poster, using the default one (' + poster.iso_639_1 + ')');
      if (args['dry-run']) continue;

      const res = await request(IMAGES + POSTER_SIZE + poster.file_path);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      saved++;
    } catch (e) {
      fail(e.message);
    }
  }

  console.log('\n' + saved + ' saved, ' + skipped + ' already present, ' + failed.length + ' failed');
  if (failed.length) {
    console.log(failed.map((f) => '  ' + f).join('\n'));
    process.exitCode = 1;
  }
}

main();
