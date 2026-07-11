import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import RevisionSiteHeader from "../components/revision/RevisionSiteHeader";
import RevisionHeroSection from "../components/revision/RevisionHeroSection";
import RevisionTopicCard from "../components/revision/RevisionTopicCard";
import { db } from "../firebase";
import { doc, setDoc, getDocs, collection, getDoc, arrayUnion } from "firebase/firestore";
import "../components/revision.css";

// Helper functions for date & status computation
function todayStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

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

function computeHealthCounts(revisionMap, allTopicIds) {
  let fresh = 0;     // <= 7 days
  let warm = 0;      // 8 - 14 days
  let soon = 0;      // 15 - 29 days
  let cold = 0;      // >= 30 days or never revised

  allTopicIds.forEach((id) => {
    const lastRevised = revisionMap[id]?.lastRevised;
    const days = daysSince(lastRevised);

    if (days <= 7) {
      fresh++;
    } else if (days <= 14) {
      warm++;
    } else if (days <= 29) {
      soon++;
    } else {
      cold++;
    }
  });

  return {
    green: fresh,
    yellow: warm,
    orange: soon,
    red: cold
  };
}

export default function HldPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  
  // Management States
  const [manageMode, setManageMode] = useState(null); // 'add' | 'remove' | 'edit'
  const [selMod, setSelMod] = useState("");
  const [selTopic, setSelTopic] = useState("");
  const [selSub, setSelSub] = useState("");

  // New Add States
  const [formData, setFormData] = useState({
    moduleTitle: "",
    topicTitle: "",
    subTitle: "",
    subDesc: "",
    subRef: ""
  });

  // Confirmation States
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "sdeprepJson", "hld"));
        if (snap.exists()) {
          // Access the inner .data property from the Firestore document
          setConfig(snap.data()); 
        }
      } catch (err) {
        console.error("Error fetching HLD config:", err);
      }
    };
    fetchConfig();
  }, []);

  const modules = useMemo(() => config?.modules || [], [config]);
  const topicIds = useMemo(
    () => modules.flatMap((module) => module.topics.map((topic) => topic.id)),
    [modules]
  );

  const [openTopics, setOpenTopics] = useState({});
  const [openSubtopics, setOpenSubtopics] = useState({});
  const [revisionMap, setRevisionMap] = useState({});
  const [customLinks, setCustomLinks] = useState({});
  const [activeModule, setActiveModule] = useState(modules[0]?.id || "");
  const [banner, setBanner] = useState("");

  const healthCounts = useMemo(
    () => computeHealthCounts(revisionMap, topicIds),
    [revisionMap, topicIds]
  );

  useEffect(() => {
    if (!config) return; // Guard against null config
    let active = true;
    const fetchGlobalLinks = async () => {
      try {
        const snap = await getDoc(doc(db, "sdeprepLinks", config.revisionPrefix));
        if (snap.exists() && active) {
          setCustomLinks(snap.data());
        }
      } catch (err) {
        console.error("Error loading links:", err);
      }
    };
    fetchGlobalLinks();
    return () => { active = false; };
  }, [config?.revisionPrefix]);

  useEffect(() => {
    if (!user?.uid || !config) {
      setRevisionMap({});
      setBanner("Sign in with Google to sync and save your progress to the cloud.");
      return undefined;
    }

    let active = true;

    const syncStatuses = async () => {
      try {
        const querySnapshot = await getDocs(
          collection(db, "sdeprep", user.uid, config.revisionPrefix)
        );

        if (!active) return;

        const data = {};
        querySnapshot.forEach((docSnap) => {
          data[docSnap.id] = docSnap.data();
        });

        setRevisionMap(data);
        setBanner("");
      } catch (err) {
        console.error("Error loading from Firebase:", err);
        setBanner("Failed to fetch your progress from the cloud.");
      }
    };

    syncStatuses();

    return () => {
      active = false;
    };
  }, [config?.revisionPrefix, user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined" || modules.length === 0) return undefined;

    const sections = modules.map((module) => document.getElementById(module.id));
    const links = [...document.querySelectorAll(".revision-page .toc a")];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((link) => link.classList.remove("active"));
            const index = sections.indexOf(entry.target);
            if (index > -1) links[index].classList.add("active");
            setActiveModule(entry.target.id);
          }
        });
      },
      { rootMargin: "-10% 0px -75% 0px" }
    );

    sections.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [modules]);

  const toggleTopic = (topicId) => {
    setOpenTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const toggleSubtopic = (key) => {
    setOpenSubtopics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRevise = async (topicId) => {
    if (!user?.uid) {
      setBanner("Please sign in to save your revision history.");
      return;
    }
    const payload = { lastRevised: todayStr() };
    setRevisionMap((prev) => ({ ...prev, [topicId]: payload }));
    try {
      await setDoc(doc(db, "sdeprep", user.uid, config.revisionPrefix, topicId), payload);
    } catch (err) {
      console.error("Error saving revision:", err);
      setBanner("Failed to sync your revision to the cloud.");
    }
  };

  const handleAddLink = async (topicId, url) => {
    if (!user) {
      setBanner("Please sign in to add reference links.");
      return;
    }
    const newLink = {
      url,
      status: true,
      date: todayStr(),
      userid: user.uid,
      useremail: user.email || "anonymous"
    };
    try {
      await setDoc(
        doc(db, "sdeprepLinks", config.revisionPrefix),
        { [topicId]: arrayUnion(newLink) },
        { merge: true }
      );
      setCustomLinks((prev) => ({
        ...prev,
        [topicId]: [...(prev[topicId] || []), newLink]
      }));
    } catch (err) {
      console.error("Error saving link:", err);
      setBanner("Failed to submit link.");
    }
  };

  const updateFirebaseConfig = async (newConfig) => {
    try {
      await setDoc(doc(db, "sdeprepJson", "hld"), { data: newConfig });
      setConfig(newConfig);
      setBanner("Configuration updated successfully!");
      setManageMode(null);
      setSelMod(""); setSelTopic(""); setSelSub("");
      setFormData({ moduleTitle: "", topicTitle: "", subTitle: "", subDesc: "", subRef: "" });
    } catch (err) {
      console.error("Error updating config:", err);
      setBanner("Failed to update configuration.");
    }
  };

  const handleAddAction = async (e) => {
    e.preventDefault();
    if (!config) return;

    let newModules = JSON.parse(JSON.stringify(config.modules));
    const now = new Date();
    const ss = String(now.getSeconds()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nextTopicId = `${ss}${mm}`;

    const newSubItem = {
      t: formData.subTitle,
      d: formData.subDesc,
      ref: formData.subRef
    };

    if (selMod === "NEW") {
      const nextModNum = Number(newModules[newModules.length - 1]?.idx ?? 0) + 1;
      newModules.push({
        id: `m${ss}${mm}`,
        idx: String(nextModNum).padStart(2, '0'),
        title: formData.moduleTitle,
        topics: [{ id: nextTopicId, title: formData.topicTitle, subs: [newSubItem] }]
      });
    } else {
      const mIdx = newModules.findIndex(m => m.id === selMod);
      if (mIdx === -1) return;

      if (selTopic === "NEW") {
        newModules[mIdx].topics.push({ id: nextTopicId, title: formData.topicTitle, subs: [newSubItem] });
      } else if (selTopic) {
        const tIdx = newModules[mIdx].topics.findIndex(t => t.id === selTopic);
        if (tIdx !== -1) newModules[mIdx].topics[tIdx].subs.push(newSubItem);
      }
    }

    await updateFirebaseConfig({ ...config, modules: newModules });
  };

  const handleRemoveAction = async () => {
    if (deleteInput !== "delete") {
      alert("Please type 'delete' to confirm.");
      return;
    }

    if (!config || !selMod) return;
    let newModules = JSON.parse(JSON.stringify(config.modules));
    const mIdx = newModules.findIndex(m => m.id === selMod);
    if (mIdx === -1) return;

    if (selSub) {
      // Remove Subtopic
      const tIdx = newModules[mIdx].topics.findIndex(t => t.id === selTopic);
      newModules[mIdx].topics[tIdx].subs.splice(parseInt(selSub), 1);
    } else if (selTopic) {
      // Remove Topic
      newModules[mIdx].topics = newModules[mIdx].topics.filter(t => t.id !== selTopic);
    } else {
      // Remove Module (Topic group)
      newModules.splice(mIdx, 1);
    }

    await updateFirebaseConfig({ ...config, modules: newModules });
    setShowConfirm(false);
    setDeleteInput("");
  };

  if (!config) return <div className="revision-page" style={{padding: '2rem', color: 'white'}}>Loading content...</div>;

  const currentModule = config.modules?.find(m => m.id === selMod);
  const currentTopic = currentModule?.topics?.find(t => t.id === selTopic);

  return (
    <div className="revision-page">
      <RevisionSiteHeader activeKey={config.revisionPrefix} navLabel={config.navLabel} />
      <RevisionHeroSection config={config} healthCounts={healthCounts} />

      <div className="container" style={{ marginBottom: '1rem', display: 'flex', gap: '10px' }}>
        <button className="btn-revise" onClick={() => setManageMode(manageMode === 'add' ? null : 'add')}>Add Topic</button>
        <button className="btn-revise" style={{ borderColor: 'var(--red)' }} onClick={() => setManageMode(manageMode === 'remove' ? null : 'remove')}>Remove Topic</button>
      </div>

      {manageMode === 'add' && (
        <div className="container" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid var(--border)' }}>
          <h4 style={{ color: 'var(--text)', marginBottom: '1.25rem' }}>Add New Resource</h4>
          <form onSubmit={handleAddAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <select required value={selMod} onChange={(e) => { setSelMod(e.target.value); setSelTopic(e.target.value === "NEW" ? "NEW" : ""); }} className="mono" style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)' }}>
              <option value="">Step 1: Select Module...</option>
              <option value="NEW">+ Add Brand New Module</option>
              {config.modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            {selMod === "NEW" && (
              <input required type="text" placeholder="New Module Title" value={formData.moduleTitle} onChange={(e) => setFormData({...formData, moduleTitle: e.target.value})} style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px' }} />
            )}
            {selMod && selMod !== "NEW" && (
              <select required value={selTopic} onChange={(e) => setSelTopic(e.target.value)} className="mono" style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)' }}>
                <option value="">Step 2: Choose Topic...</option>
                <option value="NEW">+ Add Brand New Topic</option>
                {currentModule?.topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            )}
            {selTopic === "NEW" && (
              <input required type="text" placeholder="Topic Title" value={formData.topicTitle} onChange={(e) => setFormData({...formData, topicTitle: e.target.value})} style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px' }} />
            )}
            {selTopic && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "4px", border: "1px dashed var(--border)" }}>
                <input required type="text" placeholder="Subtopic Title" value={formData.subTitle} onChange={(e) => setFormData({...formData, subTitle: e.target.value})} style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px' }} />
                <textarea required placeholder="Description..." value={formData.subDesc} onChange={(e) => setFormData({...formData, subDesc: e.target.value})} style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px', minHeight: '80px' }} />
                <input type="url" placeholder="Reference Link" value={formData.subRef} onChange={(e) => setFormData({...formData, subRef: e.target.value})} style={{ background: '#0B0F14', color: 'white', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px' }} />
              </div>
            )}
            {selTopic && <button type="submit" className="btn-revise" style={{ background: 'var(--accent)', color: 'black', fontWeight: 'bold' }}>Save</button>}
          </form>
        </div>
      )}

      {/* Remove Management Panel */}
      {manageMode === 'remove' && (
        <div className="container" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid var(--border)' }}>
          <h4 style={{ color: 'var(--text)', marginBottom: '1rem' }}>Cascading Remove</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <select value={selMod} onChange={(e) => { setSelMod(e.target.value); setSelTopic(""); setSelSub(""); }} className="mono" style={{ background: '#0B0F14', color: 'white', padding: '8px' }}>
              <option value="">Select Module...</option>
              {config.modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>

            {selMod && (
              <select value={selTopic} onChange={(e) => { setSelTopic(e.target.value); setSelSub(""); }} className="mono" style={{ background: '#0B0F14', color: 'white', padding: '8px' }}>
                <option value="">Select Topic...</option>
                {currentModule?.topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            )}

            {selTopic && (
              <select value={selSub} onChange={(e) => setSelSub(e.target.value)} className="mono" style={{ background: '#0B0F14', color: 'white', padding: '8px' }}>
                <option value="">Select Subtopic...</option>
                {currentTopic?.subs.map((s, idx) => <option key={idx} value={idx}>{s.t}</option>)}
              </select>
            )}

            <button 
              className="btn-revise" 
              style={{ background: 'var(--red)', opacity: selMod ? 1 : 0.5 }} 
              disabled={!selMod}
              onClick={() => setShowConfirm(true)}
            >
              Remove Selected {selSub ? "Subtopic" : selTopic ? "Topic" : "Module"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--panel)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--text)', marginBottom: '1rem' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '1.5rem' }}>
              This action cannot be undone. Please type <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>delete</span> to confirm.
            </p>
            <input 
              type="text" 
              value={deleteInput} 
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="type delete here"
              style={{ width: '100%', background: '#0B0F14', border: '1px solid var(--border)', color: 'white', padding: '10px', borderRadius: '4px', marginBottom: '1.5rem', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-revise" style={{ flex: 1 }} onClick={() => { setShowConfirm(false); setDeleteInput(""); }}>Cancel</button>
              <button className="btn-revise" style={{ flex: 1, background: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleRemoveAction}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

    
      {(manageMode === 'add' || manageMode === 'edit') && (
        <div className="container" style={{ color: 'var(--text-faint)', padding: '1rem' }}>
          Management UI for {manageMode} mode active. (Define specific forms here)
        </div>
      )}

      <div className="layout">
        <nav className="toc">
          {modules.map((module) => (
            <a
              key={module.id}
              href={"#" + module.id}
              className={activeModule === module.id ? "active" : ""}
            >
              <span>{module.title.split(":")[0].split("(")[0]}</span>
              <span className="mono">{module.idx}</span>
            </a>
          ))}
        </nav>

        <main>
          {modules.map((module) => (
            <section className="module" id={module.id} key={module.id}>
              <div className="module-head">
                <span className="midx">MOD {module.idx}</span>
                <h2>{module.title}</h2>
              </div>

              <div className="topics">
                {module.topics.map((topic) => (
                  <RevisionTopicCard
                    key={topic.id}
                    topic={topic}
                    isOpen={!!openTopics[topic.id]}
                    openSubtopics={openSubtopics}
                    revision={revisionMap[topic.id]}
                    onToggleTopic={toggleTopic}
                    onToggleSubtopic={toggleSubtopic}
                    onRevise={() => handleRevise(topic.id)}
                    customLinks={customLinks[topic.id] || []}
                    onAddLink={handleAddLink}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>

      <footer>
        Dates stored as <span className="mono">DD-MM-YY</span>, updated on each
        &quot;Revised&quot; press · Red ≥30d · Orange 15–29d · Yellow 7–14d · Green ≤7d
      </footer>
    </div>
  );
}
