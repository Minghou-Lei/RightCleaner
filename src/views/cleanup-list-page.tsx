import { Link } from "react-router-dom";

import {
  formatMenuSourceKind,
  formatMenuVisibility,
  type MenuSourceKind,
  type MenuTargetKind
} from "../shared/menu-items";
import { useAppState, useFilteredMenuItems } from "../state/app-state";

export function CleanupListPage() {
  const {
    state: { filters, menuLoadError, selectedItemIds },
    dispatch
  } = useAppState();
  const menuItems = useFilteredMenuItems();

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">菜单项列表</span>
          <h2 className="rc-title">统一查看不同来源的 Shell 菜单项</h2>
        </div>
      </header>

      <section className="rc-card rc-toolbar">
        <input
          className="rc-input"
          placeholder="搜索菜单项标题、路径、命令或 CLSID"
          value={filters.keyword}
          onChange={(event) => dispatch({ type: "set-filter", filter: { keyword: event.target.value } })}
        />
        <select
          className="rc-input"
          value={filters.sourceKind ?? ""}
          onChange={(event) =>
            dispatch({
              type: "set-filter",
              filter: { sourceKind: (event.target.value || null) as MenuSourceKind | null }
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
              filter: { target: (event.target.value || null) as MenuTargetKind | null }
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

      <div className="rc-stack">
        {menuItems.map((item) => {
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
                  <span className="rc-pill rc-pill--info">{item.enabled ? "enabled" : "disabled"}</span>
                </div>
                <p className="rc-body">
                  {formatMenuSourceKind(item.sourceKind)} · {item.targetLabel} ·{" "}
                  {formatMenuVisibility(item.visibility)}
                </p>
              </div>
              <div className="rc-row__meta">
                <span>{item.command?.command ?? item.handlerClsid ?? item.trace.registrationPath}</span>
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
