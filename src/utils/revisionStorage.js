import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { isFirebaseEnabled } from "./firebaseEnabled";

const FIREBASE_UNAVAILABLE_KEY = "revision-firebase-unavailable";
const FIREBASE_TIMEOUT_MS = 800;

function revisionKey(prefix, topicId) {
  return `${prefix}:${topicId}`;
}

function readLocalRevision(key) {
  const raw = window.localStorage.getItem("rev:" + key);
  return raw ? JSON.parse(raw) : null;
}

function writeLocalRevision(key, payload) {
  window.localStorage.setItem("rev:" + key, JSON.stringify(payload));
}

export function isFirebaseUnavailable() {
  if (!isFirebaseEnabled()) return true;
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(FIREBASE_UNAVAILABLE_KEY) === "1";
}

function markFirebaseUnavailable() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(FIREBASE_UNAVAILABLE_KEY, "1");
  }
}

function withTimeout(promise, ms = FIREBASE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Firebase request timed out")), ms);
    }),
  ]);
}

export function loadRevisionStatusesFromLocal(prefix, topicIds) {
  const results = {};
  for (const topicId of topicIds) {
    results[topicId] = readLocalRevision(revisionKey(prefix, topicId));
  }
  return results;
}

export async function loadRevisionStatuses(prefix, topicIds, userId) {
  const localResults = loadRevisionStatusesFromLocal(prefix, topicIds);

  if (!userId || !isFirebaseEnabled() || isFirebaseUnavailable()) {
    return { results: localResults, usedFallback: true };
  }

  try {
    const ref = doc(db, "users", userId, "revisionLogs", prefix);
    const snap = await withTimeout(getDoc(ref));
    const remoteLog = snap.exists() ? snap.data() : {};

    const results = {};
    for (const topicId of topicIds) {
      results[topicId] = remoteLog[topicId] || localResults[topicId] || null;
    }

    return { results, usedFallback: false };
  } catch (error) {
    markFirebaseUnavailable();
    return { results: localResults, usedFallback: true };
  }
}

export async function saveRevisionStatus(prefix, topicId, payload, userId) {
  const key = revisionKey(prefix, topicId);
  writeLocalRevision(key, payload);

  if (!userId || !isFirebaseEnabled() || isFirebaseUnavailable()) {
    return { usedFallback: true };
  }

  try {
    const ref = doc(db, "users", userId, "revisionLogs", prefix);
    await withTimeout(setDoc(ref, { [topicId]: payload }, { merge: true }));
    return { usedFallback: false };
  } catch (error) {
    markFirebaseUnavailable();
    return { usedFallback: true };
  }
}
