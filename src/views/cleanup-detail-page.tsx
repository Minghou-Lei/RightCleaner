import { Link, useParams } from "react-router-dom";

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
  type RiskLevel,
} from "@/features/cleanup/menu-item-detection";
import {
  formatMenuSourceKind,
  formatMenuVisibility,
  type NormalizedMenuItem,
} from "../shared/menu-items";
import { useAppState } from "../state/app-state";

type DetailSection = {
  label: string;
  value: string;
  tone?: RiskLevel;
};

function getSourceSummary(item: NormalizedMenuItem) {
  if (item.tags.includes("unknown-source")) {
    return "来源未完成归属识别，处置前应先核对发布者或安装软件。";
  }

  if (item.sourceKind === "shell_extension") {
    return "来自 Shell 扩展处理器，通常由第三方软件注册并通过 CLSID 接管菜单行为。";
  }

  if (item.sourceKind === "command_store") {
    return "来自 Explorer Command Store，可被多个菜单入口复用，修改时会影响同一命令的其它挂载点。";
  }

  return "来自标准 Shell Verb 注册项，通常直接声明菜单文案与命令行。";
}

function getExecutionSummary(item: NormalizedMenuItem) {
  if (item.command?.command) {
    return item.command.command;
  }

  if (item.handlerClsid) {
    return `通过 CLSID ${item.handlerClsid} 调用 Shell 扩展处理器`;
  }

  return "当前未解析到直接命令，可能为残留项或需要进一步追踪。";
}

function getRiskSections(item: NormalizedMenuItem, detection: ReturnType<typeof analyzeNormalizedMenuItem>) {
  const sections: DetailSection[] = [
    {
      label: "当前判定",
      value: `${detection.headline}。${detection.detail}`,
      tone: detection.badgeTone,
    },
  ];

  const registrationPath = item.trace.registrationPath.toUpperCase();
  if (registrationPath.startsWith("HKEY_LOCAL_MACHINE\\") || registrationPath.startsWith("HKEY_CLASSES_ROOT\\")) {
    sections.push({
      label: "作用范围",
      value: "该注册表位置通常影响整机或所有用户，禁用前应确认不会波及团队通用菜单。",
      tone: "medium",
    });
  }

  if (item.command?.delegateExecute || item.command?.explorerCommandHandler) {
    sections.push({
      label: "执行链",
      value: "该项含有 DelegateExecute 或 ExplorerCommandHandler，真实行为可能不止一条命令行。",
      tone: "high",
    });
  }

  if (item.command?.command && /(powershell|cmd\.exe|rundll32|regsvr32|msiexec|wscript|cscript)/i.test(item.command.command)) {
    sections.push({
      label: "高风险命令",
      value: "命令链中包含脚本宿主或系统装载器，建议先审计参数与目标文件，再决定是否禁用。",
      tone: "high",
    });
  }

  if (item.sourceKind === "command_store") {
    sections.push({
      label: "复用提示",
      value: "Command Store 项常被多个目标对象共用，修改后可能同时影响文件、目录或背景菜单。",
      tone: "medium",
    });
  }

  if (item.tags.includes("unknown-source")) {
    sections.push({
      label: "归属待确认",
      value: "来源不明通常意味着卸载残留或手工注册，建议先导出注册表备份并确认安装来源。",
      tone: "high",
    });
  }

  return sections;
}

function getRegistrySections(item: NormalizedMenuItem) {
  const sections: DetailSection[] = [
    { label: "主注册项", value: item.trace.registrationPath },
    { label: "命令键", value: item.trace.commandPath ?? "无单独命令子键" },
  ];

  item.trace.commandStorePaths.forEach((path, index) => {
    sections.push({ label: `Command Store ${index + 1}`, value: path });
  });

  item.trace.sourceValues.forEach((value, index) => {
    sections.push({
      label: `注册表值 ${index + 1}`,
      value: `${value.name} (${value.valueType}) = ${value.data} @ ${value.sourcePath}`,
    });
  });

  item.trace.notes.forEach((note, index) => {
    sections.push({ label: `追踪备注 ${index + 1}`, value: note });
  });

  return sections;
}

