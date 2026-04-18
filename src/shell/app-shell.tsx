import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

import {
  BatchIcon,
  CleanupIcon,
  OverviewIcon,
  RecoveryIcon,
  ShieldIcon,
  SparkIcon
} from "../shared/ui/icons";
import { useAppState } from "../state/app-state";

const navigation = [
  { to: "/", label: "总览", icon: OverviewIcon, hint: "风险与状态" },
  { to: "/cleanup", label: "清理项", icon: CleanupIcon, hint: "识别与筛选" },
  { to: "/batch", label: "批量确认", icon: BatchIcon, hint: "集中执行" },
  { to: "/recovery", label: "备份恢复", icon: RecoveryIcon, hint: "回退与恢复" }
];

export function AppShell({ children }: PropsWithChildren) {
  const {
    state: { phase, selectedItemIds, scannedScopeCount, lastScanSummary }
  } = useAppState();

  return (
    <div className="rc-app-shell">
      <aside className="rc-sidebar rc-surface">
        <div className="rc-sidebar__brand">
          <div className="rc-brand-lockup">
            <span className="rc-brand-mark">
              <SparkIcon />
            </span>
            <div className="rc-stack rc-stack--tight">
              <span className="rc-sidebar__eyebrow">MIN-58 Visual Polish</span>
              <h1 className="rc-title">RightCleaner</h1>
            </div>
          </div>
          <p className="rc-body">
            为右键菜单扫描、异常标记、清理确认与恢复提供更稳定、更克制的桌面工作台。
          </p>
        </div>

        <nav className="rc-nav">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `rc-nav__link${isActive ? " is-active" : ""}`}
              to={item.to}
            >
              <span className="rc-nav__icon">
                <item.icon />
              </span>
              <span className="rc-nav__meta">
                <span className="rc-nav__label">{item.label}</span>
                <span className="rc-nav__hint">{item.hint}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="rc-sidebar__status rc-card">
          <div className="rc-status-heading">
            <span className="rc-icon-chip rc-icon-chip--brand">
              <ShieldIcon />
            </span>
            <div className="rc-stack rc-stack--tight">
              <span className="rc-badge">当前阶段 {phase}</span>
              <p className="rc-body">
                已选来源 {selectedItemIds.length} 个 · 已扫描场景 {scannedScopeCount} 个。
              </p>
            </div>
          </div>
          <p className="rc-body">{lastScanSummary}</p>
        </div>
      </aside>

      <main className="rc-main">
        <div className="rc-page">{children}</div>
      </main>
    </div>
  );
}
