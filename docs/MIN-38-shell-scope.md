# MIN-38 Windows 右键菜单支持范围与对象类型梳理

## 结论摘要

Windows 右键菜单不是单一对象模型，而是按 Shell 对象类型分流注册。对 RightCleaner 而言，`文件`、`目录`、`目录背景`、`驱动器`、`桌面背景` 应视为五类独立目标；另外还要识别 `ProgID/扩展名`、`AllFileSystemObjects`、`Folder` 这些会覆盖或扩大作用范围的入口。

Windows 10 与 Windows 11 的核心差异不在于这些对象类型是否还受支持，而在于 `显示层`：

- Windows 10 主要显示经典右键菜单，传统 `IContextMenu` / `shell` / `shellex` 注册通常直接可见。
- Windows 11 引入新的一级右键菜单。传统扩展仍然兼容，但多数第三方命令会落到 `显示更多选项`（`Shift+F10`）中的经典菜单。
- Windows 11 一级菜单的官方扩展模型更偏向带应用标识的 `IExplorerCommand`。Microsoft 文档明确列出的现代对象类型只有 `*`、扩展名、`Directory`、`Directory\Background`；没有给出 `Drive` 与 `DesktopBackground` 的一级菜单注册模型。

## 对象类型与典型注册表入口

| 对象类型 | 含义 | 典型注册表入口 | RightCleaner 应如何归类 |
| --- | --- | --- | --- |
| 文件 | 针对所有文件或某类文件 | `HKCR\*\shell`、`HKCR\*\shellex\ContextMenuHandlers`、`HKCR\.ext`、`HKCR\<ProgID>\shell`、`HKCR\<ProgID>\shellex\ContextMenuHandlers` | 作为“文件”主类；同时要支持从扩展名和 ProgID 反查来源 |
| AllFileSystemObjects | 所有文件系统对象，包括文件和目录 | `HKCR\AllFileSystemObjects\shellex\ContextMenuHandlers` | 作为“文件/目录通用”范围单独标注，避免误判成仅文件或仅目录 |
| 目录 | 文件系统目录 | `HKCR\Directory\shell`、`HKCR\Directory\shellex\ContextMenuHandlers` | 作为“目录”主类 |
| Folder | 所有文件夹对象，范围比 `Directory` 更宽，可能含非文件系统文件夹 | `HKCR\Folder\shell`、`HKCR\Folder\shellex\ContextMenuHandlers` | 作为“目录扩展范围”记录，避免与 `Directory` 混淆 |
| 目录背景 | 在文件夹空白处右键，不是点中某个目录项 | `HKCR\Directory\Background\shell`、`HKCR\Directory\Background\shellex\ContextMenuHandlers` | 单独归类为“目录背景” |
| 驱动器 | 盘符根对象，如 `C:`、`D:` | `HKCR\Drive\shell`、`HKCR\Drive\shellex\ContextMenuHandlers` | 单独归类为“驱动器” |
| 桌面背景 | 桌面空白处右键；不是桌面上的文件/快捷方式 | `HKCR\DesktopBackground\shell`、`HKCR\DesktopBackground\shellex\ContextMenuHandlers` | 单独归类为“桌面背景” |
| 桌面文件/快捷方式 | 放在桌面上的文件、文件夹、快捷方式 | 仍按其真实对象类型落到 `*`、`.ext`、`ProgID`、`Directory`、`Folder` 等 | 不应误建成一个独立“Desktop item” 注册类 |

## 各对象类型的支持判断

### 1. 文件

- 支持最完整，既可以按 `*` 注册，也可以按扩展名和 `ProgID` 注册。
- 如果某项来自 `HKCR\.ext` 关联到某个 `ProgID`，最终展示范围通常由该 `ProgID` 决定。
- 桌面上的普通文件右键，本质上仍然是“文件”对象，不是“桌面背景”对象。

### 2. 目录

- `Directory` 面向文件系统目录。
- `Folder` 是更泛的文件夹概念；如果清理器只想处理真实磁盘目录，不能把 `Folder` 与 `Directory` 完全等同。
- 目录项右键与目录空白处右键是两个不同对象，后者应归到 `Directory\Background`。

### 3. 目录背景

- 这是最容易和“目录”混淆的一类。
- 作用场景是资源管理器窗口内空白区域右键，不是选中某个文件夹。
- 这类项目常用于“在此处打开终端/命令行”“新建”“排序/视图扩展”等场景。

