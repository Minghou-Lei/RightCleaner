import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  analyzeNormalizedMenuItem,
  getDetectionTagLabel,
  type DetectionTag,
} from '@/features/cleanup/menu-item-detection';
import {
  formatMenuItemSourceCategory,
  formatMenuItemStatus,
  formatRiskLevel,
  getMenuItemQueryMeta,
  type MenuItemSourceCategory,
  type MenuItemStatus,
  type RiskLevel,
} from '@/shared/menu-item-query';
import {
  formatMenuSourceKind,
  formatMenuVisibility,
  type MenuTargetKind,
  type NormalizedMenuItem,
} from '../shared/menu-items';
import { useAppState, useFilteredMenuItems } from '../state/app-state';

type PendingAction = {
  enabled: boolean;
  itemIds: string[];
  source: 'single' | 'bulk';
};

type ActionableSummary = {
  actionableIds: string[];
  readonlyCount: number;
  alreadyMatchingCount: number;
};

function parseIssueFilter(value: string | null): DetectionTag | null {
  switch (value) {
    case 'abnormal':
    case 'duplicate':
    case 'hidden':
    case 'third-party':
    case 'unknown-source':
      return value;
    default:
      return null;
  }
}

function summarizeActionableItems(items: NormalizedMenuItem[], enabled: boolean): ActionableSummary {
  return items.reduce<ActionableSummary>(
    (summary, item) => {
      if (!item.editable) {
        summary.readonlyCount += 1;
        return summary;
      }

      if (item.enabled === enabled) {
        summary.alreadyMatchingCount += 1;
        return summary;
      }

      summary.actionableIds.push(item.id);
      return summary;
    },
    { actionableIds: [], readonlyCount: 0, alreadyMatchingCount: 0 },
  );
}

