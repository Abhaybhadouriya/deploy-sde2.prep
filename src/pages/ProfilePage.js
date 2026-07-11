import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

const defaultProfile = {
  name: "Guest Developer",
  email: "guest@example.com"
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(defaultProfile);
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const docId = authUser ? authUser.uid : "profile";
        const ref = doc(db, "siteContent", docId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          if (active) setProfile(snap.data());
        } else {
          const initialData = {
            name: authUser?.displayName || defaultProfile.name,
            email: authUser?.email || defaultProfile.email
          };
          await setDoc(ref, initialData);
          if (active) setProfile(initialData);
        }
      } catch (error) {
        console.warn("Firebase profile data unavailable, using fallback data.", error);
        if (active) {
          setProfile({
            name: authUser?.displayName || defaultProfile.name,
            email: authUser?.email || defaultProfile.email
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [authUser]);

  if (loading) {
    return (
      <section className="page-shell">
        <p>Loading profile...</p>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <Link to="/" className="back-link">
        ← Back home
      </Link>

      <div className="detail-card">
        <h1>User Profile</h1>

        <div className="profile-info-block" style={{
          background: "rgba(255, 255, 255, 0.05)",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "20px",
          border: "1px solid rgba(255, 255, 255, 0.1)"
        }}>
          <p style={{ margin: "10px 0" }}><strong>Name:</strong> {profile.name}</p>
          <p style={{ margin: "10px 0" }}><strong>Email:</strong> {profile.email}</p>
          {authUser && (
            <p style={{ margin: "10px 0", fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
              <strong>Firebase UID:</strong> {authUser.uid}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
