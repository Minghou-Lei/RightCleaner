import type { NormalizedMenuItem } from "@/shared/menu-items";

export type RiskLevel = "low" | "medium" | "high";
export type MenuItemSource = "windows" | "third-party" | "unknown";
export type MenuItemVisibility = "visible" | "hidden";
export type MenuItemTargetState = "healthy" | "missing" | "unresolved";

export type DetectionTag =
  | "abnormal"
  | "duplicate"
  | "hidden"
  | "third-party"
  | "unknown-source";

export type DetectionInput = {
  commandState: MenuItemTargetState;
  duplicateGroup: string | null;
  visibility: MenuItemVisibility;
  source: MenuItemSource;
};

export type DetectionSummary = {
  tags: DetectionTag[];
  badgeTone: RiskLevel;
  headline: string;
  detail: string;
};

const tagOrder: DetectionTag[] = [
  "abnormal",
  "duplicate",
  "hidden",
  "third-party",
  "unknown-source",
];

const tagLabels: Record<DetectionTag, string> = {
  abnormal: "异常",
  duplicate: "重复",
  hidden: "已隐藏",
  "third-party": "第三方扩展",
  "unknown-source": "来源不明",
};

export function getDetectionTagLabel(tag: DetectionTag) {
  return tagLabels[tag];
}

export function analyzeMenuItemDetection(input: DetectionInput): DetectionSummary {
  const tags = new Set<DetectionTag>();
  const reasons: string[] = [];

  if (input.commandState !== "healthy") {
    tags.add("abnormal");
    reasons.push(
      input.commandState === "missing"
        ? "命令路径或扩展入口已失效。"
        : "当前注册项未提供可解析的来源信息。"
    );
  }

  if (input.duplicateGroup) {
    tags.add("duplicate");
    reasons.push("与其他菜单项共享同一动作分组，可能重复堆叠。");
  }

  if (input.visibility === "hidden") {
    tags.add("hidden");
    reasons.push("当前项已被注册为隐藏，不应默认暴露给用户。");
  }

  if (input.source === "third-party") {
    tags.add("third-party");
    reasons.push("来源于第三方扩展，需要额外提示清理影响。");
  }

  if (input.source === "unknown") {
    tags.add("unknown-source");
    reasons.push("未识别到明确发布者或归属。");
  }

  const orderedTags = tagOrder.filter((tag) => tags.has(tag));
  const badgeTone: RiskLevel =
    orderedTags.includes("abnormal") || orderedTags.includes("unknown-source")
      ? "high"
      : orderedTags.includes("duplicate") || orderedTags.includes("third-party")
        ? "medium"
        : "low";

  const headline =
    orderedTags.length === 0
      ? "状态正常"
      : orderedTags.map((tag) => tagLabels[tag]).join(" / ");

  const detail =
    reasons.length === 0 ? "未发现失效、重复、隐藏或来源异常。" : reasons.join(" ");

  return {
    tags: orderedTags,
    badgeTone,
    headline,
    detail,
  };
}

function inferSource(item: NormalizedMenuItem): MenuItemSource {
  if (item.tags.includes("unknown-source")) {
    return "unknown";
  }

  if (item.sourceKind === "shell_extension") {
    return "third-party";
  }

  return "windows";
}

function inferVisibility(item: NormalizedMenuItem): MenuItemVisibility {
  return item.enabled && item.visibility === "primary" ? "visible" : "hidden";
}

function inferCommandState(item: NormalizedMenuItem): MenuItemTargetState {
  if (item.command?.command || item.handlerClsid) {
    return "healthy";
  }

  return item.tags.includes("fallback") ? "unresolved" : "missing";
}

export function analyzeNormalizedMenuItem(
  item: NormalizedMenuItem,
  duplicateGroup: string | null
) {
  return analyzeMenuItemDetection({
    commandState: inferCommandState(item),
    duplicateGroup,
    visibility: inferVisibility(item),
    source: inferSource(item),
  });
}
