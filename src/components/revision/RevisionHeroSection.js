export default function RevisionHeroSection({ config, healthCounts }) {
  console.log("RevisionHeroSection config:", config);
  return (
    <div className="hero">
      <div className="eyebrow">{config.eyebrow}</div>
      <h1>{config.title}</h1>
      <p>{config.description}</p>

      <div className="health">
        {Object.keys(healthCounts).map((k) => (
          <div key={k} className={`health-seg s-${k}`}>
            <div className="n">{healthCounts[k]}</div>
            <div className="l">
              {k === "red"
                ? "overdue (≥30d)"
                : k === "orange"
                ? "due soon (15–29d)"
                : k === "yellow"
                ? "fresh-ish (7–14d)"
                : "fresh (≤7d)"}
            </div>
          </div>
        ))}
      </div>

      <div className="health-bar">
        {Object.keys(healthCounts).map((k) => {
          const total =
            Object.values(healthCounts).reduce((a, b) => a + b, 0) || 1;
          const width = `${((healthCounts[k] / total) * 100).toFixed(2)}%`;
          const color =
            k === "red"
              ? "var(--red)"
              : k === "orange"
              ? "var(--orange)"
              : k === "yellow"
              ? "var(--yellow)"
              : "var(--green)";
          return <div key={k} style={{ width, background: color }}></div>;
        })}
      </div>
    </div>
  );
}
