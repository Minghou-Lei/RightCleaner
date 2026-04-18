import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
  type DetectionTag,
} from '@/features/cleanup/menu-item-detection';
import {
  formatMenuSourceKind,
  formatMenuVisibility,
  type MenuSourceKind,
  type MenuTargetKind,
} from '../shared/menu-items';
import { useAppState } from '../state/app-state';

const targetCategories: Array<{
  target: MenuTargetKind;
  label: string;
  description: string;
}> = [
  { target: 'file', label: '文件菜单', description: '定位文件右键菜单的冗余项与异常命令。' },
  {
    target: 'directory',
    label: '目录菜单',
    description: '检查文件夹节点上的扩展、脚本和重复入口。',
  },
  {
    target: 'directory_background',
    label: '目录背景',
    description: '查看空白处右键中的终端、工具链和桌面级操作入口。',
  },
  { target: 'drive', label: '驱动器', description: '聚焦盘符级上下文菜单与系统管理工具入口。' },
];

const issueDefinitions: Array<{
  tag: DetectionTag;
  fallbackTitle: string;
  description: string;
  to: string;
}> = [
  {
    tag: 'unknown-source',
    fallbackTitle: '来源待确认',
    description: '优先确认未知发布者条目，避免误留残缺菜单项。',
    to: '/cleanup?issue=unknown-source',
  },
  {
    tag: 'third-party',
    fallbackTitle: '第三方扩展',
    description: '快速检查外部软件植入的上下文菜单扩展。',
    to: '/cleanup?source=shell_extension&issue=third-party',
  },
  {
    tag: 'duplicate',
    fallbackTitle: '重复动作',
    description: '集中处理名称重复、功能重叠的菜单动作。',
    to: '/cleanup?issue=duplicate',
  },
];