### 4. 驱动器

- 盘符根对象有独立的 `Drive` 类。
- 它不能简单归并到 `Directory`，因为 Shell 对驱动器根节点保留了独立入口。
- 对 RightCleaner 而言，驱动器相关命令应单列，否则用户会误以为它属于普通目录菜单。

### 5. 桌面

- 如果用户说“桌面右键菜单”，实际至少分两种情况：
  - 桌面空白处右键，对应 `DesktopBackground`。
  - 桌面上的文件、文件夹、快捷方式右键，仍然属于文件/目录/快捷方式自身类型。
- `DesktopBackground` 是经典 Shell 注册中的独立入口，但 Microsoft 当前公开的 Windows 11 一级菜单扩展文档没有给出与之对应的现代 ItemType。

## Windows 10 / 11 差异

| 维度 | Windows 10 | Windows 11 |
| --- | --- | --- |
| 默认右键菜单 | 经典菜单为主 | 新一级菜单 + `显示更多选项` 的经典菜单 |
| 传统 `shell` / `shellex` 注册 | 通常直接显示在主菜单 | 仍兼容，但很多第三方项主要出现在 `显示更多选项` |
| 一级菜单推荐扩展模型 | 仍可继续使用传统模型 | 官方推荐 `IExplorerCommand` + 应用标识 |
| 文档明确列出的现代对象类型 | 无此限制，主要看经典注册 | 明确列出 `*`、扩展名、`Directory`、`Directory\Background` |
| `Drive` | 经典菜单支持 | 经典兼容仍在；但 Microsoft 未给出其一级菜单现代 ItemType |
| `DesktopBackground` | 经典菜单支持 | 经典兼容仍在；但 Microsoft 未给出其一级菜单现代 ItemType |

## 对 MIN-38 的落地范围建议

本任务应把下面这些入口都纳入“支持范围”：

- 文件：`*`、扩展名、`ProgID`
- 文件/目录通用：`AllFileSystemObjects`
- 目录：`Directory`
- 广义文件夹：`Folder`
- 目录背景：`Directory\Background`
- 驱动器：`Drive`
- 桌面背景：`DesktopBackground`

同时应明确两个实现边界：

- `桌面上的文件/快捷方式` 不应归为独立对象类型，而应按真实对象类型回收。
- Windows 11 的一级菜单支持范围不能仅靠经典注册表推断；对 `Drive`、`DesktopBackground` 这类对象，当前公开文档更适合视为“经典菜单兼容支持”，而不是“一级现代菜单有独立官方扩展入口”。

## 可直接采用的产品口径

可对外描述为：

> RightCleaner 当前梳理并覆盖的 Windows Shell 右键对象包括文件、目录、目录背景、驱动器、桌面背景，以及由扩展名 / ProgID / AllFileSystemObjects / Folder 带来的跨对象或扩展对象范围。Windows 10 主要体现为经典右键菜单；Windows 11 仍兼容这些注册点，但很多第三方菜单项会落入“显示更多选项”，其中一级菜单的官方可扩展对象范围目前明确收敛在文件、目录和目录背景。

## 参考资料

1. Registering Shell Extension Handlers  
   https://learn.microsoft.com/en-us/windows/win32/shell/reg-shell-exts
2. Integrate a packaged desktop app with File Explorer  
   https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/integrate-packaged-app-with-file-explorer
3. Support legacy context menus for apps packaged with the package support framework  
   https://learn.microsoft.com/en-us/windows/msix/packaging-tool/support-legacy-context-menus
4. Extending the Context Menu and Share Dialog in Windows 11  
   https://blogs.windows.com/windowsdeveloper/2021/07/19/extending-the-context-menu-and-share-dialog-in-windows-11/

## 备注

- 上述 `Drive`、`DesktopBackground` 在 Windows 11 一级现代菜单中的限制，是基于 Microsoft 当前公开文档中 `未列出对应现代 ItemType` 所做的谨慎结论，不代表系统内部绝对不存在其他私有或未公开入口。
- 本文面向 MIN-38 的范围确认，重点是“对象类型与入口梳理”；未继续展开 `CommandStore`、级联菜单、COM InprocServer32 细节，后续实现时再分拆。
