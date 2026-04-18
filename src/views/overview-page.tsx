import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
} from "@/features/cleanup/menu-item-detection";
import { formatMenuSourceKind, formatMenuVisibility } from "../shared/menu-items";
import { useAppState } from "../state/app-state";

export function OverviewPage() {
  const {
    state: { menuItems, menuLoadState, backups },
  } = useAppState();

  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      counts.set(item.canonicalTitle, (counts.get(item.canonicalTitle) ?? 0) + 1);
    }
    return counts;
  }, [menuItems]);

  const flaggedItems = useMemo(
    () =>
      menuItems
        .map((item) => ({
          item,
          detection: analyzeNormalizedMenuItem(
            item,
            (duplicateCounts.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null
          ),
        }))
        .filter(({ detection }) => detection.tags.length > 0),
    [duplicateCounts, menuItems]
  );

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
          <h2 className="rc-title">建立右键菜单异常识别与清理入口</h2>
          <p className="rc-body">
            MIN-49 在现有扫描结果上叠加异常、重复、隐藏和来源风险识别，帮助后续清理动作做正确排序。
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
          <h3>异常菜单项概览</h3>
          <div className="rc-stack">
            <article className="rc-list-card">
              <div>
                <strong>加载状态</strong>
                <p className="rc-body">当前已识别 {menuItems.length} 个归一化菜单项。</p>
              </div>
              <span className="rc-pill rc-pill--info">{menuLoadState}</span>
            </article>
            {flaggedItems.slice(0, 4).map(({ item, detection }) => (
              <article className="rc-list-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="rc-body">{detection.detail}</p>
                  <div className="rc-tag-row">
                    {detection.tags.map((tag) => (
                      <span className="rc-pill rc-pill--info" key={tag}>
                        {getDetectionTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={`rc-pill rc-pill--${detection.badgeTone}`}>{detection.headline}</span>
              </article>
            ))}
            {flaggedItems.length === 0 &&
              sourceSummary.map(([sourceKind, count]) => (
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
                  <span className="rc-pill rc-pill--info">{backup.status}</span>
                </article>
              ))}
          </div>
        </section>
      </div>
    </section>
  );
}
