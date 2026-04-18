import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
} from "@/features/cleanup/menu-item-detection";
import {
  formatMenuSourceKind,
  formatMenuVisibility,
  type MenuSourceKind,
  type MenuTargetKind,
} from "../shared/menu-items";
import { useAppState, useFilteredMenuItems } from "../state/app-state";

export function CleanupListPage() {
  const {
    state: { filters, menuLoadError, operationError, selectedItemIds },
    dispatch,
    activeItemId,
    toggleMenuItemEnabled,
  } = useAppState();
  const menuItems = useFilteredMenuItems();

  const duplicateGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      counts.set(item.canonicalTitle, (counts.get(item.canonicalTitle) ?? 0) + 1);
    }
    return counts;
  }, [menuItems]);

  const detectedItems = useMemo(
    () =>
      menuItems.map((item) => ({
        item,
        detection: analyzeNormalizedMenuItem(
          item,
          (duplicateGroups.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null
        ),
      })),
    [duplicateGroups, menuItems]
  );

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">清理项列表</span>
          <h2 className="rc-title">菜单项识别结果与批量处置入口</h2>
        </div>
      </header>

      <section className="rc-card rc-toolbar">
        <input
          className="rc-input"
          placeholder="搜索菜单项标题、路径、命令、CLSID 或异常标签"
          value={filters.keyword}
          onChange={(event) => dispatch({ type: "set-filter", filter: { keyword: event.target.value } })}
        />
        <select
          className="rc-input"
          value={filters.sourceKind ?? ""}
          onChange={(event) =>
            dispatch({
              type: "set-filter",
              filter: { sourceKind: (event.target.value || null) as MenuSourceKind | null },
            })
          }
        >
          <option value="">全部来源</option>
          <option value="shell_verb">Shell 命令</option>
          <option value="shell_extension">Shell 扩展</option>
          <option value="command_store">Command Store</option>
        </select>
        <select
          className="rc-input"
          value={filters.target ?? ""}
          onChange={(event) =>
            dispatch({
              type: "set-filter",
              filter: { target: (event.target.value || null) as MenuTargetKind | null },
            })
          }
        >
          <option value="">全部对象</option>
          <option value="file">文件</option>
          <option value="directory">目录</option>
          <option value="directory_background">目录背景</option>
          <option value="drive">驱动器</option>
          <option value="desktop_background">桌面背景</option>
          <option value="folder">Folder</option>
          <option value="all_file_system_objects">文件系统对象</option>
        </select>
        <button
          className="rc-button rc-button-secondary"
          onClick={() => dispatch({ type: "set-filter", filter: { enabledOnly: !filters.enabledOnly } })}
          type="button"
        >
          {filters.enabledOnly ? "显示全部" : "仅启用项"}
        </button>
        <button
          className="rc-button rc-button-secondary"
          onClick={() => dispatch({ type: "set-filter", filter: { editableOnly: !filters.editableOnly } })}
          type="button"
        >
          {filters.editableOnly ? "显示全部" : "仅可编辑"}
        </button>
      </section>

      {menuLoadError ? <p className="rc-body">{menuLoadError}</p> : null}
      {operationError ? <p className="rc-body">{operationError}</p> : null}

      <div className="rc-stack">
        {detectedItems.map(({ item, detection }) => {
          const selected = selectedItemIds.includes(item.id);
          return (
            <article className="rc-card rc-row" key={item.id}>
              <label className="rc-row__checkbox">
                <input
                  checked={selected}
                  onChange={() => dispatch({ type: "toggle-item-selection", itemId: item.id })}
                  type="checkbox"
                />
                <span />
              </label>
              <div className="rc-row__content">
                <div className="rc-row__title">
                  <strong>{item.title}</strong>
                  <span className={`rc-pill rc-pill--${detection.badgeTone}`}>{detection.headline}</span>
                </div>
                <p className="rc-body">
                  {formatMenuSourceKind(item.sourceKind)} · {item.targetLabel} ·{" "}
                  {formatMenuVisibility(item.visibility)}
                </p>
                <p className="rc-body">{detection.detail}</p>
                {detection.tags.length > 0 ? (
                  <div className="rc-tag-row">
                    {detection.tags.map((tag) => (
                      <span className="rc-pill rc-pill--info" key={tag}>
                        {getDetectionTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="rc-row__meta">
                <span>{item.command?.command ?? item.handlerClsid ?? item.trace.registrationPath}</span>
                <button
                  className="rc-button rc-button-primary"
                  disabled={activeItemId === item.id || !item.editable}
                  onClick={() => void toggleMenuItemEnabled(item.id, !item.enabled)}
                  type="button"
                >
                  {activeItemId === item.id ? "处理中..." : item.enabled ? "禁用" : "启用"}
                </button>
                <Link className="rc-button rc-button-secondary" to={`/cleanup/${item.id}`}>
                  查看详情
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
