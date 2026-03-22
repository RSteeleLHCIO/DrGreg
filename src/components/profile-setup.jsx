import React, { useState } from "react";
import { User, CalendarDays, ArrowRight } from "lucide-react";

export default function ProfileSetup({ username, onSave }) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [dob,       setDob]       = useState("");
  const [heightFt,  setHeightFt]  = useState("");
  const [heightIn,  setHeightIn]  = useState("");
  const [sex,       setSex]       = useState("");
  const [zipCode,   setZipCode]   = useState("");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSave() {
    if (!firstName.trim()) { setError("First name is required."); return; }
    setBusy(true);
    setError("");
    const ft = parseInt(heightFt, 10) || 0;
    const inches = parseInt(heightIn, 10) || 0;
    const heightInches = (ft || inches) ? ft * 12 + inches : null;
    try {
      await onSave({
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        dob:          dob || null,
        heightInches: heightInches,
        sex:          sex || null,
        zipCode:      zipCode.trim() || null,
      });
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

          <fieldset className="notched-field">
            <legend className="notched-label">Height</legend>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number" min="1" max="8"
                value={heightFt}
                onChange={e => setHeightFt(e.target.value)}
                disabled={busy}
                placeholder="ft"
                style={{ width: 48, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", padding: "2px 0 4px" }}
              />
              <span style={{ color: "#9ca3af", fontSize: 14 }}>ft</span>
              <input
                type="number" min="0" max="11"
                value={heightIn}
                onChange={e => setHeightIn(e.target.value)}
                disabled={busy}
                placeholder="in"
                style={{ width: 48, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", padding: "2px 0 4px" }}
              />
              <span style={{ color: "#9ca3af", fontSize: 14 }}>in</span>
            </div>
          </fieldset>

          <fieldset className="notched-field">
            <legend className="notched-label">Sex</legend>
            <select
              value={sex}
              onChange={e => setSex(e.target.value)}
              disabled={busy}
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", padding: "2px 0 4px", color: sex ? "inherit" : "#9ca3af" }}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Used to compare your results with similar demographics.</p>
          </fieldset>

          <fieldset className="notched-field">
            <legend className="notched-label">Home zip code</legend>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              autoComplete="postal-code"
              value={zipCode}
              onChange={e => setZipCode(e.target.value)}
              onKeyDown={handleKey}
              disabled={busy}
              placeholder="e.g. 90210"
            />
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
