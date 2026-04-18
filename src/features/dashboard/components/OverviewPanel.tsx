import type { ReactNode } from "react";

type OverviewPanelProps = {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: ReactNode;
};

export function OverviewPanel({ title, description, eyebrow, icon }: OverviewPanelProps) {
  return (
    <article className="rc-card rc-panel">
      <div className="rc-panel__header">
        {icon ? <span className="rc-icon-chip">{icon}</span> : null}
        {eyebrow ? <span className="rc-panel__eyebrow">{eyebrow}</span> : null}
      </div>
      <h2 className="rc-panel__title">{title}</h2>
      <p className="rc-body">{description}</p>
    </article>
  );
}
