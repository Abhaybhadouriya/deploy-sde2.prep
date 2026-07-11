import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { isFirebaseEnabled } from "./firebaseEnabled";

const FIREBASE_UNAVAILABLE_KEY = "site-content-firebase-unavailable";

function isFirebaseUnavailable() {
  if (!isFirebaseEnabled()) return true;
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(FIREBASE_UNAVAILABLE_KEY) === "1";
}

function markFirebaseUnavailable() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(FIREBASE_UNAVAILABLE_KEY, "1");
  }
}

function withTimeout(promise, ms = 800) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Firebase request timed out")), ms);
    }),
  ]);
}

export async function loadSiteContent(fallbackContent) {
  if (!isFirebaseEnabled() || isFirebaseUnavailable()) {
    return fallbackContent;
  }

  try {
    const ref = doc(db, "siteContent", "pages");
    const snap = await withTimeout(getDoc(ref));

    if (snap.exists()) {
      return snap.data();
    }

    await withTimeout(setDoc(ref, fallbackContent));
    return fallbackContent;
  } catch (error) {
    console.warn("Firebase data unavailable, using local JSON content.", error);
    markFirebaseUnavailable();
    return fallbackContent;
  }
}
