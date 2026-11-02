# Downloading the posters

`fetch-posters.mjs` downloads the US poster of every movie in `index.html` from [TMDB](https://www.themoviedb.org/) to `images/posters`, named `YYYY-movie-name.jpg`. Movies without a US poster get TMDB's default one. It needs Node.js 22 or newer.

1. Create a `.env` file in the project root with your API Read Access Token, found in your [TMDB API settings](https://www.themoviedb.org/settings/api):

   ```
   TMDB_TOKEN=your-token
   ```

2. Run the script from the project root. Posters already in the folder are skipped.

   ```bash
   node scripts/fetch-posters.mjs
   ```

   - `--dry-run` shows the matches without downloading anything.
   - `--only <text>` handles only the movies whose title contains the text.
   - `--force` replaces posters that already exist.

Lines marked `near` were matched on a similar title, so check them. If a movie is matched wrongly or not found, add its TMDB id to `poster-overrides.json`, for example `{ "2003-chase-me": 12345 }`, and run the script again with `--only` and `--force`.
