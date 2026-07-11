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
    green:fresh,
    yellow:warm,
    orange:soon,
    red:cold
  };
}

export default function LldPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "sdeprepJson", "lld"));
        
        if (snap.exists()) {
          setConfig(snap.data());
        }
      } catch (err) {
        console.error("Error fetching LLD config:", err);
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

  if (!config) return <div className="revision-page" style={{padding: '2rem', color: 'white'}}>Loading content...</div>;

  return (
    <div className="revision-page">
      <RevisionSiteHeader
        activeKey={config.revisionPrefix}
        navLabel={config.navLabel}
      />

      <RevisionHeroSection config={config} healthCounts={healthCounts} />

      {banner ? (
        <div className="sync-banner show">
          <span>{banner}</span>
        </div>
      ) : null}

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
