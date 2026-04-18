import { Link, useParams } from "react-router-dom";

import { useAppState } from "../state/app-state";

export function CleanupDetailPage() {
  const { itemId } = useParams();
  const {
    state: { cleanupItems }
  } = useAppState();

  const item =
    cleanupItems.find((entry) => entry.id === itemId) ??
    cleanupItems[0] ?? {
      id: "fallback",
      title: "未找到清理项",
      category: "未知分类",
      spaceLabel: "0 MB",
      hitCount: 0,
      riskLevel: "low" as const,
      recoverable: false,
      summary: "当前路由尚未绑定到具体数据项。"
    };

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">清理项详情</span>
          <h2 className="rc-title">{item.title}</h2>
          <p className="rc-body">{item.summary}</p>
        </div>
        <div className="rc-hero__actions">
          <Link className="rc-button rc-button-secondary" to="/cleanup">
            返回列表
          </Link>
          <Link className="rc-button rc-button-primary" to="/batch">
            加入批量
          </Link>
        </div>
      </header>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card">
          <h3>影响说明</h3>
          <p className="rc-body">这里为后续 UI 预留风险说明、依赖影响和命中样例模块。</p>
        </section>
        <section className="rc-card">
          <h3>备份策略</h3>
          <p className="rc-body">详情页将复用全局状态中的恢复能力和任务阶段，保证单项清理与批量清理一致。</p>
        </section>
      </div>
    </section>
  );
}
