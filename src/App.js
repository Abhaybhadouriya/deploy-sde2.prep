import { Link, Route, Routes, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./context/AuthContext";
import contentData from "./data/content.json";
import LldPage from "./pages/LldPage";
import HldPage from "./pages/HldPage";
import DevOpsPage from "./pages/DevOpsPage";
import lldData from "./data/lld.json";
import hldData from "./data/hld.json";
import devopsData from "./data/devops.json";
import "./components/revision.css";

// Re-using the same spacing logic across the application
function parseDDMMYY(s) {
  if (!s) return new Date(0);
  const parts = s.split("-");
  if (parts.length !== 3) return new Date(0);
  const [dd, mm, yy] = parts.map(Number);
  return new Date(2000 + yy, mm - 1, dd);
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const past = parseDDMMYY(dateStr);
  const diff = Date.now() - past.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function App() {
  const { user, logout, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState(contentData);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  useEffect(() => {
    let active = true;
    const loadContent = async () => {
      try {
        const ref = doc(db, "siteContent", "pages");
        const snap = await getDoc(ref);
        if (snap.exists() && active) setContent(snap.data());
      } catch (error) {
        console.warn("Using local content fallback", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadContent();
    return () => { active = false; };
  }, []);

  if (loading) return (
    <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg, #0B0F14)', color: 'var(--text, #E7EDF3)' }}>
      <p style={{ fontFamily: "var(--font-mono, monospace)" }}>Loading spaced revision records...</p>
    </div>
  );

  return (
    <div className="app-shell revision-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #0B0F14)" }}>
      <header className="site" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(11, 15, 20, 0.88)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border, #1E2938)" }}>
        <div className="site-nav" style={{ maxWidth: "1180px", margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifySpace: "between", justifyContent: "space-between" }}>
          <Link to="/" className="brand" style={{ textDecoration: "none", color: "var(--text, #E7EDF3)", display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="dot" style={{ width: "9px", height: "9px", borderRadius: "2px", background: "var(--accent, #49D3C4)", boxShadow: "0 0 10px var(--accent, #49D3C4)" }}></span>
            {content.theme?.appName || "sde2.prep"}
          </Link>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {user ? (
              <>
                <Link to="/profile" className="mono" style={{ textDecoration: "none", color: "var(--accent, #49D3C4)", fontSize: "13px" }}>
                  {user.displayName?.split(" ")[0] || "Profile"}
                </Link>
                <button onClick={handleLogout} className="btn-revise" style={{ background: "transparent", border: "1px solid var(--red, #E5484D)", color: "var(--red, #E5484D)", cursor: "pointer", fontSize: "11.5px", padding: "6px 12px" }}>
                  Logout
                </button>
              </>
            ) : (
              <button onClick={loginWithGoogle} className="btn-revise" style={{ fontSize: "11.5px", padding: "6px 12px" }}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="content" style={{ flex: "1" }}>
        <Routes>
          <Route path="/" element={<HomePage content={content} />} />
          <Route path="/lld" element={<LldPage />} />
          <Route path="/hld" element={<HldPage />} />
          <Route path="/devops" element={<DevOpsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/:pageKey" element={<DetailPage content={content} />} />
        </Routes>
      </main>

      <footer style={{ maxWidth: "1180px", margin: "0 auto", padding: "40px 24px", width: "100%", borderTop: "1px solid var(--border, #1E2938)", color: "var(--text-faint, #5B6B7C)", fontSize: "12px", textAlign: "center" }}>
        Built with React and Persistent Spaced Repetition Hooks · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ hld: null, lld: null, devops: null });

  useEffect(() => {
    if (!user) return;
    
    const fetchAllStats = async () => {
      const results = {};
      const datasets = { hld: hldData, lld: lldData, devops: devopsData };

      for (const [key, config] of Object.entries(datasets)) {
        const snap = await getDocs(collection(db, "sdeprep", user.uid, key));
        const revisionMap = {};
        snap.forEach((docSnap) => {
          revisionMap[docSnap.id] = docSnap.data();
        });

        const topicIds = config.modules.flatMap((m) => m.topics.map((t) => t.id));
        let fresh = 0, freshIsh = 0, dueSoon = 0, overdue = 0;

        topicIds.forEach((id) => {
          const lastRevised = revisionMap[id]?.lastRevised;
          const days = daysSince(lastRevised);

          if (days <= 7) fresh++;
          else if (days <= 14) freshIsh++;
          else if (days <= 29) dueSoon++;
          else overdue++;
        });

        results[key] = { fresh, freshIsh, dueSoon, overdue, total: topicIds.length, revisedCount: snap.size };
      }
      setStats(results);
    };

    fetchAllStats();
  }, [user]);

  if (!user) return (
    <div style={{ padding: "5rem 2rem", textAlign: "center", color: "var(--text-dim)", fontFamily: 'var(--font-mono, monospace)' }}>
      Please sign in to view your customized revision tracker.
    </div>
  );

  return (
    <section style={{ padding: "3rem 2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <div className="topic" style={{ background: "var(--panel, #111823)", border: "1px solid var(--border, #1E2938)", padding: "2.5rem", borderRadius: "var(--radius, 10px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2.5rem", borderBottom: "1px solid var(--border, #1E2938)", paddingBottom: "2rem" }}>
          <img src={user.photoURL} alt="profile" style={{ width: "80px", height: "80px", borderRadius: "50%", border: "2px solid var(--accent, #49D3C4)" }} />
          <div>
            <h1 style={{ color: "var(--text, #E7EDF3)", margin: "0 0 0.5rem 0", fontSize: "1.75rem" }}>{user.displayName}</h1>
            <p className="mono" style={{ color: "var(--text-dim, #8CA0B3)", margin: 0, fontSize: "13px" }}>{user.email}</p>
          </div>
        </div>

        <h3 style={{ color: "var(--text, #E7EDF3)", marginBottom: "1.5rem" }}>Global Spaced Repetition Progress</h3>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          {Object.entries(stats).map(([key, data]) => {
            if (!data) return <div key={key} className="mono" style={{ color: "var(--text-faint)" }}>Loading {key} stats...</div>;
            return (
              <div key={key} style={{ background: "var(--panel-2, #0E141C)", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--border, #1E2938)" }}>
                <h4 style={{ color: "var(--accent, #49D3C4)", margin: "0 0 1rem 0", textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: 'var(--font-mono, monospace)' }}>{key}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--green, #3ED690)" }}>● Fresh (≤7d)</span>
                    <span className="mono" style={{ color: "var(--text)" }}>{data.fresh}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--yellow, #E4C147)" }}>● Fresh-ish (8-14d)</span>
                    <span className="mono" style={{ color: "var(--text)" }}>{data.freshIsh}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--orange, #F0883E)" }}>● Due soon (15-29d)</span>
                    <span className="mono" style={{ color: "var(--text)" }}>{data.dueSoon}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--red, #E5484D)" }}>● Overdue (≥30d / Never)</span>
                    <span className="mono" style={{ color: "var(--text)" }}>{data.overdue}</span>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid var(--border, #1E2938)", marginTop: "1rem", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-faint)" }}>
                  <span>Completed Updates</span>
                  <span className="mono" style={{ color: "var(--accent)" }}>{data.revisedCount} / {data.total}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomePage({ content }) {
  return (
    <section className="home-page" style={{ padding: "4rem 24px", maxWidth: "1180px", margin: "0 auto", width: "100%" }}>
      <div className="hero" style={{ padding: "0 0 3rem 0" }}>
        <p className="eyebrow" style={{ color: "var(--accent, #49D3C4)" }}>SDE2.PREP · Spaced revision</p>
        <h1 style={{ color: "var(--text, #E7EDF3)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.5px" }}>
          {content.theme?.appName || "SDE2 Spaced Revision Hub"}
        </h1>
        <p style={{ color: "var(--text-dim, #8CA0B3)", fontSize: "16px", lineHeight: "1.6", maxWidth: "680px", margin: "1rem 0 0 0" }}>
          {content.theme?.tagline || "Master your Low Level Design, High Level Design, and Cloud DevOps structures with persistent logs."}
        </p>
      </div>

      <div className="tiles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {content.tiles?.map((tile) => {
          let target = `/${tile.key}`;
          if (tile.key === "lld") target = "/lld";
          if (tile.key === "hld") target = "/hld";
          if (tile.key === "devops") target = "/devops";

          return (
            <Link key={tile.key} to={target} className="topic" style={{ display: "block", textDecoration: "none", background: "var(--panel, #111823)", border: "1px solid var(--border, #1E2938)", borderRadius: "var(--radius, 10px)", padding: "2.5rem", transition: "transform 0.15s ease, border-color 0.15s ease" }}>
              <span className="tile-icon" style={{ fontSize: "2.5rem", display: "block", marginBottom: "1.5rem" }}>{tile.icon}</span>
              <h2 style={{ color: "var(--text, #E7EDF3)", margin: "0 0 0.75rem 0", fontSize: "1.5rem", fontWeight: 600 }}>{tile.title}</h2>
              <p style={{ color: "var(--text-dim, #8CA0B3)", margin: 0, fontSize: "14px", lineHeight: "1.5" }}>{tile.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DetailPage({ content }) {
  const { pageKey } = useParams();
  const page = content.pages?.[pageKey];

  if (!page) {
    return (
      <section style={{ padding: "4rem 24px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <Link to="/" className="ref-btn" style={{ marginBottom: "2rem" }}>← Back home</Link>
        <div className="topic" style={{ background: "var(--panel, #111823)", border: "1px solid var(--border, #1E2938)", padding: "3rem", borderRadius: "var(--radius)" }}>
          <h1 style={{ color: "var(--text, #E7EDF3)" }}>Page Not Found</h1>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "4rem 24px", maxWidth: "800px", margin: "0 auto" }}>
      <Link to="/" className="ref-btn" style={{ marginBottom: "2rem", display: "inline-flex" }}>← Back home</Link>

      <div className="topic" style={{ background: "var(--panel, #111823)", border: "1px solid var(--border, #1E2938)", padding: "3rem", borderRadius: "var(--radius, 10px)" }}>
        <p className="eyebrow" style={{ color: "var(--accent, #49D3C4)" }}>{page.badge}</p>
        <h1 style={{ color: "var(--text, #E7EDF3)", fontSize: "2rem", margin: "0 0 1rem 0" }}>{page.title}</h1>
        <p style={{ color: "var(--text-dim, #8CA0B3)", fontSize: "15px", lineHeight: "1.6", marginBottom: "2rem" }}>{page.intro}</p>

        <ul style={{ paddingLeft: "1.25rem", margin: "0 0 2rem 0", color: "var(--text-dim, #8CA0B3)", lineHeight: "1.6" }}>
          {page.points?.map((point) => (
            <li key={point} style={{ marginBottom: "0.75rem" }}>{point}</li>
          ))}
        </ul>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {page.tags?.map((tag) => (
            <span key={tag} className="mono" style={{ background: "var(--panel-2, #0E141C)", border: "1px solid var(--border, #1E2938)", color: "var(--text-dim, #8CA0B3)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default App;
