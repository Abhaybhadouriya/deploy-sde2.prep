import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  reload,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { isFirebaseEnabled } from "../utils/firebaseEnabled";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!isFirebaseEnabled()) {
      setLoading(false);
      return undefined;
    }

    let resolved = false;
    const finishLoading = (nextUser) => {
      if (resolved) return;
      resolved = true;
      setUser(nextUser);
      setLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      finishLoading(null);
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      window.clearTimeout(timeoutId);
      finishLoading(nextUser);
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError("");
    let reloadWindow = true; // Ensure the auth state is reloaded before signing in
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign-in error:", error);
      if (error.code === 'auth/admin-restricted-operation') {
        alert("Something went wrong signing with this ID. This account may have administrative restrictions.");
      } else {
        alert("Something went wrong during sign-in. Please try again.");
      }
      reloadWindow = false; // Prevent reload if there's an error
      setAuthError(error.message || "Google sign-in failed.");
    }
    if (reloadWindow) {
      window.location.reload();
    } // Refresh the page to update the state after sign-in
  };

  const logout = () => {
    signOut(auth).then(() => {
      setUser(null);
    }).catch((error) => {
      setAuthError(error.message || "Logout failed.");
    });
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      signInWithGoogle,
      logout,
      isFirebaseReady: isFirebaseEnabled(),
    }),
    [user, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
