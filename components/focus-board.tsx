import { ReactNode } from "react";

type FocusBoardHighlight = {
  label: string;
  value: string;
  hint?: string;
};

type FocusBoardSection = {
  title: string;
  items: string[];
  footer?: ReactNode;
};

type FocusBoardProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: FocusBoardHighlight[];
  sections: FocusBoardSection[];
};

export function FocusBoard({
  eyebrow,
  title,
  description,
  highlights = [],
  sections,
}: FocusBoardProps) {
  return (
    <section className="focus-board">
      <div className="focus-board-head">
        <div className="focus-board-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        {highlights.length ? (
          <div className="focus-board-highlights" aria-label="当前聚焦摘要">
            {highlights.map((item) => (
              <div key={item.label} className="focus-board-highlight">
                <span className="focus-board-label">{item.label}</span>
                <strong>{item.value}</strong>
                {item.hint ? <span className="muted">{item.hint}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="focus-board-sections">
        {sections.map((section) => (
          <article key={section.title} className="focus-board-section">
            <p className="eyebrow">{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {section.footer ? <div>{section.footer}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
