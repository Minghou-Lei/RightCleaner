# RightCleaner

RightCleaner is a modern Windows shell context menu manager for scanning, understanding, disabling, and safely recovering right-click menu entries.

RightCleaner 是一款现代化的 Windows 右键菜单管理工具，用于扫描、理解、禁用并安全恢复右键菜单项。

## AI-Built Project

This repository is an end-to-end AI-developed project built through a `Codex + Vibe Kanban` workflow.

- `Codex` is responsible for implementation, refactoring, validation, packaging fixes, and integration work.
- `Vibe Kanban` is used to structure epics, break work into issue-linked subtasks, and drive execution through issue-specific workspaces.
- The project history is organized around parent todo integration, child task branches, and staged merges back into `main`.

本仓库是一个由 `Codex + Vibe Kanban` 端到端驱动开发的 AI 项目。

- `Codex` 负责实现、重构、验证、打包修复和集成工作。
- `Vibe Kanban` 用于规划 Epic、拆分 issue 关联子任务，并通过 issue 专属 workspace 驱动执行。
- 项目历史围绕“父级 todo 集成、子任务分支执行、阶段性合并回 `main`”组织。

## What RightCleaner Does

- Scan Windows shell context menu entries across files, folders, folder background, drives, desktop background, and related shell scopes.
- Normalize mixed registry sources into a unified menu item model with traceability.
- Highlight abnormal, duplicate, hidden, third-party, or unknown-source entries.
- Support safe enable/disable operations, destructive-action backups, restore points, and change history.
- Provide a modern desktop UI for overview, filtering, detail inspection, batch confirmation, and recovery workflows.

## RightCleaner 可以做什么

- 扫描 Windows 中文件、目录、目录背景、驱动器、桌面背景等常见对象的右键菜单来源。
- 将不同注册表来源统一整理为可追踪的菜单项模型。
- 识别异常、重复、隐藏、第三方扩展和来源不明的菜单项。
- 支持安全启用/禁用、删除前快照、恢复点与变更历史。
- 提供现代化桌面界面，用于总览、筛选、详情查看、批量确认与恢复流程。

## Tech Stack

- `Tauri v2`
- `React 19`
- `TypeScript`
- `Vite`
- `Vitest`
- `ESLint + Prettier`
- Windows registry access via Rust backend

## Current Scope

The repository already includes the following implemented project areas:

- `MIN-31` MVP definition, scope, information architecture, and product direction
- `MIN-32` desktop application foundation, scaffold, routing, state shell, and diagnostics contracts
- `MIN-33` shell context menu scanning engine, registry reader, normalized model, and anomaly detection
- `MIN-34` safe menu management foundations, including toggle, backup, restore, history, and elevation-related backend work
- `MIN-35` modern management UI, including overview, search/filter/sort, detail panel, batch UX, and visual polish

## Quick Start

### Web UI

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually:

`http://localhost:4173`

### Desktop Dev

```bash
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

Typical Windows build outputs:

- `src-tauri/target/release/rightcleaner.exe`
- `src-tauri/target/release/bundle/nsis/RightCleaner_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/RightCleaner_0.1.0_x64_en-US.msi`

## Repository Guide

- `src/`
  Frontend application code, state, views, and shared UI logic.
- `src-tauri/`
  Rust backend, Tauri shell, registry access, backup, restore, and packaging configuration.
- `docs/`
  Product scope, technical decisions, information architecture, visual baseline, and engineering notes.
- `specs/`
  Structured settings and diagnostics schemas.

## Key Documents

- `docs/MIN-39-mvp-boundary.md`
- `docs/MIN-42-technical-architecture.md`
- `docs/product/MIN-40-information-architecture.md`
- `docs/product/MIN-45-settings-logging-diagnostics.md`
- `docs/visual-baseline.md`
- `docs/engineering-structure.md`

## Development Workflow

The repository follows a parent-task integration model:

1. A parent todo is selected in Vibe Kanban.
2. Child subtasks are executed in issue-linked workspaces.
3. Child workspace branches are integrated into a parent branch such as `codex/min33-scan-engine`.
4. The parent branch is validated and merged back into `main`.
5. Related workspaces and temporary `vk/*` branches are cleaned up.

## Status

RightCleaner is already usable as a local prototype, but it is still under active development.

The next planned work areas are:

- `MIN-36` testing, compatibility, and quality hardening
- `MIN-37` packaging, onboarding, documentation, and post-MVP release work

## License

No license has been declared yet.
