# RightCleaner

RightCleaner is a focused cleanup tool for identifying disposable items, presenting clear cleanup decisions, and executing safe removals with user confirmation.

## Engineering Baseline

The repository now includes the initial `MIN-43` application scaffold:

- `Vite + React + TypeScript` frontend entry
- `Tauri v2` desktop shell baseline
- `ESLint + Prettier + Vitest` quality toolchain
- a feature-oriented `src/` directory convention

### Quick Start

```bash
npm install
npm run dev
```

### Quality Commands

```bash
npm run lint
npm run format:check
npm run test
```

### Structure Reference

See `docs/engineering-structure.md` for the shared directory convention and module placement rules.

## Product Scope

The MVP boundary for the first release is defined in [docs/MIN-39-mvp-boundary.md](docs/MIN-39-mvp-boundary.md).

This repository currently treats `MIN-39` as the source of truth for:

- required first-release capabilities
- explicit non-goals
- iteration priority after MVP

## Product Documentation

Product definition and interaction design documents live under `docs/`:

- `docs/MIN-39-mvp-boundary.md`: MVP scope, non-goals, and release priorities
- `docs/MIN-42-technical-architecture.md`: desktop framework, UI stack, system operation path, and permission model
- `docs/product/MIN-40-information-architecture.md`: information architecture and core user flows
- `docs/product/MIN-45-settings-logging-diagnostics.md`: local settings storage, operation logs, error records, and diagnostic bundle design

Structured contracts for future app implementation live under `specs/`:

- `specs/settings/settings.schema.json`: versioned local settings schema
- `specs/diagnostics/operation-log.schema.json`: structured operation event schema
- `specs/diagnostics/error-report.schema.json`: local error record and export schema
- `specs/diagnostics/diagnostic-bundle.schema.json`: diagnostic export manifest schema
