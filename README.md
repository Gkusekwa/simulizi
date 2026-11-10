# Simulizi

Working name for an open, bilingual (Swahili and English) platform where any writer
publishes stories, poems, essays, comics and audiobook chapters -- all at once or on a
release schedule they set -- with an Android app (iOS later), offline reading of followed works,
and selling added in phase 2.

Status: **phase 1 in progress.** The walking skeleton (API, web, stack) is deployed at
<https://simulizi.tzcom.cloud> (web) and <https://simulizi-api.tzcom.cloud> (API, docs at
`/api/docs`).

**The files in `docs/` are the source of truth;** where they disagree with each other,
[14](docs/14-v1-contract.md) wins. (`docs/` and `mockups/` are local only, not in git.)

## Layout

| Path | What |
| --- | --- |
| `api/` | NestJS 11 + Prisma 5 on the shared Postgres 18. Auth, works, parts, release engine, reading, library. |
| `web/` | React 19 + Vite, Swahili/English, reader, library, writer studio. Static files behind nginx. |
| `docker-compose.yml` | The NAS stack: `api` on host port 3009, `web` on 3008, joined to the external `nasinfra` network. |
| `.env.example` | Every variable the stack reads; real values live in `.env` (gitignored) and in Portainer's stack env. |

## How it works

- **Content** is ProseMirror JSON (`paragraph`, `heading`, and `poem > stanza > line`),
  rendered to HTML on the server (`api/src/content/prosemirror.ts`). Writers edit a working
  copy; readers see the last published version until "Publish changes".
- **Releases** follow docs 04 and 14 §2: parts are queued in position order, a draft blocks
  everything after it, daily/weekly plans assign slots from now (`api/src/works/release/slots.ts`),
  and a one-minute sweep publishes anything due (`release.sweep.ts`). "Publish now" is allowed only
  for the next part in order; all-at-once releases every ready part together.
- **Reads** are counted once per reader per part per day; signed-out readers send an
  `X-Anon-Id` header. Public counts under five show as "fewer than 5" (doc 16).
- **Auth** is email + password (argon2) with rotating refresh tokens; sign-up requires a
  birth year of 13+ (doc 10). Google sign-in and push come later. `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` seed or promote the admin on boot.
- **Access per work** is the writer's choice: open, preview (the first N parts without an
  account, default 10) or members only. Locked parts answer `401 account_required`.
- **Notifications**: in-app for every follower when a part releases, plus email through
  `SMTP_URL` (Mailpit in the stack by default) for readers who keep the email switch on.
- **Moderation** (doc 10): reports with urgent paging of moderators, automatic hiding at
  three eligible reports, a moderator queue at `/mod`, strikes and 30-day suspensions;
  blocks hide comments both ways and drop the blocked account's follows.
- **Search** is Postgres full-text (`simple` dictionary, prefix match) over title,
  synopsis, tags and handle, maintained by a trigger. **Stats** show reads, unique readers
  and followers per work with everything under five hidden. **Export** gives the whole
  work as HTML or plain text.

## Developing

```sh
# API: needs a Postgres; the simplest is a local container
docker run -d --name simulizi-pg -e POSTGRES_USER=simulizi -e POSTGRES_PASSWORD=simulizi \
  -e POSTGRES_DB=simulizi -p 5433:5432 postgres:18-alpine
cd api && cp .env.example .env && npm install && npx prisma migrate dev && npm run start:dev
# Web: proxies /api to localhost:3000
cd web && npm install && npm run dev
```

Tests: `cd api && npx jest` (renderer and release-slot rules).

## Deploying

Portainer git stack **30** on the NAS, manual *Pull and redeploy*. The images build on the
NAS (arm64). Required stack env: `DB_PASSWORD` (= nasinfra `SIMULIZI_PASSWORD`),
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `WEB_PORT`,
`API_PORT`. Migrations run on container start. Health: `GET /health` on the API,
`GET /` on the web.

## Design docs

| # | Doc | Covers |
| --- | --- | --- |
| 00 | Overview | What it is, v1 goals, how it differs |
| 01 | Market research | Serial, audio, African and poetry platforms |
| 02 | Users and roles | Reader, writer, co-author, narrator, moderator, admin, friends |
| 03 | Content model | Works, parts, series, collections, comics, poems |
| 04 | Release scheduling | All at once, daily, weekly, custom, early access |
| 05 | Reader experience | Discovery, reading, listening, profiles, likes, ratings, comments, tracking |
| 06 | Offline sync | Auto-download of followed works, outbox, delta sync |
| 07 | Writer studio | Editor, audio, comics, poetry mode, stats, export |
| 08 | Monetisation and payments | Phase 2 models, payment providers |
| 09 | Languages | Swahili/English UI and content, currency, data cost |
| 10 | Rights and moderation | Ownership, ratings, reporting, plagiarism, privacy |
| 11 | Architecture and hosting | NAS fit, nasinfra reuse, keeping load off the NAS |
| 12 | Roadmap | Phases and gates |
| 13 | Open questions | Decisions and what is still open |
| 14 | v1 contract | The binding scope, states, flows and technical decisions |
| 15 | Accessibility | WCAG 2.2 AA, poems, images, audio, comics |
| 16 | Privacy and analytics | What is stored, for how long, thresholds, opt-out |
