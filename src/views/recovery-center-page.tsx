import { useAppState } from "../state/app-state";

export function RecoveryCenterPage() {
  const {
    state: { backups }
  } = useAppState();

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">备份与恢复</span>
          <h2 className="rc-title">恢复链路与备份浏览入口</h2>
        </div>
      </header>

      <section className="rc-card">
        <div className="rc-stack">
          {backups.map((backup) => (
            <article className="rc-list-card" key={backup.id}>
              <div>
                <strong>{backup.label}</strong>
                <p className="rc-body">
                  {backup.createdAt} · 状态 {backup.status}
                </p>
              </div>
              <span className="rc-pill rc-pill--info">{backup.sizeLabel}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
