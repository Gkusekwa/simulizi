# Simulizi

Working name for an open, bilingual (Swahili and English) platform where any writer
publishes stories, poems, essays, comics and audiobook chapters -- all at once or on a
release schedule they set -- with an Android app (iOS later), offline reading of followed works,
and selling added in phase 2.

Status: design. No code yet.

**The files in `docs/` are the source of truth;** where they disagree with each other,
[14](docs/14-v1-contract.md) wins. The earlier online draft
(https://claude.ai/artifact/5B6FnPTyVMcKktg7ZfA3V3) is an older working copy and is no
longer kept in sync.

## Design docs

| # | Doc | Covers |
|---|---|---|
| 00 | [Overview](docs/00-overview.md) | What it is, v1 goals, how it differs |
| 01 | [Market research](docs/01-market-research.md) | Serial, audio, African and poetry platforms |
| 02 | [Users and roles](docs/02-users-and-roles.md) | Reader, writer, co-author, narrator, moderator, admin |
| 03 | [Content model](docs/03-content-model.md) | Works, parts, series, collections, comics, poems |
| 04 | [Release scheduling](docs/04-release-scheduling.md) | All at once, daily, weekly, custom, early access |
| 05 | [Reader experience](docs/05-reader-experience.md) | Discovery, reading, listening, profiles, likes, comments, tracking |
| 06 | [Offline sync](docs/06-offline-sync.md) | Auto-download of followed works, outbox, delta sync |
| 07 | [Writer studio](docs/07-writer-studio.md) | Editor, audio, comics, poetry mode, stats, export |
| 08 | [Monetisation and payments](docs/08-monetisation-and-payments.md) | Phase 2 models, payment providers |
| 09 | [Languages](docs/09-languages.md) | Swahili/English UI and content, currency, data cost |
| 10 | [Rights and moderation](docs/10-rights-and-moderation.md) | Ownership, ratings, reporting, plagiarism, privacy |
| 11 | [Architecture and hosting](docs/11-architecture-and-hosting.md) | NAS fit, nasinfra reuse, keeping load off the NAS |
| 12 | [Roadmap](docs/12-roadmap.md) | Phases 1, 1b, 2, 3 and gates |
| 13 | [Open questions](docs/13-open-questions.md) | Decisions pending, with suggested answers |
| 14 | [v1 contract](docs/14-v1-contract.md) | **Overrides the others:** scope, part states, editing, unpublish/delete, languages, launch flows, technical decisions, success gate |
| 15 | [Accessibility](docs/15-accessibility.md) | Screen readers, poems, comics, audio, targets |
| 16 | [Privacy and analytics](docs/16-privacy-and-analytics.md) | Identifiers, thresholds, retention, opt-out, exports |
