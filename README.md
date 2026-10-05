# Krom FM v6

A kid's pretend radio station: Spotify songs, jingles, news and DJ talk in one running order.
Live at **https://arcuscapital.github.io/djraf5/**. Earlier versions stay live for comparison:
v5 at /djraf4/, v4 at /djraf3/, v3 at /djraf2/, v2 at /djraf/, and the original at
https://arcuscapital.github.io/raf-radio-station/.

v6 = v5 with the reward rule changed from "shows" to "time on air" (`src/trophies.ts`, tested):
every 30 minutes on air (anything playing, not paused) earns the next record in the round —
bronze, then silver, then gold — and after gold a new round starts at bronze. Spare minutes
carry over; a show stopped early keeps its minutes; a 3-second show earns nothing. There is no
countdown shown anywhere (parent's choice): a record earned mid-show just pops up, and the
end-of-show celebration is that record (coloured bronze/silver/gold) or the dance party. No
tally of records won is shown either; the counts are still saved.
Gold records carry across from /djraf4/. `?demo=party|bronze|silver|gold` previews a scene.

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
