type OverviewPanelProps = {
  title: string;
  description: string;
};

export function OverviewPanel({ title, description }: OverviewPanelProps) {
  return (
    <article className="rc-card rc-panel">
      <h2 className="rc-panel__title">{title}</h2>
      <p className="rc-body">{description}</p>
    </article>
  );
}
