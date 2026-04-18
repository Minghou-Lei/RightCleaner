# MIN-43 Engineering Structure

## Goal

`MIN-43` establishes the initial application scaffold, code quality baseline, and a shared directory convention for RightCleaner.

## Toolchain

- Frontend: `Vite + React + TypeScript`
- Desktop shell: `Tauri v2`
- Lint: `ESLint`
- Format: `Prettier`
- Test: `Vitest + Testing Library`

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run format`
- `npm run format:check`
- `npm run test`
- `npm run tauri dev`

## Directory Convention

- `src/app`: application shell, routes, top-level providers
- `src/features`: feature-oriented UI and business modules
- `src/shared`: shared utilities, types, constants, and cross-feature helpers
- `src/styles`: application-level style entrypoints
- `src/test`: shared test setup and test helpers
- `src-tauri`: desktop runtime, Tauri config, and Rust-side capabilities
- `docs`: product and engineering documentation
- `styles`: cross-app design tokens and long-lived visual primitives

## Rules

- New product work should be added under `src/features/<feature-name>`.
- Cross-feature code should move into `src/shared` only after a second consumer appears.
- Tests should live next to the component or module they verify, except shared setup under `src/test`.
- App entry and composition logic should stay in `src/app`.
- Design tokens remain in `styles/design-tokens.css`, while app imports flow through `src/styles/index.css`.
