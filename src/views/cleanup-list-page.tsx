import { useEffect, useMemo } from 'react';
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
import { formatMenuVisibility, type MenuTargetKind } from '../shared/menu-items';
import { useAppState, useFilteredMenuItems } from '../state/app-state';

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

export function CleanupListPage() {
  const {
    state: { filters, menuLoadError, operationError, selectedItemIds },
    dispatch,
    activeItemId,
    toggleMenuItemEnabled,
  } = useAppState();
  const [searchParams] = useSearchParams();
  const filteredMenuItems = useFilteredMenuItems();
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
    for (const item of filteredMenuItems) {
      counts.set(item.canonicalTitle, (counts.get(item.canonicalTitle) ?? 0) + 1);
    }
    return counts;
  }, [filteredMenuItems]);

  const detectedItems = useMemo(
    () =>
      filteredMenuItems.map((item) => {
        const duplicateGroup =
          (duplicateGroups.get(item.canonicalTitle) ?? 0) > 1 ? item.canonicalTitle : null;
        return {
          item,
          meta: getMenuItemQueryMeta(item, duplicateGroup),
          detection: analyzeNormalizedMenuItem(item, duplicateGroup),
        };
      }),
    [duplicateGroups, filteredMenuItems],
  );

  const visibleItems = useMemo(
    () =>
      issueFilter
        ? detectedItems.filter(({ detection }) => detection.tags.includes(issueFilter))
        : detectedItems,
    [detectedItems, issueFilter],
  );

  const issueLabel = issueFilter ? getDetectionTagLabel(issueFilter) : null;

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

      {menuLoadError ? <p className="rc-body">{menuLoadError}</p> : null}
      {operationError ? <p className="rc-body">{operationError}</p> : null}
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

      <div className="rc-stack">
        {visibleItems.map(({ item, meta, detection }) => {
          const selected = selectedItemIds.includes(item.id);
          return (
            <article className="rc-card rc-row" key={item.id}>
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
                <button
                  className="rc-button rc-button-primary"
                  disabled={activeItemId === item.id || !item.editable}
                  onClick={() => void toggleMenuItemEnabled(item.id, !item.enabled)}
                  type="button"
                >
                  {activeItemId === item.id ? '处理中...' : item.enabled ? '禁用' : '启用'}
                </button>
                <Link className="rc-button rc-button-secondary" to={`/cleanup/${item.id}`}>
                  查看详情
                </Link>
              </div>
            </article>
          );
        })}
        {visibleItems.length === 0 ? <p className="rc-body">当前筛选下没有匹配的菜单项。</p> : null}
      </div>
    </section>
  );
}