export function OverviewPage() {
  const {
    state: { menuItems, menuLoadState, backups, scannedScopeCount, lastScanSummary },
    reloadAppData,
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
            (duplicateCounts.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null,
          ),
        }))
        .filter(({ detection }) => detection.tags.length > 0),
    [duplicateCounts, menuItems],
  );

  const sourceSummary = useMemo(
    () =>
      Object.entries(
        menuItems.reduce<Record<string, number>>((summary, item) => {
          summary[item.sourceKind] = (summary[item.sourceKind] ?? 0) + 1;
          return summary;
        }, {}),
      ),
    [menuItems],
  );

  const categoryCards = useMemo(
    () =>
      targetCategories
        .map((definition) => ({
          ...definition,
          count: menuItems.filter((item) => item.target === definition.target).length,
        }))
        .filter((entry) => entry.count > 0),
    [menuItems],
  );

  const issueCards = useMemo(
    () =>
      issueDefinitions.map((definition) => ({
        ...definition,
        count: flaggedItems.filter(({ detection }) => detection.tags.includes(definition.tag))
          .length,
        title: getDetectionTagLabel(definition.tag),
      })),
    [flaggedItems],
  );

  const metricCards = [
    { label: '菜单项总数', value: menuItems.length, tone: 'info' },
    {
      label: '风险命中',
      value: flaggedItems.length,
      tone: flaggedItems.length > 0 ? 'high' : 'low',
    },
    {
      label: '可直接处理',
      value: menuItems.filter((item) => item.editable).length,
      tone: 'medium',
    },
    { label: '恢复点', value: backups.length, tone: backups.length > 0 ? 'info' : 'low' },
  ] as const;

  return (
    <section className="rc-screen">
      <header className="rc-hero rc-surface">
        <div className="rc-hero__copy">
          <span className="rc-kicker">首页 / 总览</span>
          <h2 className="rc-title">首页概览与分类导航</h2>
          <p className="rc-body">
            从一页内掌握风险概览、对象分类和主要操作入口，优先定位问题最集中的右键菜单区域。
          </p>
          <p className="rc-body">{lastScanSummary}</p>
        </div>
        <div className="rc-hero__actions">
          <button
            className="rc-button rc-button-primary"
            onClick={() => void reloadAppData()}
            type="button"
          >
            重新扫描
          </button>
          <Link className="rc-button rc-button-secondary" to="/cleanup">
            打开清理列表
          </Link>
          <Link className="rc-button rc-button-secondary" to="/batch">
            进入批量确认
          </Link>
          <Link className="rc-button rc-button-secondary" to="/recovery">
            打开恢复中心
          </Link>
        </div>
      </header>

      <section className="rc-overview-metrics">
        {metricCards.map((card) => (
          <article className="rc-card rc-metric-card" key={card.label}>
            <span className="rc-metric-card__label">{card.label}</span>
            <strong className="rc-metric-card__value">{card.value}</strong>
            <span className={`rc-pill rc-pill--${card.tone}`}>{menuLoadState}</span>
          </article>
        ))}
      </section>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card rc-section-card">
          <div className="rc-section-heading">
            <div>
              <span className="rc-kicker">问题热点</span>
              <h3 className="rc-panel__title">优先定位高风险区域</h3>
            </div>
            <span className="rc-pill rc-pill--high">{flaggedItems.length} 项待检查</span>
          </div>
          <div className="rc-stack">
            {issueCards.map((issue) => (
              <Link className="rc-nav-card" key={issue.tag} to={issue.to}>
                <div>
                  <strong>{issue.count > 0 ? issue.title : issue.fallbackTitle}</strong>
                  <p className="rc-body">{issue.description}</p>
                </div>
                <span className={`rc-pill rc-pill--${issue.count > 0 ? 'high' : 'info'}`}>
                  {issue.count}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rc-card rc-section-card">
          <div className="rc-section-heading">
            <div>
              <span className="rc-kicker">分类导航</span>
              <h3 className="rc-panel__title">按问题区域进入清理列表</h3>
            </div>
            <span className="rc-pill rc-pill--info">{scannedScopeCount} 个对象场景</span>
          </div>
          <div className="rc-nav-card-grid">
            {categoryCards.map((category) => (
              <Link
                className="rc-nav-card"
                key={category.target}
                to={`/cleanup?target=${category.target}`}
              >
                <div>
                  <strong>{category.label}</strong>
                  <p className="rc-body">{category.description}</p>
                </div>
                <span className="rc-pill rc-pill--info">{category.count}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="rc-grid rc-grid--two">
        <section className="rc-card rc-section-card">
          <div className="rc-section-heading">
            <div>
              <span className="rc-kicker">主要操作</span>
              <h3 className="rc-panel__title">从概览直达核心动作</h3>
            </div>
          </div>
          <div className="rc-stack">
            <Link className="rc-action-card" to="/cleanup?editableOnly=true">
              <strong>立即清理可编辑项</strong>
              <p className="rc-body">聚焦当前可直接启用、禁用和查看详情的菜单项。</p>
            </Link>
            <Link className="rc-action-card" to="/batch">
              <strong>批量确认变更</strong>
              <p className="rc-body">对已勾选条目集中确认，减少逐条操作成本。</p>
            </Link>
            <Link className="rc-action-card" to="/recovery">
              <strong>查看恢复点</strong>
              <p className="rc-body">进入备份恢复中心，检查最近变更是否可回滚。</p>
            </Link>
          </div>
        </section>

        <section className="rc-card rc-section-card">
          <div className="rc-section-heading">
            <div>
              <span className="rc-kicker">来源分布</span>
              <h3 className="rc-panel__title">识别注册源与入口密度</h3>
            </div>
          </div>
          <div className="rc-stack">
            {sourceSummary.map(([sourceKind, count]) => (
              <Link
                className="rc-list-card rc-list-card--interactive"
                key={sourceKind}
                to={`/cleanup?source=${sourceKind}`}
              >
                <div>
                  <strong>{formatMenuSourceKind(sourceKind as MenuSourceKind)}</strong>
                  <p className="rc-body">按注册来源查看该类菜单项的清理优先级。</p>
                </div>
                <span className="rc-pill rc-pill--info">{count}</span>
              </Link>
            ))}
            {menuItems.slice(0, 2).map((item) => (
              <article className="rc-list-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="rc-body">
                    {item.targetLabel} · {formatMenuVisibility(item.visibility)}
                  </p>
                </div>
                <Link className="rc-button rc-button-secondary" to={`/cleanup/${item.id}`}>
                  查看详情
                </Link>
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

      <section className="rc-card rc-section-card">
        <div className="rc-section-heading">
          <div>
            <span className="rc-kicker">风险摘要</span>
            <h3 className="rc-panel__title">近期需要关注的菜单项</h3>
          </div>
          <Link className="rc-button rc-button-secondary" to="/cleanup?issue=unknown-source">
            查看全部问题项
          </Link>
        </div>
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
              <span className={`rc-pill rc-pill--${detection.badgeTone}`}>
                {detection.headline}
              </span>
            </article>
          ))}
          {flaggedItems.length === 0 && (
            <div className="rc-stack">
              {sourceSummary.map(([sourceKind, count]) => (
                <article className="rc-list-card" key={sourceKind}>
                  <div>
                    <strong>{formatMenuSourceKind(sourceKind as MenuSourceKind)}</strong>
                    <p className="rc-body">来自同类注册源的菜单项数量。</p>
                  </div>
                  <span className="rc-pill rc-pill--info">{count}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
