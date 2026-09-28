# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sismorcego (React Native 0.81, Android-first, new architecture enabled) is a field app for
Brazilian ACS (Agentes Comunitários de Saúde, also called "multiplicadores") to register bat/animal
bite occurrences (rabies surveillance). A separate "coordenador" role reviews everything submitted
across all ACS. Works offline-first: records queue locally (encrypted SQLite) and sync to Firestore
when connectivity returns.

## Commands

- `npm start` — Metro bundler.
- `npm run android` / `npm run ios` — run via React Native CLI (needs Android Studio/Xcode set up
  normally).
- `npm run lint` — ESLint (`@react-native` config).
- `npm test` — Jest. **Currently 2 of 4 suites fail to even load** (`App.test.tsx`,
  `__tests__/registro.test.js`): Jest can't parse the `firebase` package's ESM build
  (`SyntaxError: Unexpected token 'export'` from `firebase/auth`), because `jest.config.js` has no
  `transformIgnorePatterns` override for it. This predates any recent work, not a regression.
  Additionally, `__tests__/registro.test.js` itself is stale — it was written for the old single-form
  `NovoRegistro` (pre victim-type branching) and asserts fields/flows that no longer exist; it needs a
  rewrite, not just a transform fix, before it's useful again.

### Building an APK without Android Studio

This repo has been built on a Windows machine with **no Android Studio**, using a manually installed
toolchain: JDK 17 (Temurin) + Android SDK command-line tools at `C:\Android\sdk`
(`platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, `ndk;27.1.12297006`). If
`JAVA_HOME`/`ANDROID_HOME` aren't set in the shell, that's why — set them and `cd android` before
running Gradle directly:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME = "C:\Android\sdk"
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
```

`-PreactNativeArchitectures=arm64-v8a` restricts the native libs to one ABI (covers virtually all
real devices) — building all 4 configured architectures (`android/gradle.properties`) produces a much
larger APK for no benefit when just testing on a phone. Release APKs are currently signed with the
debug key (`android/app/build.gradle`'s `release` signingConfig is overridden to `signingConfigs.debug`
— `chave-sismorcego.keystore` referenced in `gradle.properties` isn't actually used for signing yet,
and that file's password is committed in plaintext there).

## Architecture

### Data flow (the core thing to understand before touching a registro)

1. **Local queue**: `src/services/offlineQueue.js` — one encrypted-JSON-blob row per record in a
   SQLite table (`offline_queue`). No fixed columns beyond status metadata, so the record shape is
   whatever JS object the form builds — extending it needs no migration.
2. **Save**: `src/hooks/useSalvarRegistro.js` — shared by all registration screens. Builds the record,
   pushes to the local queue, then opportunistically syncs.
3. **Sync**: `src/services/syncRegistros.js` — `buildCloudPayload()` whitelists fields and writes to
   Firestore at `registros/{uid}/itens/{recordId}` (one subcollection per ACS uid).
4. **Read**: `src/services/historico.js` — merges local queue + Firestore by `recordId`
   (`mergeByRecordId`, cloud wins). For `role === "coordenador"`, `carregarNuvemTodos()` uses a
   Firestore `collectionGroup(db, "itens")` query instead, reading every ACS's records at once.
5. Consumers of that merged shape: `src/pages/Main/buscar/RegistroCard.js` (list summary),
   `src/services/registroPdf.js` (PDF), `src/pages/Main/Painel.js` (coordinator stats/heatmap).

### Registration form: branches by victim type

`src/navigation/RegistrarStack.js` — the "Registrar" tab is a stack, not a single screen:
`NovoRegistro` (common fields: notifier, date, município, localidade, photo, GPS) → one of four
type-specific screens in `src/pages/Main/registro/` (`RegistroHumano`, `RegistroCaninoFelino`,
`RegistroAves`, `RegistroProducao`), each with its own required fields. The resulting record carries
`tipoVitima` plus a `detalhes` object whose shape depends on that type — see
`src/pages/Main/registro/registroTypeOptions.js` for the exact field/option lists (the `value`s are
persisted; don't change them without a migration plan) and
`docs/superpowers/specs/2026-09-28-registro-por-tipo-vitima-design.md` for the full field-by-field
design rationale.

**Legacy records** (synced before this branching existed) have no `tipoVitima`/`detalhes` — every
downstream reader (`RegistroCard`, `registroPdf.js`'s `buildCamposFicha`) treats that as an implicit
"humano" record and reads the old flat field names (`nomeAgredido`, `animalAgredido`,
`tratamentoAntirrabico`, etc.) directly, without trying to reclassify them into the new option sets.

### Roles: ACS vs coordenador

`usuarios/{uid}.role` (`"acs"` | `"coordenador"`) in Firestore, created as `"acs"` on signup
(`src/hooks/useAuth.js`) and never self-promotable from the client — `firestore.rules` requires
`create` to set `role == "acs"` and `update` to leave `role` unchanged. Promoting someone to
coordenador is a manual step in the Firebase console (there's no in-app admin UI). Login has an
"Entrar como administrador" toggle (`src/pages/Auth/Login.js`) that, when checked, rejects the sign-in
unless the account's role is actually `"coordenador"`.

`role` gates two tabs in `src/navigation/AppTabs.js`, both coordenador-only:
- **Notificações** (`src/pages/Main/Notificacoes.js`) — new-registro feed. No Cloud Functions/FCM (the
  user opted out of the Blaze billing card requirement mid-session); instead
  `src/hooks/useCoordenadorNotifications.js` registers a `react-native-background-fetch` task
  (~1h best-effort interval) that polls Firestore and shows a local notification via `notifee`
  (`src/services/checagemNotificacoes.js` is the orchestrator, shared between the foreground hook and
  the headless task registered in `index.js` for when the app is fully closed).
- **Painel** (`src/pages/Main/Painel.js`) — summary counts, a `react-native-maps` `Heatmap` of
  geolocated records, and a per-period (day/month) table. Reuses `useHistoricoRegistros()`, no
  separate query.

### Firebase project

Client-side Firebase JS SDK (the `firebase` npm package: `firebase/app`, `firebase/auth`,
`firebase/firestore`), **not** `@react-native-firebase` — despite that package also being a
dependency, nothing in `src/` imports from it, and there's no `google-services.json` anywhere. Config
lives in `src/services/firebase.js`. `firestore.rules` is version-controlled here but the project has
no Firebase CLI / `firebase.json` set up on the dev machine — rules changes are applied by pasting
into the Firebase console manually. `functions/index.js` (a `novoRegistroNotificacao` Cloud Function)
exists but is unused/undeployed — its Firestore trigger path (`registros/{registroId}`) doesn't match
the actual data model (`registros/{uid}/itens/{recordId}`) anyway.

### Design system

`src/ui/` is a self-contained component library (`Button`, `TextField`, `Select`, `Card`, `ListRow`,
`ScrollScreen`, etc. — barrel-exported from `src/ui/index.js`) built on tokens from
`src/theme/tokens.js` / `src/theme/palettes.js`, consumed via `useTheme()`. Prefer composing from
here over ad-hoc `View`/`StyleSheet` for anything that looks like a form field, button, list row, or
screen shell — check `src/ui/index.js` for what already exists before adding a new primitive.

### Design specs

Recent non-trivial features (role system, coordinator notifications, victim-type branching) have
their design rationale written up in `docs/superpowers/specs/*.md` before implementation — check
there for the "why" behind a decision if the code alone doesn't explain it.
