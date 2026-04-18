import { Link } from "react-router-dom";

import { useAppState } from "../state/app-state";

export function OverviewPage() {
  const {
    state: { cleanupItems, backups }
  } = useAppState();

  return (
    <section className="rc-screen">
      <header className="rc-hero rc-surface">
        <div>
          <span className="rc-kicker">首页 / 总览</span>
          <h2 className="rc-title">建立从扫描到恢复的页面主入口</h2>
          <p className="rc-body">
            首页聚合推荐清理、风险提醒和恢复入口，作为 MIN-40 的总导航起点。
          </p>
        </div>
        <div className="rc-hero__actions">
          <Link className="rc-button rc-button-primary" to="/cleanup">
            查看推荐清理
          </Link>
          <Link className="rc-button rc-button-secondary" to="/recovery">
            打开备份恢复
          </Link>
        </div>
      </header>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card">
          <h3>推荐清理分组</h3>
          <div className="rc-stack">
            {cleanupItems.map((item) => (
              <article className="rc-list-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="rc-body">{item.summary}</p>
                </div>
                <span className={`rc-pill rc-pill--${item.riskLevel}`}>{item.spaceLabel}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="rc-card">
          <h3>恢复链路入口</h3>
          <div className="rc-stack">
            {backups.map((backup) => (
              <article className="rc-list-card" key={backup.id}>
                <div>
                  <strong>{backup.label}</strong>
                  <p className="rc-body">{backup.createdAt}</p>
                </div>
                <span className="rc-pill rc-pill--info">{backup.sizeLabel}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
