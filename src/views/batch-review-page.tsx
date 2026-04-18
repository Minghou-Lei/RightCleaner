import { useMemo, useState } from "react";

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
} from "@/features/cleanup/menu-item-detection";
import { formatMenuSourceKind } from "../shared/menu-items";
import { useAppState } from "../state/app-state";

export function BatchReviewPage() {
  const {
    state: { menuItems, selectedItemIds, destructiveActionMessage, destructiveActionState },
    deleteSelectedItems,
  } = useAppState();
  const [snapshotLabel, setSnapshotLabel] = useState("");

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
        </section>
        <section className="rc-card">
          <h3>执行配置</h3>
          <p className="rc-body">
            所有删除操作都会先生成恢复点快照，再执行注册表子树删除，确保可以从恢复中心安全回滚。
          </p>
          <div className="rc-stack">
            <input
              className="rc-input"
              onChange={(event) => setSnapshotLabel(event.target.value)}
              placeholder="可选：为这次删除填写快照名称"
              value={snapshotLabel}
            />
            <button
              className="rc-button rc-button-primary"
              disabled={selectedItemIds.length === 0 || destructiveActionState === "running"}
              onClick={() => void deleteSelectedItems(snapshotLabel)}
              type="button"
            >
              {destructiveActionState === "running" ? "正在备份并删除…" : "生成快照后删除所选项"}
            </button>
            <p className="rc-body">
              已选 {selectedItemIds.length} 项。删除后可在“备份恢复”页面按快照恢复。
            </p>
            {destructiveActionMessage ? <p className="rc-body">{destructiveActionMessage}</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
