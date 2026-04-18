import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
} from "@/features/cleanup/menu-item-detection";
import { formatMenuSourceKind } from "../shared/menu-items";
import { useAppState } from "../state/app-state";

export function BatchReviewPage() {
  const {
    state: { menuItems, selectedItemIds },
  } = useAppState();

  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      counts.set(item.canonicalTitle, (counts.get(item.canonicalTitle) ?? 0) + 1);
    }
    return counts;
  }, [menuItems]);

  const selectedItems = menuItems
    .filter((item) => selectedItemIds.includes(item.id))
    .map((item) => ({
      item,
      detection: analyzeNormalizedMenuItem(
        item,
        (duplicateCounts.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null
      ),
    }));
  const editableCount = selectedItems.filter(({ item }) => item.editable).length;
  const enabledCount = selectedItems.filter(({ item }) => item.enabled).length;

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
          {selectedItems.length === 0 ? (
            <div className="rc-empty-state rc-empty-state--compact">
              <h3>还没有加入任何批量项</h3>
              <p className="rc-body">回到清理列表勾选项目后，这里会汇总风险、来源和后续执行动作。</p>
              <Link className="rc-button rc-button-secondary" to="/cleanup">
                去选择菜单项
              </Link>
            </div>
          ) : (
            <div className="rc-stack">
              {selectedItems.map(({ item, detection }) => (
                <article className="rc-list-card" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="rc-body">
                      {formatMenuSourceKind(item.sourceKind)} · {item.targetLabel}
                    </p>
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
                  <span className={`rc-pill rc-pill--${detection.badgeTone}`}>{detection.headline}</span>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="rc-card">
          <h3>执行配置</h3>
          {selectedItems.length === 0 ? (
            <p className="rc-body">当前没有待处理集合，因此不会触发批量确认或危险操作提示。</p>
          ) : (
            <div className="rc-stack">
              <p className="rc-body">
                已选 {selectedItems.length} 项，其中 {editableCount} 项可修改，{enabledCount} 项当前处于启用状态。
              </p>
              <p className="rc-body">
                危险操作会先回到清理列表触发确认弹窗，再明确告知只读跳过项、已处于目标状态的项目数量和最终执行范围。
              </p>
              <Link className="rc-button rc-button-primary" to="/cleanup">
                返回清理列表继续处理
              </Link>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
