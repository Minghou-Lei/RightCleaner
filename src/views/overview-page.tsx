import { Link } from "react-router-dom";

import { formatMenuSourceKind, formatMenuVisibility } from "../shared/menu-items";
import { useAppState } from "../state/app-state";

export function OverviewPage() {
  const {
    state: { menuItems, menuLoadState, backups }
  } = useAppState();

  const sourceSummary = Object.entries(
    menuItems.reduce<Record<string, number>>((summary, item) => {
      summary[item.sourceKind] = (summary[item.sourceKind] ?? 0) + 1;
      return summary;
    }, {})
  );

  return (
    <section className="rc-screen">
      <header className="rc-hero rc-surface">
        <div>
          <span className="rc-kicker">首页 / 总览</span>
          <h2 className="rc-title">统一展示可编辑、可追踪的菜单项资产</h2>
          <p className="rc-body">
            MIN-48 已把不同注册来源映射为统一结构，首页聚合源类型、可见性和追踪入口。
          </p>
        </div>
        <div className="rc-hero__actions">
          <Link className="rc-button rc-button-primary" to="/cleanup">
            查看菜单项清单
          </Link>
          <Link className="rc-button rc-button-secondary" to="/recovery">
            打开备份恢复
          </Link>
        </div>
      </header>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card">
          <h3>菜单项概览</h3>
          <div className="rc-stack">
            <article className="rc-list-card">
              <div>
                <strong>加载状态</strong>
                <p className="rc-body">当前已识别 {menuItems.length} 个归一化菜单项。</p>
              </div>
              <span className="rc-pill rc-pill--info">{menuLoadState}</span>
            </article>
            {sourceSummary.map(([sourceKind, count]) => (
              <article className="rc-list-card" key={sourceKind}>
                <div>
                  <strong>{formatMenuSourceKind(sourceKind as never)}</strong>
                  <p className="rc-body">来自同类注册源的菜单项数量。</p>
                </div>
                <span className="rc-pill rc-pill--info">{count}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="rc-card">
          <h3>最近识别的菜单项</h3>
          <div className="rc-stack">
            {menuItems.slice(0, 4).map((item) => (
              <article className="rc-list-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="rc-body">
                    {item.targetLabel} · {formatMenuVisibility(item.visibility)}
                  </p>
                </div>
                <span className="rc-pill rc-pill--info">{item.enabled ? "enabled" : "disabled"}</span>
              </article>
            ))}
            {menuItems.length === 0 &&
              backups.slice(0, 2).map((backup) => (
                <article className="rc-list-card" key={backup.id}>
                  <div>
                    <strong>{backup.label}</strong>
                    <p className="rc-body">等待菜单项扫描完成后，这里会显示真实结果。</p>
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
