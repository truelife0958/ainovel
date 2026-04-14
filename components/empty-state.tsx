type EmptyStateProps = {
  message: string;
  variant?: "editor" | "card";
};

export function EmptyState({ message, variant = "editor" }: EmptyStateProps) {
  return (
    <div className={variant === "card" ? "list-card empty-card" : "empty-editor"}>
      <p className="muted">{message}</p>
    </div>
  );
}
