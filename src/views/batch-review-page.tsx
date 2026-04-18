import { useAppState } from "../state/app-state";

export function BatchReviewPage() {
  const {
    state: { cleanupItems, selectedItemIds }
  } = useAppState();

  const selectedItems = cleanupItems.filter((item) => selectedItemIds.includes(item.id));

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">批量操作确认</span>
          <h2 className="rc-title">汇总已选清理项与执行配置</h2>
        </div>
      </header>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card">
          <h3>已选项目</h3>
          <div className="rc-stack">
            {selectedItems.map((item) => (
              <article className="rc-list-card" key={item.id}>
                <strong>{item.title}</strong>
                <span className={`rc-pill rc-pill--${item.riskLevel}`}>{item.spaceLabel}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="rc-card">
          <h3>执行配置</h3>
          <p className="rc-body">这里预留自动备份、失败继续策略和结果页跳转等批量行为配置。</p>
        </section>
      </div>
    </section>
  );
}
