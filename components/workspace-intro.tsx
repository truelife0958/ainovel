type WorkspaceIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  compact?: boolean;
};

export function WorkspaceIntro({ eyebrow, title, description, compact = false }: WorkspaceIntroProps) {
  return (
    <div className={compact ? "workspace-intro compact" : "workspace-intro"}>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
    </div>
  );
}