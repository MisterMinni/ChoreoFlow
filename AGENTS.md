# ChoreoFlow

Read `docs/STATUS.md` first, then only the affected source and relevant small document.

- Expo Router + React Native + TypeScript; no separate web editor and no AI runtime.
- Domain units are metres/seconds. All renderers and exports use `evaluateScene` in `packages/core`.
- Store complete gestures as one command. Never discard unsynced data or silently replace IDs.
- Local mode must work without accounts, cloud, Docker or EAS. Test fixtures contain synthetic data only.
- Keep credentials out of Git, logs and UI. The supplied Supabase project is staging, confirmed by the user.
- Git auto-deploys are disabled. No production migration, release, paid service or Store submission without explicit authorization.
- Run targeted tests while working; `npm run check`, `npm run build:web`, `npm run test:e2e` at milestones.
- Native device compatibility, performance and Store approval require real evidence; never infer them from a web build.
- Record actual completion, limitations and next runnable steps in `docs/STATUS.md` and `docs/ACCEPTANCE.md`.
