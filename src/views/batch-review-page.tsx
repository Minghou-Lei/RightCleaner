import { formatMenuSourceKind } from "../shared/menu-items";
import { useAppState } from "../state/app-state";

export function BatchReviewPage() {
  const {
    state: { menuItems, selectedItemIds }
  } = useAppState();

  const selectedItems = menuItems.filter((item) => selectedItemIds.includes(item.id));

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">批量操作确认</span>
          <h2 className="rc-title">汇总已选菜单项与后续编辑动作</h2>
        </div>
      </header>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card">
          <h3>已选项目</h3>
          <div className="rc-stack">
            {selectedItems.map((item) => (
              <article className="rc-list-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="rc-body">
                    {formatMenuSourceKind(item.sourceKind)} · {item.targetLabel}
                  </p>
                </div>
                <span className="rc-pill rc-pill--info">{item.enabled ? "enabled" : "disabled"}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="rc-card">
          <h3>执行配置</h3>
          <p className="rc-body">
            后续会在这里承接批量禁用、恢复和导出追踪信息，保证所有操作都基于统一菜单项模型。
          </p>
        </section>
      </div>
    </section>
  );
}
