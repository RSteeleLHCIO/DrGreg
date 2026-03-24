import React, { useState, useMemo } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, UserPlus, ArrowRight, AlertCircle } from "lucide-react";

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function getGreeting() {
  const hour = new Date().getHours();
  const day  = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const timeBased =
    hour < 5  ? "Burning the midnight oil? 🌙" :
    hour < 12 ? "Good Morning!" :
    hour < 17 ? "Good Afternoon!" :
                "Good Evening!";

  const pool = [
    timeBased,
    timeBased, // weighted — time greeting appears ~2× more often
    `Happy ${day}!`,
    "Every check-in is a win.",
    "Ready to check in?",
    "Your health journey continues.",
    "Let's see how you're doing!",
    "Share the journey.",
    "Connect your health.",
    "Small steps, big wins.",
    "Looking after yourself — love it.",
    "Great to see you!",
  ];

  return pool[Math.floor(Math.random() * pool.length)];
}

export default function LoginScreen({ onAuth }) {
  const greeting = useMemo(() => getGreeting(), []);
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [busy, setBusy]       = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function switchMode(m) {
    setMode(m);
    setErrorMsg("");
  }

  async function handleLogin() {
    const name = username.trim();
    if (!name) { setErrorMsg("Please enter your username."); return; }
    setBusy(true);
    setErrorMsg("");
    try {
      const beginRes = await fetch(`${API}/auth/login/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      if (!beginRes.ok) {
        const err = await beginRes.json().catch(() => ({}));
        throw new Error(err.error || "Login failed. Is that username registered?");
      }
      const { options } = await beginRes.json();

      const credential = await startAuthentication({ optionsJSON: options });

      const finishRes = await fetch(`${API}/auth/login/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, response: credential }),
      });
      if (!finishRes.ok) {
        const err = await finishRes.json().catch(() => ({}));
        throw new Error(err.error || "Authentication failed.");
      }
      const { token } = await finishRes.json();
      onAuth(token, name);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setErrorMsg("Passkey prompt was dismissed. Please try again.");
      } else {
        setErrorMsg(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    const name = username.trim();
    if (!name) { setErrorMsg("Please choose a username."); return; }
    setBusy(true);
    setErrorMsg("");
    try {
      const beginRes = await fetch(`${API}/auth/register/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      if (!beginRes.ok) {
        const err = await beginRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not start registration.");
      }
      const { options, userId } = await beginRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const finishRes = await fetch(`${API}/auth/register/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, response: credential }),
      });
      if (!finishRes.ok) {
        const err = await finishRes.json().catch(() => ({}));
        throw new Error(err.error || "Registration failed.");
      }
      const { token } = await finishRes.json();
      onAuth(token, name);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setErrorMsg("Passkey creation was dismissed. Please try again.");
      } else if (err.name === "InvalidStateError") {
        setErrorMsg("A passkey already exists on this device. Try signing in instead.");
      } else {
        setErrorMsg(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter") mode === "login" ? handleLogin() : handleRegister();
  }

  return (
    <div className="login-screen">

      {/* ── Hero ── */}
      <div className="login-hero">
        <div className="login-hero-inner">
          <img
            src="/tobbi-logo.png"
            alt="Tobbi"
            className="login-logo-img"
          />
          <div className="login-greeting">{greeting}</div>
        </div>
      </div>

      {/* ── Card ── */}
      <div className="login-card">

        {/* Mode tabs */}
        <div className="login-mode-tabs">
          <button
            className={`login-mode-tab${mode === "login" ? " active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Sign In
          </button>
          <button
            className={`login-mode-tab${mode === "register" ? " active" : ""}`}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        <div className="login-form">

          {/* Username notched field */}
          <fieldset className="notched-field">
            <legend className="notched-label">Username</legend>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="username webauthn"
              autoFocus
              disabled={busy}
              placeholder={mode === "register" ? "Choose a username" : "Enter your username"}
            />
          </fieldset>

          {/* Error message */}
          {errorMsg && (
            <div className="login-error">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action button */}
          <button
            className="login-btn"
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={busy}
          >
            {busy ? (
              <span className="login-spinner" />
            ) : mode === "login" ? (
              <KeyRound size={18} />
            ) : (
              <UserPlus size={18} />
            )}
            <span>
              {busy
                ? mode === "login" ? "Waiting for passkey…" : "Setting up passkey…"
                : mode === "login" ? "Sign in with Passkey" : "Create Passkey"}
            </span>
            {!busy && <ArrowRight size={16} className="login-btn-arrow" />}
          </button>

          {/* Hint */}
          <p className="login-hint">
            {mode === "login"
              ? "Your device will verify your identity — no password required."
              : "Your device (Face ID, fingerprint, or PIN) will create a secure key just for you."}
          </p>

        </div>
      </div>
    </div>
  );
}
