import { Link } from "react-router-dom";

import { useAppState } from "../state/app-state";

export function CleanupListPage() {
  const {
    state: { cleanupItems, filters, selectedItemIds },
    dispatch
  } = useAppState();

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">清理项列表</span>
          <h2 className="rc-title">主决策场景和批量选择入口</h2>
        </div>
      </header>

      <section className="rc-card rc-toolbar">
        <input
          className="rc-input"
          placeholder="搜索清理项、分类或风险关键字"
          value={filters.keyword}
          onChange={(event) => dispatch({ type: "set-filter", filter: { keyword: event.target.value } })}
        />
        <button
          className="rc-button rc-button-secondary"
          onClick={() => dispatch({ type: "set-filter", filter: { recoverableOnly: !filters.recoverableOnly } })}
          type="button"
        >
          {filters.recoverableOnly ? "显示全部" : "仅可恢复"}
        </button>
      </section>

      <div className="rc-stack">
        {cleanupItems.map((item) => {
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
                  <span className={`rc-pill rc-pill--${item.riskLevel}`}>{item.riskLevel}</span>
                </div>
                <p className="rc-body">{item.summary}</p>
              </div>
              <div className="rc-row__meta">
                <span>{item.spaceLabel}</span>
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