export function CleanupListPage() {
  const {
    state: { filters, menuItems, menuLoadError, operationError, selectedItemIds, menuLoadState },
    dispatch,
    activeItemId,
    activeItemIds,
    isItemBusy,
    toggleMenuItemEnabled,
    setMenuItemsEnabled,
  } = useAppState();
  const [searchParams] = useSearchParams();
  const filteredItems = useFilteredMenuItems();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const issueFilter = parseIssueFilter(searchParams.get('issue'));

  useEffect(() => {
    dispatch({
      type: 'set-filter',
      filter: {
        keyword: searchParams.get('keyword') ?? '',
        target: (searchParams.get('target') || null) as MenuTargetKind | null,
        source: (searchParams.get('source') || null) as MenuItemSourceCategory | null,
        status: (searchParams.get('status') || null) as MenuItemStatus | null,
        riskLevel: (searchParams.get('riskLevel') || null) as RiskLevel | null,
        editableOnly: searchParams.get('editableOnly') === 'true',
        sortBy: (searchParams.get('sortBy') as typeof filters.sortBy | null) ?? filters.sortBy,
        sortDirection:
          (searchParams.get('sortDirection') as typeof filters.sortDirection | null) ??
          filters.sortDirection,
      },
    });
  }, [dispatch, filters.sortBy, filters.sortDirection, searchParams]);

  const duplicateGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filteredItems) {
      counts.set(item.canonicalTitle, (counts.get(item.canonicalTitle) ?? 0) + 1);
    }
    return counts;
  }, [filteredItems]);

  const detectedItems = useMemo(
    () =>
      filteredItems.map((item) => {
        const duplicateGroup =
          (duplicateGroups.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null;
        return {
          item,
          meta: getMenuItemQueryMeta(item, duplicateGroup),
          detection: analyzeNormalizedMenuItem(item, duplicateGroup),
        };
      }),
    [duplicateGroups, filteredItems],
  );

  const visibleItems = useMemo(
    () =>
      issueFilter
        ? detectedItems.filter(({ detection }) => detection.tags.includes(issueFilter))
        : detectedItems,
    [detectedItems, issueFilter],
  );

  const issueLabel = issueFilter ? getDetectionTagLabel(issueFilter) : null;
  const menuItemsById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);
  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedItemIds.includes(item.id));
  const selectedItems = selectedItemIds
    .map((itemId) => menuItemsById.get(itemId))
    .filter((item): item is NormalizedMenuItem => Boolean(item));
  const bulkDisableSummary = summarizeActionableItems(selectedItems, false);
  const bulkEnableSummary = summarizeActionableItems(selectedItems, true);
  const pendingItems =
    pendingAction?.itemIds
      .map((itemId) => menuItemsById.get(itemId))
      .filter((item): item is NormalizedMenuItem => Boolean(item)) ?? [];
  const pendingSummary = pendingAction
    ? summarizeActionableItems(pendingItems, pendingAction.enabled)
    : null;
  const isMutating = activeItemIds.length > 0;

  const openConfirm = (itemIds: string[], enabled: boolean, source: PendingAction['source']) => {
    const uniqueIds = [...new Set(itemIds)];
    if (uniqueIds.length === 0 || isMutating) {
      return;
    }
    setPendingAction({ itemIds: uniqueIds, enabled, source });
  };

  const applyPendingAction = async () => {
    if (!pendingAction || !pendingSummary || pendingSummary.actionableIds.length === 0) {
      setPendingAction(null);
      return;
    }

    await setMenuItemsEnabled(pendingSummary.actionableIds, pendingAction.enabled);

    if (pendingAction.source === 'bulk') {
      dispatch({
        type: 'set-item-selection',
        itemIds: selectedItemIds.filter((itemId) => !pendingSummary.actionableIds.includes(itemId)),
      });
    }

    setPendingAction(null);
  };

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">清理项列表</span>
          <h2 className="rc-title">菜单项识别结果与批量处置入口</h2>
        </div>
      </header>

      <section className="rc-card rc-toolbar">
        <input
          className="rc-input"
          placeholder="搜索标题、对象类型、来源、状态、风险、路径或异常标签"
          value={filters.keyword}
          onChange={(event) =>
            dispatch({ type: 'set-filter', filter: { keyword: event.target.value } })
          }
        />
        <select
          className="rc-input"
          value={filters.target ?? ''}
          onChange={(event) =>
            dispatch({
              type: 'set-filter',
              filter: { target: (event.target.value || null) as MenuTargetKind | null },
            })
          }
        >
          <option value="">全部对象</option>
          <option value="file">文件</option>
          <option value="directory">目录</option>
          <option value="directory_background">目录背景</option>
          <option value="drive">驱动器</option>
          <option value="desktop_background">桌面背景</option>
          <option value="folder">Folder</option>
          <option value="all_file_system_objects">文件系统对象</option>
        </select>
        <select
          className="rc-input"
          value={filters.source ?? ''}
          onChange={(event) =>
            dispatch({
              type: 'set-filter',
              filter: { source: (event.target.value || null) as MenuItemSourceCategory | null },
            })
          }
        >
          <option value="">全部来源</option>
          <option value="windows">Windows</option>
          <option value="third_party">第三方</option>
          <option value="unknown">未知来源</option>
        </select>
        <select
          className="rc-input"
          value={filters.status ?? ''}
          onChange={(event) =>
            dispatch({
              type: 'set-filter',
              filter: { status: (event.target.value || null) as MenuItemStatus | null },
            })
          }
        >
          <option value="">全部状态</option>
          <option value="enabled">启用中</option>
          <option value="disabled">已禁用</option>
          <option value="hidden">隐藏项</option>
        </select>
        <select
          className="rc-input"
          value={filters.riskLevel ?? ''}
          onChange={(event) =>
            dispatch({
              type: 'set-filter',
              filter: { riskLevel: (event.target.value || null) as RiskLevel | null },
            })
          }
        >
          <option value="">全部风险</option>
          <option value="high">高风险</option>
          <option value="medium">中风险</option>
          <option value="low">低风险</option>
        </select>
        <select
          aria-label="排序字段"
          className="rc-input"
          value={filters.sortBy}
          onChange={(event) =>
            dispatch({
              type: 'set-filter',
              filter: { sortBy: event.target.value as typeof filters.sortBy },
            })
          }
        >
          <option value="riskLevel">按风险</option>
          <option value="status">按状态</option>
          <option value="source">按来源</option>
          <option value="target">按对象类型</option>
          <option value="title">按名称</option>
        </select>
        <button
          className="rc-button rc-button-secondary"
          onClick={() =>
            dispatch({
              type: 'set-filter',
              filter: {
                sortDirection: filters.sortDirection === 'desc' ? 'asc' : 'desc',
              },
            })
          }
          type="button"
        >
          {filters.sortDirection === 'desc' ? '降序' : '升序'}
        </button>
        <button
          className="rc-button rc-button-secondary"
          onClick={() =>
            dispatch({ type: 'set-filter', filter: { editableOnly: !filters.editableOnly } })
          }
          type="button"
        >
          {filters.editableOnly ? '显示全部' : '仅可编辑'}
        </button>
      </section>

      <section className="rc-card rc-bulk-panel">
        <div>
          <span className="rc-kicker">多选操作</span>
          <h3 className="rc-title rc-title--sm">已选 {selectedItemIds.length} 项</h3>
          <p className="rc-body">
            当前结果 {filteredItems.length} 项，其中可批量禁用 {bulkDisableSummary.actionableIds.length} 项，可批量启用{' '}
            {bulkEnableSummary.actionableIds.length} 项。
          </p>
          {selectedItems.length > 0 ? (
            <p className="rc-body rc-body--muted">
              只读 {bulkDisableSummary.readonlyCount} 项，已处于目标状态 {Math.max(
                bulkDisableSummary.alreadyMatchingCount,
                bulkEnableSummary.alreadyMatchingCount,
              )}{' '}
              项。
            </p>
          ) : (
            <p className="rc-body rc-body--muted">先勾选要处理的菜单项，再执行批量启用或禁用。</p>
          )}
        </div>
        <div className="rc-bulk-panel__actions">
          <button
            className="rc-button rc-button-secondary"
            disabled={filteredItems.length === 0 || isMutating}
            onClick={() =>
              dispatch({
                type: 'set-item-selection',
                itemIds: allVisibleSelected ? [] : filteredItems.map((item) => item.id),
              })
            }
            type="button"
          >
            {allVisibleSelected ? '取消全选当前结果' : '全选当前结果'}
          </button>
          <button
            className="rc-button rc-button-secondary"
            disabled={selectedItemIds.length === 0 || isMutating}
            onClick={() => dispatch({ type: 'clear-selection' })}
            type="button"
          >
            清空已选
          </button>
          <button
            className="rc-button rc-button-secondary"
            disabled={bulkEnableSummary.actionableIds.length === 0 || isMutating}
            onClick={() => openConfirm(selectedItemIds, true, 'bulk')}
            type="button"
          >
            批量启用
          </button>
          <button
            className="rc-button rc-button-danger"
            disabled={bulkDisableSummary.actionableIds.length === 0 || isMutating}
            onClick={() => openConfirm(selectedItemIds, false, 'bulk')}
            type="button"
          >
            批量禁用
          </button>
        </div>
      </section>

      {menuLoadError ? <p className="rc-banner rc-banner--danger">{menuLoadError}</p> : null}
      {operationError ? <p className="rc-banner rc-banner--warning">{operationError}</p> : null}
      {issueLabel ? (
        <section className="rc-card">
          <div className="rc-section-heading">
            <div>
              <span className="rc-kicker">首页筛选</span>
              <h3 className="rc-panel__title">当前聚焦: {issueLabel}</h3>
            </div>
            <Link className="rc-button rc-button-secondary" to="/cleanup">
              清除筛选
            </Link>
          </div>
        </section>
      ) : null}

      {menuLoadState === 'ready' && menuItems.length === 0 ? (
        <section className="rc-card rc-empty-state">
          <h3>当前没有可管理的右键菜单项</h3>
          <p className="rc-body">
            RightCleaner 暂未扫描到可编辑来源。请在桌面端重新扫描，或检查当前环境是否只加载了受保护项。
          </p>
        </section>
      ) : null}

      {menuItems.length > 0 && visibleItems.length === 0 ? (
        <section className="rc-card rc-empty-state">
          <h3>没有符合筛选条件的结果</h3>
          <p className="rc-body">可以放宽关键词、来源或对象范围，重新查看可操作项。</p>
          <button
            className="rc-button rc-button-secondary"
            onClick={() =>
              dispatch({
                type: 'set-filter',
                filter: {
                  keyword: '',
                  target: null,
                  source: null,
                  status: null,
                  riskLevel: null,
                  editableOnly: false,
                  sortBy: 'riskLevel',
                  sortDirection: 'desc',
                },
              })
            }
            type="button"
          >
            清空筛选条件
          </button>
        </section>
      ) : null}

      <div className="rc-stack">
        {visibleItems.map(({ item, meta, detection }) => {
          const selected = selectedItemIds.includes(item.id);
          const busy = isItemBusy(item.id);

          return (
            <article className={`rc-card rc-row${selected ? ' is-selected' : ''}`} key={item.id}>
              <label className="rc-row__checkbox">
                <input
                  checked={selected}
                  onChange={() => dispatch({ type: 'toggle-item-selection', itemId: item.id })}
                  type="checkbox"
                />
                <span />
              </label>
              <div className="rc-row__content">
                <div className="rc-row__title">
                  <strong>{item.title}</strong>
                  <span className={`rc-pill rc-pill--${detection.badgeTone}`}>
                    {detection.headline}
                  </span>
                </div>
                <p className="rc-body">
                  {item.targetLabel} · {formatMenuItemSourceCategory(meta.source)} ·{' '}
                  {formatMenuItemStatus(meta.status)} · {formatRiskLevel(meta.riskLevel)}
                </p>
                <p className="rc-body">{formatMenuVisibility(item.visibility)}</p>
                <p className="rc-body">{detection.detail}</p>
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
              <div className="rc-row__meta">
                <span>{item.command?.command ?? item.handlerClsid ?? item.trace.registrationPath}</span>
                {!item.editable ? <span className="rc-inline-warning">只读项，无法直接修改</span> : null}
                <button
                  className={item.enabled ? 'rc-button rc-button-danger' : 'rc-button rc-button-primary'}
                  disabled={busy || !item.editable || activeItemId === item.id}
                  onClick={() => openConfirm([item.id], !item.enabled, 'single')}
                  type="button"
                >
                  {busy || activeItemId === item.id ? '处理中...' : item.enabled ? '禁用' : '启用'}
                </button>
                <Link className="rc-button rc-button-secondary" to={`/cleanup/${item.id}`}>
                  查看详情
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {pendingAction && pendingSummary ? (
        <div aria-label="批量操作确认弹窗" aria-modal="true" className="rc-modal" role="dialog">
          <div className="rc-modal__backdrop" onClick={() => setPendingAction(null)} />
          <section className="rc-card rc-modal__content">
            <span className="rc-kicker">
              {pendingAction.enabled
                ? '启用确认'
                : pendingAction.source === 'bulk'
                  ? '危险批量操作'
                  : '危险操作'}
            </span>
            <h3 className="rc-title rc-title--sm">
              {pendingAction.enabled ? '确认启用所选菜单项' : '确认禁用所选菜单项'}
            </h3>
            <p className="rc-body">
              共选择 {pendingAction.itemIds.length} 项，本次将实际处理 {pendingSummary.actionableIds.length} 项。
              {!pendingAction.enabled ? ' 禁用会立即影响右键菜单可见性，请确认这些项确实可以关闭。' : null}
            </p>
            <div className={`rc-banner ${pendingAction.enabled ? 'rc-banner--info' : 'rc-banner--danger'}`}>
              {pendingSummary.readonlyCount > 0
                ? `已自动跳过 ${pendingSummary.readonlyCount} 个只读项。`
                : '所有目标项均支持当前操作。'}
              {pendingSummary.alreadyMatchingCount > 0
                ? ` 另有 ${pendingSummary.alreadyMatchingCount} 项已经处于目标状态，不会重复提交。`
                : null}
            </div>
            <div className="rc-stack">
              {pendingItems.map((item) => (
                <article className="rc-list-card" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="rc-body">
                      {formatMenuSourceKind(item.sourceKind)} · {item.targetLabel}
                    </p>
                  </div>
                  <span className={`rc-pill rc-pill--${item.editable ? 'info' : 'medium'}`}>
                    {!item.editable
                      ? '只读跳过'
                      : item.enabled === pendingAction.enabled
                        ? '已是目标状态'
                        : '将执行'}
                  </span>
                </article>
              ))}
            </div>
            <div className="rc-modal__actions">
              <button className="rc-button rc-button-secondary" onClick={() => setPendingAction(null)} type="button">
                取消
              </button>
              <button
                className={pendingAction.enabled ? 'rc-button rc-button-primary' : 'rc-button rc-button-danger'}
                disabled={pendingSummary.actionableIds.length === 0}
                onClick={() => void applyPendingAction()}
                type="button"
              >
                {pendingAction.enabled ? '确认启用' : '确认禁用'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
