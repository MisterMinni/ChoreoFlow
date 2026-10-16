# Architecture

The user explicitly selected the existing ChoreoFlow GitHub, Vercel and Supabase projects, overriding the attachment's suggestion to create another project. The two supplied prompt files were byte-identical. Their product specification guides implementation; this initial repository is not a completed sales MVP.

## Workspace

- `apps/app`: one Expo 58 / React Native 0.88 / React 19.3 application, Expo Router, strict TypeScript.
- `packages/core`: framework-free validated model, geometry, timeline, evaluation, commands, plans and conflict checks.
- `packages/data`: IndexedDB on web; SQLite on native. Separate storage namespace per local/cloud identity, atomic state/history/outbox writes. Explicit CloudService uses Supabase RPCs with revision preconditions.
- `packages/ui`: shared colors, typography, fields, buttons and cards with system/light/dark themes.
- `supabase`: versioned SQL migrations, isolated permission tests and generated database types.

Offline editing is the default. No network writes on playback or dragging. Only the completed action writes locally. Explicit cloud backup is separate from the local workspace; automatic team merge is not yet integrated. The backend rejects conflicting revisions rather than losing one side's edits.

2D maps metres to screen coordinates. Three.js maps `(x,y,z)` to `(x,z,-y)`; all world positions come from the same evaluator. React Three Fiber web/native adapters share SceneObjects. Native runtime remains unverified until a signed development build runs on an iPhone.

## Environments

Local app is independent of cloud credentials. The user designated Supabase `zhuslvtfktpclopkoqtf` as staging. Vercel preview/development point to it; production has no cloud keys. No production database exists yet. The owner's existing EAS project was verified in the Expo dashboard: owner `choreoflow`, slug `bastianexpo`, UUID `733a2847-f234-4b34-bbf5-d7036b6d922f`. These values are configured in `apps/app/app.config.ts` and were verified in the resolved Expo configuration. A confirmed Apple bundle identifier is still required; no native build or signing has occurred.

## Sources checked 2026-10-16

- [Expo SDK compatibility](https://docs.expo.dev/versions/latest/): SDK 58, RN 0.88, React 19.3, Node >=22.13.
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/): npm workspaces and default Metro configuration.
- [Expo Router setup](https://docs.expo.dev/router/installation/).
- [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation): React 19 with Fiber 9 and native adapter.
