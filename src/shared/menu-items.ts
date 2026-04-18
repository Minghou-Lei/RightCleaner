import {
  compareRiskLevel,
  formatMenuItemSourceCategory,
  formatMenuItemStatus,
  formatRiskLevel,
  getMenuItemQueryMeta,
  type MenuItemSourceCategory,
  type MenuItemStatus,
  type RiskLevel,
} from "./menu-item-query";

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

export type MenuItemPermissionSummary = {
  registrationPath: string;
  requiresElevation: boolean;
  isProcessElevated: boolean;
  canWriteWithoutElevation: boolean;
  recommendedAction: string;
  warning: string | null;
};

export type MenuItemMutationStatus =
  | "applied"
  | "applied_with_elevation"
  | "elevation_cancelled"
  | "rolled_back"
  | "failed";

export type MenuItemMutationResult = {
  registrationPath: string;
  status: MenuItemMutationStatus;
  requiresElevation: boolean;
  wasElevated: boolean;
  rollbackPerformed: boolean;
  backupFilePath: string | null;
  message: string;
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
  target: MenuTargetKind | null;
  source: MenuItemSourceCategory | null;
  status: MenuItemStatus | null;
  riskLevel: RiskLevel | null;
  editableOnly: boolean;
  sortBy: "title" | "target" | "source" | "status" | "riskLevel";
  sortDirection: "asc" | "desc";
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
  const duplicateCounts = new Map<string, number>();

  for (const item of items) {
    duplicateCounts.set(item.canonicalTitle, (duplicateCounts.get(item.canonicalTitle) ?? 0) + 1);
  }

  const filteredItems = items.filter((item) => {
    const duplicateGroup =
      (duplicateCounts.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null;
    const meta = getMenuItemQueryMeta(item, duplicateGroup);

    if (filters.source && meta.source !== filters.source) {
      return false;
    }

    if (filters.target && item.target !== filters.target) {
      return false;
    }

    if (filters.status && meta.status !== filters.status) {
      return false;
    }

    if (filters.editableOnly && !item.editable) {
      return false;
    }

    if (filters.riskLevel && meta.riskLevel !== filters.riskLevel) {
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
      formatMenuItemSourceCategory(meta.source),
      formatMenuItemStatus(meta.status),
      formatRiskLevel(meta.riskLevel),
      item.trace.registrationPath,
      item.command?.command ?? "",
      item.handlerClsid ?? "",
      item.tags.join(" ")
    ];

    return haystacks.some((value) => value.toLowerCase().includes(keyword));
  });

  return filteredItems.sort((left, right) => {
    const leftDuplicateGroup =
      (duplicateCounts.get(left.canonicalTitle) ?? 0) > 1 ? left.canonicalTitle : null;
    const rightDuplicateGroup =
      (duplicateCounts.get(right.canonicalTitle) ?? 0) > 1 ? right.canonicalTitle : null;
    const leftMeta = getMenuItemQueryMeta(left, leftDuplicateGroup);
    const rightMeta = getMenuItemQueryMeta(right, rightDuplicateGroup);

    let comparison = 0;

    switch (filters.sortBy) {
      case "target":
        comparison = left.targetLabel.localeCompare(right.targetLabel, "zh-CN");
        break;
      case "source":
        comparison = formatMenuItemSourceCategory(leftMeta.source).localeCompare(
          formatMenuItemSourceCategory(rightMeta.source),
          "zh-CN"
        );
        break;
      case "status":
        comparison = formatMenuItemStatus(leftMeta.status).localeCompare(
          formatMenuItemStatus(rightMeta.status),
          "zh-CN"
        );
        break;
      case "riskLevel":
        comparison = compareRiskLevel(leftMeta.riskLevel, rightMeta.riskLevel);
        break;
      case "title":
      default:
        comparison = left.title.localeCompare(right.title, "zh-CN");
        break;
    }

    if (comparison === 0) {
      comparison = left.title.localeCompare(right.title, "zh-CN");
    }

    return filters.sortDirection === "desc" ? comparison * -1 : comparison;
  });
}