export function CleanupDetailPage() {
  const { itemId } = useParams();
  const {
    state: { menuItems, operationError },
    activeItemId,
    toggleMenuItemEnabled,
  } = useAppState();

  const item =
    menuItems.find((entry) => entry.id === itemId) ??
    menuItems[0] ?? {
      id: "fallback",
      title: "未找到菜单项",
      canonicalTitle: "missing menu item",
      sourceKind: "shell_verb" as const,
      sourceLabel: "未知来源",
      target: "file" as const,
      targetLabel: "未知对象",
      enabled: false,
      editable: false,
      visibility: "primary" as const,
      command: null,
      handlerClsid: null,
      trace: {
        registrationPath: "N/A",
        commandPath: null,
        commandStorePaths: [],
        sourceValues: [],
        notes: ["当前路由尚未绑定到具体数据项。"],
      },
      tags: [],
    };

  const duplicateGroup =
    menuItems.filter((entry) => entry.canonicalTitle === item.canonicalTitle).length > 1
      ? item.canonicalTitle
      : null;
  const detection = analyzeNormalizedMenuItem(item, duplicateGroup);
  const sourceSections: DetailSection[] = [
    { label: "来源类型", value: formatMenuSourceKind(item.sourceKind) },
    { label: "适用对象", value: item.targetLabel },
    { label: "来源说明", value: getSourceSummary(item) },
  ];
  const commandSections: DetailSection[] = [
    { label: "执行内容", value: getExecutionSummary(item) },
    { label: "Verb", value: item.command?.verb ?? "无" },
    { label: "DelegateExecute", value: item.command?.delegateExecute ?? "无" },
    { label: "Explorer Handler", value: item.command?.explorerCommandHandler ?? "无" },
    {
      label: "子命令",
      value: item.command?.subCommands.length ? item.command.subCommands.join(" / ") : "无",
    },
    { label: "CLSID", value: item.handlerClsid ?? "无" },
  ];
  const registrySections = getRegistrySections(item);
  const riskSections = getRiskSections(item, detection);

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">菜单项详情</span>
          <h2 className="rc-title">{item.title}</h2>
          <p className="rc-body">
            {formatMenuSourceKind(item.sourceKind)} · {item.targetLabel} ·{" "}
            {formatMenuVisibility(item.visibility)}
          </p>
        </div>
        <div className="rc-hero__actions">
          <button
            className="rc-button rc-button-primary"
            disabled={!item.editable || activeItemId === item.id}
            onClick={() => void toggleMenuItemEnabled(item.id, !item.enabled)}
            type="button"
          >
            {activeItemId === item.id ? "处理中..." : item.enabled ? "禁用该项" : "重新启用"}
          </button>
          <Link className="rc-button rc-button-secondary" to="/cleanup">
            返回列表
          </Link>
          <Link className="rc-button rc-button-primary" to="/batch">
            加入批量
          </Link>
        </div>
      </header>

      {operationError ? <p className="rc-body">{operationError}</p> : null}

      <div className="rc-grid rc-grid--two">
        <section className="rc-card">
          <h3>识别结果</h3>
          <p className="rc-body">{detection.detail}</p>
          {detection.tags.length > 0 ? (
            <div className="rc-tag-row">
              {detection.tags.map((tag) => (
                <span className="rc-pill rc-pill--info" key={tag}>
                  {getDetectionTagLabel(tag)}
                </span>
              ))}
            </div>
          ) : (
            <span className={`rc-pill rc-pill--${detection.badgeTone}`}>{detection.headline}</span>
          )}
        </section>
        <section className="rc-card">
          <h3>来源</h3>
          <dl className="rc-detail-list">
            {sourceSections.map((section) => (
              <div className="rc-detail-list__row" key={section.label}>
                <dt>{section.label}</dt>
                <dd>{section.value}</dd>
              </div>
            ))}
            <div className="rc-detail-list__row">
              <dt>启用状态</dt>
              <dd>{item.enabled ? "已启用" : "已禁用"}</dd>
            </div>
            <div className="rc-detail-list__row">
              <dt>可编辑</dt>
              <dd>{item.editable ? "支持直接处置" : "当前仅支持查看"}</dd>
            </div>
          </dl>
        </section>
        <section className="rc-card">
          <h3>命令</h3>
          <dl className="rc-detail-list">
            {commandSections.map((section) => (
              <div className="rc-detail-list__row" key={section.label}>
                <dt>{section.label}</dt>
                <dd>{section.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rc-card">
          <h3>注册表位置</h3>
          <dl className="rc-detail-list">
            {registrySections.map((section) => (
              <div className="rc-detail-list__row" key={section.label}>
                <dt>{section.label}</dt>
                <dd>{section.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rc-card">
          <h3>风险提示</h3>
          <div className="rc-stack">
            {riskSections.map((section) => (
              <article className={`rc-detail-note rc-detail-note--${section.tone ?? "low"}`} key={section.label}>
                <strong>{section.label}</strong>
                <p className="rc-body">{section.value}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
