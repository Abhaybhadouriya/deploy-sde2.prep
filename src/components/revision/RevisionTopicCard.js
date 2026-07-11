import { cssId, daysSince, statusFor } from "../../utils/revisionHelpers";

export default function RevisionTopicCard({
  topic,
  isOpen,
  openSubtopics,
  revision,
  onToggleTopic,
  onToggleSubtopic,
  onRevise,
}) {
  const topicId = cssId(topic.id);
  const days =
    revision && revision.lastRevised ? daysSince(revision.lastRevised) : null;
  const status = statusFor(days);

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
                      <a
                        className="ref-btn"
                        href={sub.ref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Reference ↗
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="last-line">
            {revision && revision.lastRevised
              ? `Last revised: ${revision.lastRevised}`
              : "Not revised yet"}
          </div>
        </div>
      </div>
    </div>
  );
}
