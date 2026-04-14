type Metric = {
  label: string;
  value: string;
  hint: string;
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <article key={metric.label} className="metric-card">
          <p className="eyebrow">{metric.label}</p>
          <h3>{metric.value}</h3>
          <p className="muted">{metric.hint}</p>
        </article>
      ))}
    </div>
  );
}
