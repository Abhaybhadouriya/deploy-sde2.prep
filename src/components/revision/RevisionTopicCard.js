import { cssId, daysSince, statusFor } from "../../utils/revisionHelpers";
import { useState } from "react";

export default function RevisionTopicCard({
  topic,
  isOpen,
  openSubtopics,
  revision,
  onToggleTopic,
  onToggleSubtopic,
  onRevise,
  customLinks = [],
  onAddLink,
}) {
  const [inputUrl, setInputUrl] = useState("");
  const topicId = cssId(topic.id);
  const days =
    revision && revision.lastRevised ? daysSince(revision.lastRevised) : null;
  const status = statusFor(days);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    onAddLink(topic.id, inputUrl.trim());
    setInputUrl("");
  };

  const visibleLinks = customLinks.filter((l) => l.status === true);

  return (
    <div
      className={`topic ${isOpen ? "open" : ""}`}
      id={"topic-" + topicId}
    >
      <div className="topic-row" onClick={() => onToggleTopic(topic.id)}>
        <span className="num mono">{topic.id}</span>
        <span className="title">{topic.title}</span>
        <span className={`status-pill ${status}`}>
          <span className="status-dot"></span>
          <span className="pill-label">
            {revision && revision.lastRevised ? `${days}d ago` : "never"}
          </span>
        </span>
        <button
          className="btn-revise"
          onClick={(e) => {
            e.stopPropagation();
            onRevise(topic.id);
          }}
        >
          Revised
        </button>
      </div>

      <div className="topic-body">
        <div className="topic-body-inner">
          <div className="subtopics">
            {topic.subs.map((sub, index) => {
              const subKey = `${topic.id}-${index}`;
              const subOpen = !!openSubtopics[subKey];
              return (
                <div className={`sub ${subOpen ? "open" : ""}`} key={subKey}>
                  <div
                    className="sub-row"
                    onClick={() => onToggleSubtopic(subKey)}
                  >
                    <span className="caret-sub">▸</span>
                    <span className="sub-title">{sub.t}</span>
                  </div>
                  <div className="sub-body">
                    <div className="sub-body-inner">
                      <p>{sub.d}</p>
                      {sub.ref && (
                        <a
                          className="ref-btn"
                          href={sub.ref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Reference ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Global User Submitted Reference Links */}
          <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border, #1E2938)", paddingTop: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span className="mono" style={{ fontSize: "11px", color: "var(--accent, #49D3C4)", textTransform: "uppercase", letterSpacing: "1px" }}>
                Shared Resources ({visibleLinks.length})
              </span>
            </div>

            {visibleLinks.length > 0 ? (
              <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1rem 0", color: "var(--text-dim, #8CA0B3)", fontSize: "13px" }}>
                {visibleLinks.map((link, idx) => (
                  <li key={idx} style={{ marginBottom: "0.5rem" }}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent, #49D3C4)", textDecoration: "underline", wordBreak: "break-all" }}>
                      {link.url}
                    </a>{" "}
                    <span style={{ color: "var(--text-faint, #5B6B7C)", fontSize: "11px" }}>
                      (via {link.useremail} on {link.date})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--text-faint, #5B6B7C)", fontSize: "12.5px", margin: "0 0 1rem 0" }}>No shared references yet.</p>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                required
                placeholder="Submit reference URL (https://...)"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: "var(--panel, #111823)",
                  border: "1px solid var(--border, #1E2938)",
                  borderRadius: "4px",
                  padding: "6px 10px",
                  color: "var(--text, #E7EDF3)",
                  fontSize: "12.5px"
                }}
              />
              <button type="submit" className="btn-revise" style={{ padding: "4px 12px", fontSize: "12px", flexShrink: 0 }}>
                Submit Link
              </button>
            </form>
          </div>

          <div className="last-line" style={{ marginTop: "1rem" }}>
            {revision && revision.lastRevised
              ? `Last revised: ${revision.lastRevised}`
              : "Not revised yet"}
          </div>
        </div>
      </div>
    </div>
  );
}