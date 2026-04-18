import { OverviewPanel } from '@/features/dashboard/components/OverviewPanel';

const sections = [
  {
    title: '工程基线',
    description: '统一目录、脚本和工具链已经落地，可直接扩展扫描、审查和清理流程。',
  },
  {
    title: '设计令牌',
    description: '复用既有 design tokens，保持桌面应用视觉基线一致。',
  },
  {
    title: '可测试骨架',
    description: '组件、hooks、services 与 tests 目录已经预留，后续功能可按模块扩展。',
  },
];

export default function App() {
  return (
    <main className="rc-page rc-app-shell">
      <section className="rc-surface rc-hero">
        <div className="rc-hero__copy">
          <span className="rc-badge">MIN-43</span>
          <h1 className="rc-title">RightCleaner 工程骨架已初始化</h1>
          <p className="rc-body">
            当前仓库已具备应用入口、统一规范、测试基线与目录约束，可继续承接扫描、审查、禁用和恢复模块。
          </p>
        </div>
      </section>

      <section className="rc-grid">
        {sections.map((section) => (
          <OverviewPanel
            key={section.title}
            title={section.title}
            description={section.description}
          />
        ))}
      </section>
    </main>
  );
}
