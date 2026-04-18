import { Link, useParams } from "react-router-dom";

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
} from "@/features/cleanup/menu-item-detection";
import { formatMenuSourceKind, formatMenuVisibility } from "../shared/menu-items";
import { useAppState } from "../state/app-state";

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
          <h3>可编辑字段</h3>
          <div className="rc-stack">
            <p className="rc-body">启用状态: {item.enabled ? "enabled" : "disabled"}</p>
            <p className="rc-body">可编辑: {item.editable ? "yes" : "no"}</p>
            <p className="rc-body">命令: {item.command?.command ?? "无直接命令"}</p>
            <p className="rc-body">CLSID: {item.handlerClsid ?? "无"}</p>
          </div>
        </section>
        <section className="rc-card">
          <h3>追踪信息</h3>
          <div className="rc-stack">
            <p className="rc-body">注册路径: {item.trace.registrationPath}</p>
            <p className="rc-body">命令路径: {item.trace.commandPath ?? "无"}</p>
            {item.trace.commandStorePaths.map((path) => (
              <p className="rc-body" key={path}>
                Command Store: {path}
              </p>
            ))}
            {item.trace.notes.map((note) => (
              <p className="rc-body" key={note}>
                {note}
              </p>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
