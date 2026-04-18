import { invoke } from "@tauri-apps/api/core";

import type { NormalizedMenuItem } from "./menu-items";

const fallbackMenuItems: NormalizedMenuItem[] = [
  {
    id: "shell-verb-open-code",
    title: "Open with Code",
    canonicalTitle: "open with code",
    sourceKind: "shell_verb",
    sourceLabel: "文件",
    target: "file",
    targetLabel: "文件",
    enabled: true,
    editable: true,
    visibility: "primary",
    command: {
      verb: "openwithcode",
      command: "\"C:\\\\Program Files\\\\Microsoft VS Code\\\\Code.exe\" \"%1\"",
      delegateExecute: null,
      explorerCommandHandler: null,
      subCommands: []
    },
    handlerClsid: null,
    trace: {
      registrationPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode",
      commandPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode\\command",
      commandStorePaths: [],
      sourceValues: [
        {
          name: "MUIVerb",
          valueType: "REG_SZ",
          data: "Open with Code",
          sourcePath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode"
        }
      ],
      notes: ["当前为前端回退数据，用于非 Tauri 环境预览。"]
    },
    tags: ["fallback", "verb", "file"]
  },
  {
    id: "shell-extension-7zip",
    title: "7-Zip",
    canonicalTitle: "7-zip",
    sourceKind: "shell_extension",
    sourceLabel: "目录",
    target: "directory",
    targetLabel: "目录",
    enabled: true,
    editable: true,
    visibility: "primary",
    command: null,
    handlerClsid: "{23170F69-40C1-278A-1000-000100020000}",
    trace: {
      registrationPath: "HKEY_CLASSES_ROOT\\Directory\\shellex\\ContextMenuHandlers\\7-Zip",
      commandPath: null,
      commandStorePaths: [],
      sourceValues: [
        {
          name: "(Default)",
          valueType: "REG_SZ",
          data: "{23170F69-40C1-278A-1000-000100020000}",
          sourcePath: "HKEY_CLASSES_ROOT\\Directory\\shellex\\ContextMenuHandlers\\7-Zip"
        }
      ],
      notes: ["当前为前端回退数据，用于非 Tauri 环境预览。"]
    },
    tags: ["fallback", "handler", "directory"]
  },
  {
    id: "command-store-windows-terminal",
    title: "Windows Terminal",
    canonicalTitle: "windows terminal",
    sourceKind: "command_store",
    sourceLabel: "目录背景",
    target: "directory_background",
    targetLabel: "目录背景",
    enabled: true,
    editable: true,
    visibility: "primary",
    command: {
      verb: "wt",
      command: "\"C:\\\\Program Files\\\\WindowsApps\\\\Microsoft.WindowsTerminal\\\\wt.exe\" -d \"%V\"",
      delegateExecute: null,
      explorerCommandHandler: null,
      subCommands: ["WindowsTerminal"]
    },
    handlerClsid: null,
    trace: {
      registrationPath:
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell\\WindowsTerminal",
      commandPath:
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell\\WindowsTerminal\\command",
      commandStorePaths: [
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell\\WindowsTerminal"
      ],
      sourceValues: [
        {
          name: "MUIVerb",
          valueType: "REG_SZ",
          data: "Windows Terminal",
          sourcePath:
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell\\WindowsTerminal"
        }
      ],
      notes: ["当前为前端回退数据，用于非 Tauri 环境预览。"]
    },
    tags: ["fallback", "command-store", "directory-background"]
  }
];

export async function loadMenuItems() {
  try {
    return await invoke<NormalizedMenuItem[]>("list_menu_items");
  } catch {
    return fallbackMenuItems;
  }
}
