import React, { useState } from "react";
import { User, CalendarDays, ArrowRight, Loader } from "lucide-react";

export default function ProfileSetup({ username, onSave }) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [dob,       setDob]       = useState("");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSave() {
    if (!firstName.trim()) { setError("First name is required."); return; }
    setBusy(true);
    setError("");
    try {
      await onSave({ firstName: firstName.trim(), lastName: lastName.trim(), dob: dob || null });
    } catch (err) {
      setError(err.message || "Could not save profile. Please try again.");
      setBusy(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter") handleSave();
  }

  return (
    <div className="login-screen">

      {/* Hero */}
      <div className="login-hero">
        <div className="login-hero-inner">
          <div className="login-logo-wrap">
            <User size={34} strokeWidth={2.5} />
          </div>
          <div className="login-app-name">Welcome!</div>
          <div className="login-greeting">
            Let's set up your profile, {username}.
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="login-card">

        <p className="profile-setup-intro">
          Just a few details to get started — you can update them anytime.
        </p>

        <div className="login-form">

          <fieldset className="notched-field">
            <legend className="notched-label">First name *</legend>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              disabled={busy}
              placeholder="Your first name"
            />
          </fieldset>

          <fieldset className="notched-field">
            <legend className="notched-label">Last name</legend>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onKeyDown={handleKey}
              disabled={busy}
              placeholder="Your last name"
            />
          </fieldset>

          <fieldset className="notched-field">
            <legend className="notched-label">Date of birth</legend>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                id="setup-dob"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                disabled={busy}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", padding: "2px 0 4px" }}
              />
              <button
                type="button"
                aria-label="Open date picker"
                onClick={() => { const el = document.getElementById("setup-dob"); el?.showPicker?.() ?? el?.focus(); }}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af", padding: 4, display: "flex" }}
              >
                <CalendarDays size={18} />
              </button>
            </div>
          </fieldset>

          {error && (
            <div className="login-error" style={{ marginTop: 0 }}>
              <span>{error}</span>
            </div>
          )}

          <button className="login-btn" onClick={handleSave} disabled={busy}>
            {busy ? <span className="login-spinner" /> : <ArrowRight size={18} />}
            <span>{busy ? "Saving…" : "Get Started"}</span>
          </button>

        </div>
      </div>
    </div>
  );
}
