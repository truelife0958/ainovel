import { ReactNode } from "react";

type SummaryCardProps = {
  eyebrow: string;
  children: ReactNode;
};

export function SummaryCard({ eyebrow, children }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <p className="eyebrow">{eyebrow}</p>
      {children}
    </article>
  );
}
