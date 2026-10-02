# Krom FM v6

A kid's pretend radio station: Spotify songs, jingles, news and DJ talk in one running order.
Live at **https://arcuscapital.github.io/djraf5/**. Earlier versions stay live for comparison:
v5 at /djraf4/, v4 at /djraf3/, v3 at /djraf2/, v2 at /djraf/, and the original at
https://arcuscapital.github.io/raf-radio-station/.

v6 = v5 with the reward rule changed from "shows" to "time on air" (`src/trophies.ts`, tested):
every 30 minutes on air (anything playing, not paused) earns a ⭐; five stars make a gold
record when a show finishes; spare minutes carry over. A "⭐ in 12 min" badge sits by ON AIR,
a star pops up mid-show when earned, and the end-of-show bar shows ⭐⭐☆☆☆ with "Next star in
12 min · about 3 songs". Gold records carry across from /djraf4/; stars start at zero.

## How it avoids repeated songs
Each "Play N Songs" block hands Spotify an exact list of tracks (`PUT /me/player/play {uris}`).
Spotify plays them back to back and stops by itself after the last one — no playlist, no repeat
mode, nothing to race. `src/runWatch.ts` notices the stop and the show moves on.

## Setup (once)
- Spotify developer dashboard → the Krom FM app → Redirect URIs → add `https://arcuscapital.github.io/djraf5/`.
- Spotify Premium is required for playback control.

## Develop
```
npm install
npm run dev     # http://localhost:5068/djraf5/
npm test
npm run build
```
Every push to `main` builds, tests and deploys via GitHub Actions. Built files get unique names and
`version.json` lets an open copy of the app reload itself when a newer build is live.
