import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { user, loading, signInWithGoogle, authError, isFirebaseReady } = useAuth();
  const location = useLocation();
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState("");

  const redirectTo = location.state?.from?.pathname || "/";

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setLocalError("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setLocalError(error.message || "Could not sign in with Google.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <p className="login-eyebrow">Revision Hub</p>
        <h1>Sign in to continue</h1>
        <p className="login-copy">
          Your revision progress is saved per account so you can pick up where you left off on any device.
        </p>

        {!isFirebaseReady ? (
          <div className="login-warning">
            Add your Firebase credentials to <code>.env</code> and enable Google sign-in in the Firebase console.
          </div>
        ) : null}

        <button
          type="button"
          className="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={!isFirebaseReady || signingIn || loading}
        >
          <span className="google-icon" aria-hidden="true">
            G
          </span>
          {signingIn ? "Signing in…" : "Continue with Google"}
        </button>

        {localError || authError ? (
          <p className="login-error">{localError || authError}</p>
        ) : null}
      </div>
    </div>
  );
}
