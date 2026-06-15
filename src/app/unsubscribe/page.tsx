"use client";

import { useEffect, useState } from "react";

type State = "checking" | "invalid" | "ready" | "done" | "already" | "error";

export default function UnsubscribePage() {
  const [state, setState] = useState<State>("checking");
  const [email, setEmail] = useState("");
  const [params, setParams] = useState<{ e: string; t: string }>({ e: "", t: "" });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const e = sp.get("e") || "";
    const t = sp.get("t") || "";
    setParams({ e, t });
    fetch(`/api/email/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.valid) return setState("invalid");
        setEmail(d.email || e);
        setState(d.suppressed ? "already" : "ready");
      })
      .catch(() => setState("error"));
  }, []);

  const confirm = async () => {
    setState("checking");
    try {
      const r = await fetch(
        `/api/email/unsubscribe?e=${encodeURIComponent(params.e)}&t=${encodeURIComponent(params.t)}`,
        { method: "POST" },
      );
      const d = await r.json();
      setState(d.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 32, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#f97316", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 20, marginBottom: 20 }}>🔐 LockSafe UK</div>

        {state === "checking" && <p style={{ color: "#475569" }}>One moment…</p>}

        {state === "invalid" && (
          <>
            <h1 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>Link not valid</h1>
            <p style={{ color: "#475569", fontSize: 14 }}>This unsubscribe link is invalid or has expired. If you keep receiving emails, reply to one of them and we’ll remove you.</p>
          </>
        )}

        {state === "ready" && (
          <>
            <h1 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>Unsubscribe from LockSafe emails?</h1>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 24 }}>{email ? <><b>{email}</b> will</> : "You will"} no longer receive outreach emails from us.</p>
            <button onClick={confirm} style={{ background: "#0f172a", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, cursor: "pointer" }}>Unsubscribe me</button>
          </>
        )}

        {state === "already" && (
          <>
            <h1 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>You’re already unsubscribed</h1>
            <p style={{ color: "#475569", fontSize: 14 }}>{email ? <b>{email}</b> : "This address"} won’t receive any more outreach emails from us.</p>
          </>
        )}

        {state === "done" && (
          <>
            <h1 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>You’ve been unsubscribed ✅</h1>
            <p style={{ color: "#475569", fontSize: 14 }}>{email ? <b>{email}</b> : "This address"} has been removed from our outreach list. Sorry for the interruption.</p>
          </>
        )}

        {state === "error" && (
          <>
            <h1 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "#475569", fontSize: 14 }}>Please try again, or reply to any of our emails and we’ll remove you manually.</p>
          </>
        )}
      </div>
    </div>
  );
}
