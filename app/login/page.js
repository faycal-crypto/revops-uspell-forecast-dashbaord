"use client";

import { useState } from "react";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error === "Invalid code" ? "Wrong access code." : (data.error || "Error"));
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch (e) {
      setError(String(e.message || e));
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 320, border: "1px solid #2c313a", borderRadius: 12, padding: 24, background: "#14171d" }}>
        <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>CS Upsell Forecast</h1>
        <p style={{ fontSize: 13, opacity: 0.5, margin: "0 0 18px" }}>Enter the access code to continue.</p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Access code"
          style={{ width: "100%", boxSizing: "border-box", background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 12 }}
        />
        {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <button
          onClick={submit}
          disabled={loading || !code.trim()}
          style={{ width: "100%", background: "#2d6cdf", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer", opacity: loading || !code.trim() ? 0.5 : 1 }}
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </div>
    </main>
  );
}
