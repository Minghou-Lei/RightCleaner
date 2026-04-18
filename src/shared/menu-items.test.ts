import { describe, expect, it } from "vitest";

import { filterMenuItems, type NormalizedMenuItem } from "./menu-items";

const sampleItems: NormalizedMenuItem[] = [
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
      command: "\"Code.exe\" \"%1\"",
      delegateExecute: null,
      explorerCommandHandler: null,
      subCommands: []
    },
    handlerClsid: null,
    trace: {
      registrationPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode",
      commandPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode\\command",
      commandStorePaths: [],
      sourceValues: [],
      notes: []
    },
    tags: ["verb"]
  },
  {
    id: "handler-7zip",
    title: "7-Zip",
    canonicalTitle: "7-zip",
    sourceKind: "shell_extension",
    sourceLabel: "目录",
    target: "directory",
    targetLabel: "目录",
    enabled: false,
    editable: true,
    visibility: "primary",
    command: null,
    handlerClsid: "{23170F69-40C1-278A-1000-000100020000}",
    trace: {
      registrationPath: "HKEY_CLASSES_ROOT\\Directory\\shellex\\ContextMenuHandlers\\7-Zip",
      commandPath: null,
      commandStorePaths: [],
      sourceValues: [],
      notes: []
    },
    tags: ["handler"]
  }
];

describe("filterMenuItems", () => {
  it("matches keyword against registry trace and command", () => {
    const result = filterMenuItems(sampleItems, {
      keyword: "openwithcode",
      sourceKind: null,
      target: null,
      enabledOnly: false,
      editableOnly: false
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("shell-verb-open-code");
  });

  it("applies enabled and source filters together", () => {
    const result = filterMenuItems(sampleItems, {
      keyword: "",
      sourceKind: "shell_extension",
      target: null,
      enabledOnly: true,
      editableOnly: false
    });

    expect(result).toHaveLength(0);
  });
});
