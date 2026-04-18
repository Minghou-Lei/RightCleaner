import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

import { useAppState } from "../state/app-state";

const navigation = [
  { to: "/", label: "总览" },
  { to: "/cleanup", label: "清理项" },
  { to: "/batch", label: "批量确认" },
  { to: "/recovery", label: "备份恢复" }
];

export function AppShell({ children }: PropsWithChildren) {
  const {
    state: { phase, selectedItemIds }
  } = useAppState();

  return (
    <div className="rc-app-shell">
      <aside className="rc-sidebar rc-surface">
        <div className="rc-sidebar__brand">
          <span className="rc-sidebar__eyebrow">MIN-44 Foundation</span>
          <h1 className="rc-title">RightCleaner</h1>
          <p className="rc-body">为扫描、评估、清理与恢复提供统一状态和页面骨架。</p>
        </div>

        <nav className="rc-nav">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `rc-nav__link${isActive ? " is-active" : ""}`}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="rc-sidebar__status rc-card">
          <span className="rc-badge">当前阶段 {phase}</span>
          <p className="rc-body">已选清理项 {selectedItemIds.length} 个，后续页面可直接复用该全局状态。</p>
        </div>
      </aside>

      <main className="rc-main">
        <div className="rc-page">{children}</div>
      </main>
    </div>
  );
}
