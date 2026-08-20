"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const STAGE_UPSELL = "100309148";
const STAGE_WON = "13452120";
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

const dayKey = (iso) => (iso ? iso.slice(0, 10) : null);

function firstOfMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastOfMonthKey() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}
function dateBounds(deals) {
  let min = null, max = null;
  for (const d of deals) {
    const k = dayKey(d.closedate);
    if (!k) continue;
    if (!min || k < min) min = k;
    if (!max || k > max) max = k;
  }
  return { min, max };
}
const inRange = (iso, from, to) => {
  const k = dayKey(iso);
  return k ? k >= from && k <= to : false;
};

export default function OwnerView() {
  const params = useParams();
  const owner = decodeURIComponent(params.owner || "");
  const valid = OWNERS.includes(owner);

  const [deals, setDeals] = useState(null);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});
  const [from, setFrom] = useState(firstOfMonthKey());
  const [to, setTo] = useState(lastOfMonthKey());

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

  const bounds = useMemo(() => (deals ? dateBounds(deals) : { min: null, max: null }), [deals]);
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  const myDeals = useMemo(() => {
    if (!deals) return [];
    return deals
      .filter((d) => d.dealstage === STAGE_UPSELL && d.owner_name === owner)
      .filter((d) => inRange(d.closedate, lo, hi))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [deals, owner, lo, hi]);

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

  const wonTotal = useMemo(() => {
    if (!deals) return 0;
    return deals
      .filter((d) => d.dealstage === STAGE_WON && d.owner_name === owner)
      .filter((d) => inRange(d.closedate, lo, hi))
      .reduce((s, d) => s + (d.amount || 0), 0);
  }, [deals, owner, lo, hi]);

  const dateStyle = { background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "8px 12px", fontSize: 14, colorScheme: "dark" };

  if (!valid) {
    return <main style={{ padding: "32px 24px" }}><p style={{ opacity: 0.6 }}>Unknown owner.</p></main>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{owner}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>From</span>
          <input type="date" value={from} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(e) => setFrom(e.target.value)} style={dateStyle} />
          <span style={{ fontSize: 13, opacity: 0.6 }}>To</span>
          <input type="date" value={to} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(e) => setTo(e.target.value)} style={dateStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "16px 0 28px" }}>
        <Stat label="Upsell (Forecast) Deals" value={totals.count} def="Number of Upsell Forecast deals with a close date in the selected period." />
        <Stat label="Upsell (Forecast) Gross Amount" value={fmtUSD(totals.amount)} def="Sum of the raw deal amount across all Upsell Forecast deals in the period." />
        <Stat label={`Upsell (Forecast) Weighted (${WEIGHT * 100}%)`} value={fmtUSD(totals.weighted)} def="Gross Amount multiplied by a fixed 75% win rate — matching the win rate used in Vivian's Revenue Forecast." />
        <Stat label="Closed Won" value={fmtUSD(wonTotal)} def="Sum of amounts for deals in Closed Won (Expansion) with a close date in the period." />
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      {!deals && !error && <p style={{ opacity: 0.6 }}>Loading…</p>}
      {deals && myDeals.length === 0 && <p style={{ opacity: 0.6 }}>No Upsell Forecast deals for {owner} in this period.</p>}

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


function Stat({ label, value, def }) {
  return (
    <div style={{ border: "1px solid #2c313a", borderRadius: 12, padding: "14px 16px", background: "#14171d" }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.45, lineHeight: 1.4 }}>{def}</div>
    </div>
  );
}
