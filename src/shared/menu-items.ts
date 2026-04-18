export type MenuSourceKind = "shell_verb" | "shell_extension" | "command_store";

export type MenuTargetKind =
  | "file"
  | "directory"
  | "directory_background"
  | "drive"
  | "desktop_background"
  | "folder"
  | "all_file_system_objects";

export type MenuVisibility = "primary" | "extended_only" | "programmatic_only";

export type MenuTraceValue = {
  name: string;
  valueType: string;
  data: string;
  sourcePath: string;
};

export type MenuCommandInfo = {
  verb: string | null;
  command: string | null;
  delegateExecute: string | null;
  explorerCommandHandler: string | null;
  subCommands: string[];
};

export type MenuTraceInfo = {
  registrationPath: string;
  commandPath: string | null;
  commandStorePaths: string[];
  sourceValues: MenuTraceValue[];
  notes: string[];
};

export type NormalizedMenuItem = {
  id: string;
  title: string;
  canonicalTitle: string;
  sourceKind: MenuSourceKind;
  sourceLabel: string;
  target: MenuTargetKind;
  targetLabel: string;
  enabled: boolean;
  editable: boolean;
  visibility: MenuVisibility;
  command: MenuCommandInfo | null;
  handlerClsid: string | null;
  trace: MenuTraceInfo;
  tags: string[];
};

export type MenuItemBackupAction = "enable" | "disable";

export type MenuItemBackupStatus = "ready" | "restored";

export type MenuItemBackupRecord = {
  id: string;
  itemId: string;
  itemTitle: string;
  registryPath: string;
  label: string;
  createdAt: string;
  action: MenuItemBackupAction;
  status: MenuItemBackupStatus;
  previousEnabled: boolean;
  resultingEnabled: boolean;
  previousLegacyDisable: string | null;
};

export type MenuItemFilterState = {
  keyword: string;
  sourceKind: MenuSourceKind | null;
  target: MenuTargetKind | null;
  enabledOnly: boolean;
  editableOnly: boolean;
};

export function formatMenuSourceKind(sourceKind: MenuSourceKind) {
  switch (sourceKind) {
    case "shell_verb":
      return "Shell 命令";
    case "shell_extension":
      return "Shell 扩展";
    case "command_store":
      return "Command Store";
    default:
      return sourceKind;
  }
}

export function formatMenuVisibility(visibility: MenuVisibility) {
  switch (visibility) {
    case "primary":
      return "主菜单可见";
    case "extended_only":
      return "仅扩展菜单";
    case "programmatic_only":
      return "仅编程访问";
    default:
      return visibility;
  }
}

export function filterMenuItems(items: NormalizedMenuItem[], filters: MenuItemFilterState) {
  const keyword = filters.keyword.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.sourceKind && item.sourceKind !== filters.sourceKind) {
      return false;
    }

    if (filters.target && item.target !== filters.target) {
      return false;
    }

    if (filters.enabledOnly && !item.enabled) {
      return false;
    }

    if (filters.editableOnly && !item.editable) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystacks = [
      item.title,
      item.canonicalTitle,
      item.sourceLabel,
      item.targetLabel,
      item.trace.registrationPath,
      item.command?.command ?? "",
      item.handlerClsid ?? "",
      item.tags.join(" ")
    ];

    return haystacks.some((value) => value.toLowerCase().includes(keyword));
  });
}
