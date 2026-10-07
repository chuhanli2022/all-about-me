# All About Me — multiplayer introduction trivia

A browser-based trivia game for team introductions, new-hire welcomes, and small group events. One host controls the pages; up to 30 players join with a room code and a name. No ChatGPT login is required by the game.

This reusable project contains generic questions only. It does not include the original author's personal quiz, photos, video, production room data, credentials, or Git history.

## Features

- Seven editable multiple-choice questions, with one correct answer each.
- Optional introduction before each question, then a story/reveal page.
- Up to five photos on each introduction and story page (5 MB per image).
- One optional video per story page: MP4, WebM, or MOV, up to 50 MB. Actual playback depends on the browser and codec.
- Players see the answer after confirming; one point per correct answer, no speed bonus.
- Host sees answer counts and the names of players who answered correctly.
- Forward and backward navigation synchronized through server state. Revealed questions remain closed for scoring.
- Players can join a running game, but not a finished game.
- Top three distinct score ranks, including everyone tied at each rank.
- Room-specific saved edits, browser draft recovery, and reusable shared defaults.

## Run locally

Requires Node.js 22.13 or newer and npm. The server uses Cloudflare Workers-compatible APIs with local D1 and R2 emulation; it is not a static HTML application.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sloppy_squadron_supreme.sql
npm run dev
```

Open http://localhost:5173/host to create and edit a game. Open http://localhost:5173/play in a separate browser profile or private window to test a player. Each profile remembers one host session and one player session.

The SQL command initializes a fresh local database. Do not replay the same migration against an initialized database. Production data is not included.

## Customize your quiz

In the host editor, edit the introductions, questions, answer options, and story pages. Upload photos or a video, then click **Save all 7 questions**. A browser draft is a recovery aid; it is not a substitute for saving to the server.

- **Shared defaults:** edit `lib/shared-quiz.json`, then rebuild and redeploy. Fresh host sessions start with this template. Keep exactly seven questions and four options per question; `correct` is a zero-based index from 0 to 3.
- **Room edits:** saving edits changes only the current room. It does not change shared defaults.
- **Play again with this quiz:** copies the saved quiz to a new room, clearing player scores.
- **Load shared quiz:** explicitly loads the shared default text into a lobby. Existing saved media is retained; empty media fields use the shared template's media.

Uploaded media belongs to the deployment's R2 storage. A photo URL copied from another deployment will not carry that photo over. This export deliberately has empty media arrays; upload your own images and video on your deployment.

## Deploy

The app requires a server runtime and persistent storage. **GitHub hosts this source repository; GitHub Pages alone cannot run the multiplayer server.**

The project was built for Sites with a Cloudflare Worker, a D1 binding named `DB`, and an R2 binding named `BUCKET`. `.openai/hosting.json` contains only these logical bindings; the original Site ID has been removed. To deploy through Sites, register a new Site and use its build/publish flow. For an independent Cloudflare deployment, provision your own D1/R2 resources, configure production bindings, and apply the database migration. The placeholder resource IDs in `vite.config.ts` are for local development, not production.

Set the hosting audience to public if you want guests to join without platform sign-in. Production deployment credentials must remain outside this repository.

## How it works

- React and TypeScript UI, with Vinext/Vite.
- `app/api/game/route.ts`: room creation, joining, answers, navigation, and scoring.
- D1 `rooms` table: one JSON game state per room; optimistic version checks protect concurrent updates.
- `app/api/photo/route.ts` and `app/api/video/route.ts`: host-authorized uploads to R2. Video responses support byte ranges for seeking.
- Clients poll approximately every 1.6 seconds for room updates.
- Host/player tokens are generated per room and stored in that browser. They are not an account system and do not automatically transfer to another computer.

This is designed for small trusted group events. A room code is an invitation code, not strong access control. Anyone with a media URL can read that media; keep confidential content out of publicly accessible deployments. Save history and cross-device host account recovery are not implemented.

## Commands

```sh
npm run dev       # local development
npm run build     # server and client production build
npm run start     # locally preview built Worker
npx tsc --noEmit  # TypeScript checks
npm run db:generate # generate migrations after intentional schema changes
```

Bundled third-party license notices remain in `build/` and `vendor/`.
