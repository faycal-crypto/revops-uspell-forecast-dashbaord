"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const STAGE_UPSELL = "100309148";
const WEIGHT = 0.75;
const OWNERS = [
  "Michael Calacino",
  "Cole Maher",
  "Declan Lavan",
  "Jennifer Smith",
  "Lindsey Rogien",
  "Celine Delle Donne",
];

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function OwnerView() {
  const params = useParams();
  const owner = decodeURIComponent(params.owner || "");
  const valid = OWNERS.includes(owner);

  const [deals, setDeals] = useState(null);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});

  const loadNotes = () => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setNotes(data.notes); })
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "API error");
        setDeals(data.deals);
      })
      .catch((e) => setError(String(e.message || e)));
    loadNotes();
  }, []);

  const myDeals = useMemo(() => {
    if (!deals) return [];
    return deals
      .filter((d) => d.dealstage === STAGE_UPSELL && d.owner_name === owner)
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [deals, owner]);

  const latestNote = useMemo(() => {
    const map = {};
    for (const n of notes) {
      const prev = map[n.deal_id];
      if (!prev || (n.timestamp || "") > (prev.timestamp || "")) map[n.deal_id] = n;
    }
    return map;
  }, [notes]);

  const save = async (deal) => {
    const text = (drafts[deal.id] || "").trim();
    if (!text) return;
    setSaving((s) => ({ ...s, [deal.id]: true }));
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: deal.id, deal_name: deal.dealname, cs_name: owner, note: text }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setDrafts((d) => ({ ...d, [deal.id]: "" }));
      setTimeout(loadNotes, 800);
    } catch (e) {
      alert("Error: " + (e.message || e));
    } finally {
      setSaving((s) => ({ ...s, [deal.id]: false }));
    }
  };

  const totals = useMemo(() => {
    return myDeals.reduce(
      (acc, d) => ({ count: acc.count + 1, amount: acc.amount + (d.amount || 0), weighted: acc.weighted + (d.amount || 0) * WEIGHT }),
      { count: 0, amount: 0, weighted: 0 }
    );
  }, [myDeals]);

  if (!valid) {
    return <main style={{ padding: "32px 24px" }}><p style={{ opacity: 0.6 }}>Unknown owner.</p></main>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{owner}</h1>
      <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 20 }}>
        {totals.count} deals · Gross {fmtUSD(totals.amount)} · Weighted {fmtUSD(totals.weighted)}
      </p>

      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      {!deals && !error && <p style={{ opacity: 0.6 }}>Loading…</p>}
      {deals && myDeals.length === 0 && <p style={{ opacity: 0.6 }}>No Upsell Forecast deals for {owner}.</p>}

      {myDeals.map((d) => {
        const cur = latestNote[d.id];
        return (
          <div key={d.id} style={{ border: "1px solid #2c313a", borderRadius: 12, padding: 16, marginBottom: 16, background: "#14171d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
              <strong style={{ fontSize: 14 }}>{d.dealname}</strong>
              <span style={{ fontSize: 13, opacity: 0.7, whiteSpace: "nowrap" }}>
                {fmtUSD(d.amount)} · W {fmtUSD((d.amount || 0) * WEIGHT)} · {d.locations ?? "—"} loc
              </span>
            </div>

            {cur && (
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10, padding: "8px 10px", background: "#181c23", borderRadius: 8 }}>
                <div style={{ opacity: 0.5, marginBottom: 2 }}>Current note · {cur.cs_name} · {cur.timestamp ? cur.timestamp.slice(0, 16).replace("T", " ") : ""}</div>
                {cur.note}
              </div>
            )}

            <textarea
              value={drafts[d.id] || ""}
              onChange={(e) => setDrafts((s) => ({ ...s, [d.id]: e.target.value }))}
              placeholder="Add a review note…"
              rows={2}
              style={{ width: "100%", boxSizing: "border-box", background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical" }}
            />
            <div style={{ marginTop: 8, textAlign: "right" }}>
              <button
                onClick={() => save(d)}
                disabled={saving[d.id] || !(drafts[d.id] || "").trim()}
                style={{ background: "#2d6cdf", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", opacity: saving[d.id] || !(drafts[d.id] || "").trim() ? 0.5 : 1 }}
              >
                {saving[d.id] ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        );
      })}
    </main>
  );
}
