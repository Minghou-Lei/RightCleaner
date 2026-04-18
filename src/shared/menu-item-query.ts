import type { NormalizedMenuItem } from "./menu-items";

export type RiskLevel = "low" | "medium" | "high";
export type MenuItemSourceCategory = "windows" | "third_party" | "unknown";
export type MenuItemStatus = "enabled" | "disabled" | "hidden";

export type MenuItemQueryMeta = {
  source: MenuItemSourceCategory;
  status: MenuItemStatus;
  riskLevel: RiskLevel;
};

const riskRank: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function getMenuItemSourceCategory(item: NormalizedMenuItem): MenuItemSourceCategory {
  if (item.tags.includes("unknown-source")) {
    return "unknown";
  }

  if (item.sourceKind === "shell_extension") {
    return "third_party";
  }

  return "windows";
}

export function getMenuItemStatus(item: NormalizedMenuItem): MenuItemStatus {
  if (!item.enabled) {
    return "disabled";
  }

  if (item.visibility !== "primary") {
    return "hidden";
  }

  return "enabled";
}

function getMenuItemRiskLevel(item: NormalizedMenuItem, duplicateGroup: string | null): RiskLevel {
  const source = getMenuItemSourceCategory(item);
  const hasBrokenCommand = !item.command?.command && !item.handlerClsid;
  const hasUnknownCommand = item.tags.includes("fallback");

  if (source === "unknown" || hasBrokenCommand || hasUnknownCommand) {
    return "high";
  }

  if (source === "third_party" || duplicateGroup) {
    return "medium";
  }

  return "low";
}

export function getMenuItemQueryMeta(
  item: NormalizedMenuItem,
  duplicateGroup: string | null
): MenuItemQueryMeta {
  return {
    source: getMenuItemSourceCategory(item),
    status: getMenuItemStatus(item),
    riskLevel: getMenuItemRiskLevel(item, duplicateGroup),
  };
}

export function formatMenuItemSourceCategory(source: MenuItemSourceCategory) {
  switch (source) {
    case "windows":
      return "Windows";
    case "third_party":
      return "第三方";
    case "unknown":
      return "未知来源";
    default:
      return source;
  }
}

export function formatMenuItemStatus(status: MenuItemStatus) {
  switch (status) {
    case "enabled":
      return "启用中";
    case "disabled":
      return "已禁用";
    case "hidden":
      return "隐藏项";
    default:
      return status;
  }
}

export function formatRiskLevel(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "low":
      return "低风险";
    case "medium":
      return "中风险";
    case "high":
      return "高风险";
    default:
      return riskLevel;
  }
}

export function compareRiskLevel(left: RiskLevel, right: RiskLevel) {
  return riskRank[left] - riskRank[right];
}
