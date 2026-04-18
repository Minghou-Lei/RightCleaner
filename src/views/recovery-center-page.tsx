import { useAppState } from "../state/app-state";

export function RecoveryCenterPage() {
  const {
    state: { backups, operationError },
    activeBackupId,
    restoreBackup,
  } = useAppState();

  return (
    <section className="rc-screen">
      <header className="rc-section-heading">
        <div>
          <span className="rc-kicker">备份与恢复</span>
          <h2 className="rc-title">恢复链路与备份浏览入口</h2>
        </div>
      </header>

      {operationError ? <p className="rc-body">{operationError}</p> : null}

      <section className="rc-card">
        <div className="rc-stack">
          {backups.map((backup) => (
            <article className="rc-list-card" key={backup.id}>
              <div>
                <strong>{backup.label}</strong>
                <p className="rc-body">
                  {backup.itemTitle} · {backup.registryPath}
                </p>
                <p className="rc-body">
                  时间戳 {backup.createdAt} · 状态 {backup.status}
                </p>
              </div>
              <button
                className="rc-button rc-button-secondary"
                disabled={backup.status === "restored" || activeBackupId === backup.id}
                onClick={() => void restoreBackup(backup.id)}
                type="button"
              >
                {activeBackupId === backup.id ? "恢复中..." : backup.status === "restored" ? "已恢复" : "恢复"}
              </button>
            </article>
          ))}
          {backups.length === 0 ? <p className="rc-body">尚无可用恢复点。</p> : null}
        </div>
      </section>
    </section>
  );
}
