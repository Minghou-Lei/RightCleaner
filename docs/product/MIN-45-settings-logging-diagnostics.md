# MIN-45 设置存储、操作日志与错误上报机制

## 1. 目标

为 RightCleaner 首版定义一套本地优先、可审计、可导出的设置与诊断机制，覆盖以下能力：

- 持久化用户设置，并支持版本迁移
- 记录扫描、清理、备份、恢复等关键操作日志
- 在异常发生时生成结构化错误记录
- 产出可分享的诊断信息包，便于问题复现与支持排查

该机制默认面向本地桌面应用，不依赖云端服务；若后续接入远程错误收集，也必须以当前本地结构作为唯一上游数据源。

## 2. 设计原则

1. 本地优先：设置、日志、错误记录默认写入用户本机应用数据目录。
2. 结构化优先：日志和错误记录统一使用 JSON 结构，避免仅有不可解析文本。
3. 最小敏感信息：默认不记录完整文件内容，不记录用户隐私数据，不上传任何数据。
4. 关联可追踪：扫描任务、清理任务、备份任务、恢复任务都必须带 `session_id`、`operation_id`、`trace_id`。
5. 可导出不可默传：诊断信息只允许用户主动导出，不做后台自动上报。
6. 可迁移：设置文件与日志 schema 都必须带版本字段。

## 3. 本地目录规划

建议基于应用数据根目录 `app_data_dir` 使用如下结构：

```text
RightCleaner/
├─ settings/
│  ├─ settings.v1.json
│  └─ settings.backup.v1.json
├─ logs/
│  ├─ operations-2026-04.jsonl
│  ├─ operations-2026-05.jsonl
│  └─ retention.json
├─ errors/
│  ├─ error-2026-04-18T12-10-33.512Z-01HXYZ.json
│  └─ attachments/
├─ diagnostics/
│  ├─ bundle-2026-04-18T12-20-00Z/
│  │  ├─ manifest.json
│  │  ├─ settings.redacted.json
│  │  ├─ recent-operations.jsonl
│  │  ├─ recent-errors.json
│  │  └─ environment.json
│  └─ exports/
└─ cache/
   └─ session.json
```

目录职责：

- `settings/`：用户偏好与行为策略
- `logs/`：操作流水，推荐 JSON Lines
- `errors/`：单个错误事件详情与附件索引
- `diagnostics/`：用户主动导出的诊断快照
- `cache/`：临时会话态，不作为业务真相

## 4. 设置存储设计

设置采用单文件快照模型，文件名固定为 [`specs/settings/settings.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/settings/settings.schema.json) 对应的 `settings.v1.json`。

### 4.1 设置分类

- `ui`：视图模式、排序、筛选、语言、主题
- `cleanup`：默认备份开关、失败是否继续、高风险项默认策略
- `scan`：默认扫描范围、排除项、最近使用的扫描模板
- `diagnostics`：日志保留天数、错误记录保留策略、是否允许生成诊断包
- `safety`：二次确认策略、不可恢复项确认开关

### 4.2 写入策略

1. 先写临时文件，再原子替换正式文件。
2. 成功写入后更新 `updated_at` 与 `revision`。
3. schema 版本变化时，先做迁移，再落盘新版本。
4. 保留最近一份 `settings.backup.v1.json` 作为回滚兜底。

## 5. 操作日志设计

操作日志使用 JSONL，schema 见 [`specs/diagnostics/operation-log.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/diagnostics/operation-log.schema.json)。

### 5.1 记录范围

首版至少记录以下事件：

- 应用启动与退出
- 扫描开始、完成、失败
- 清理计划创建、确认、执行、完成、部分失败
- 备份创建、恢复执行
- 设置变更
- 诊断包导出

### 5.2 事件模型

每条日志必须包含：

- `event_id`
- `timestamp`
- `level`
- `category`
- `action`
- `session_id`
- `operation_id`
- `trace_id`
- `payload`

其中：

- `session_id` 用于标识应用启动到退出的一段会话
- `operation_id` 用于标识单次扫描、清理、恢复任务
- `trace_id` 用于串联跨模块调用

## 6. 错误记录与上报机制

错误记录以单事件 JSON 存在 `errors/` 下，schema 见 [`specs/diagnostics/error-report.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/diagnostics/error-report.schema.json)。

### 6.1 错误分级

- `warning`：任务可继续，需记录
- `error`：当前操作失败，但应用可恢复
- `fatal`：当前进程或核心流程不可继续

### 6.2 记录内容

- 错误码与错误类型
- 用户可见文案
- 开发诊断消息
- 调用栈
- 关联操作上下文
- 当前环境摘要
- 最近日志窗口引用
- 敏感字段脱敏结果

### 6.3 上报策略

首版不做自动远程上报，只实现以下链路：

1. 运行时生成结构化错误记录
2. UI 提示用户“导出诊断信息”
3. 生成诊断包并由用户手动提交

这保证与 `MIN-39` 的 MVP 边界一致，不引入云账号、后台传输或隐私合规复杂度。

## 7. 诊断信息包结构

诊断包 schema 见 [`specs/diagnostics/diagnostic-bundle.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/diagnostics/diagnostic-bundle.schema.json)。

诊断包至少包含：

- 脱敏后的当前设置
- 最近 N 条操作日志
- 最近 N 条错误记录摘要
- 应用版本、系统版本、磁盘与权限摘要
- 当前任务上下文
- 导出时间与导出原因

默认不包含：

- 原始待清理文件内容
- 完整目录快照
- 用户账号令牌
- 未脱敏绝对路径批量导出

## 8. 保留与清理策略

- 设置：长期保留，迁移时保留一个历史备份
- 操作日志：按月滚动，默认保留 30 天
- 错误记录：默认保留 30 天，fatal 可延长到 90 天
- 诊断包：默认保留最近 10 份本地导出记录，实体导出文件由用户自行管理

## 9. 实现约束

1. 所有 schema 都必须带 `schema_version`。
2. 所有记录时间都使用 UTC ISO 8601。
3. 文件写入失败不能吞掉，必须进入错误记录链路。
4. 设置写入与日志写入解耦，避免单点失败阻断主流程。
5. UI 不直接拼接字符串日志，统一消费结构化记录。

## 10. 交付物

本任务已在仓库中落地下列契约文件：

- [`specs/settings/settings.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/settings/settings.schema.json)
- [`specs/diagnostics/operation-log.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/diagnostics/operation-log.schema.json)
- [`specs/diagnostics/error-report.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/diagnostics/error-report.schema.json)
- [`specs/diagnostics/diagnostic-bundle.schema.json`](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/a4d0-workspace/RightCleaner/specs/diagnostics/diagnostic-bundle.schema.json)

这些文件构成后续桌面端实现设置中心、操作审计、错误导出与诊断页面时的直接输入。
