"use client";

import { useEffect, useMemo, useState } from "react";

const STAGE_UPSELL = "100309148";
const STAGE_WON = "13452120";
const WEIGHT = 0.75;
const EXCLUDED_OWNERS = ["Jon Scharfman"];

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const dayKey = (iso) => (iso ? iso.slice(0, 10) : null);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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

export default function Recap() {
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState(firstOfMonthKey());
  const [to, setTo] = useState(todayKey());

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "API error");
        setDeals(data.deals);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const bounds = useMemo(() => (deals ? dateBounds(deals) : { min: null, max: null }), [deals]);
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  const upsell = useMemo(() => {
    if (!deals) return [];
    return deals
      .filter((d) => d.dealstage === STAGE_UPSELL)
      .filter((d) => inRange(d.closedate, lo, hi))
      .filter((d) => !EXCLUDED_OWNERS.includes(d.owner_name));
  }, [deals, lo, hi]);

  const wonDeals = useMemo(() => {
    if (!deals) return [];
    return deals
      .filter((d) => d.dealstage === STAGE_WON)
      .filter((d) => inRange(d.closedate, lo, hi))
      .filter((d) => !EXCLUDED_OWNERS.includes(d.owner_name));
  }, [deals, lo, hi]);

  const totals = useMemo(() => {
    return upsell.reduce(
      (acc, d) => ({
        count: acc.count + 1,
        amount: acc.amount + (d.amount || 0),
        weighted: acc.weighted + (d.amount || 0) * WEIGHT,
      }),
      { count: 0, amount: 0, weighted: 0 }
    );
  }, [upsell]);

  const wonTotal = useMemo(() => wonDeals.reduce((s, d) => s + (d.amount || 0), 0), [wonDeals]);

  const dateStyle = { background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "8px 12px", fontSize: 14, colorScheme: "dark" };

  return (
    <main style={{ maxWidth: 1150, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Recap — Upsell Forecast</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>From</span>
          <input type="date" value={from} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(e) => setFrom(e.target.value)} style={dateStyle} />
          <span style={{ fontSize: 13, opacity: 0.6 }}>To</span>
          <input type="date" value={to} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(e) => setTo(e.target.value)} style={dateStyle} />
        </div>
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      {!deals && !error && <p style={{ opacity: 0.6 }}>Loading…</p>}

      {deals && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
            <Stat label="Upsell (Forecast) Deals" value={totals.count} def="Number of Upsell Forecast deals with a close date in the selected period." />
            <Stat label="Upsell (Forecast) Gross Amount" value={fmtUSD(totals.amount)} def="Sum of the raw deal amount across all Upsell Forecast deals in the period." />
            <Stat label={`Upsell (Forecast) Weighted (${WEIGHT * 100}%)`} value={fmtUSD(totals.weighted)} def="Gross Amount multiplied by a fixed 75% win rate — matching the win rate used in Vivian's Revenue Forecast." />
            <Stat label="Closed Won" value={fmtUSD(wonTotal)} def="Sum of amounts for deals in Closed Won (Expansion) with a close date in the period." />
          </div>

          <DealTable title="Upsell Forecast Deals" deals={upsell} showWeighted />
          <DealTable title="Closed Won Deals" deals={wonDeals} />
        </>
      )}
    </main>
  );
}

function DealTable({ title, deals, showWeighted }) {
  const [owner, setOwner] = useState("All");
  const [sortKey, setSortKey] = useState("amount");
  const [sortDir, setSortDir] = useState("desc");

  const owners = useMemo(() => {
    const s = new Set(deals.map((d) => d.owner_name || "(unknown)"));
    return ["All", ...Array.from(s).sort()];
  }, [deals]);

  const rows = useMemo(() => {
    let r = deals.slice();
    if (owner !== "All") r = r.filter((d) => (d.owner_name || "(unknown)") === owner);
    const val = (d) => {
      switch (sortKey) {
        case "dealname": return (d.dealname || "").toLowerCase();
        case "owner_name": return (d.owner_name || "").toLowerCase();
        case "locations": return d.locations ?? -1;
        case "amount": return d.amount || 0;
        case "weighted": return (d.amount || 0) * WEIGHT;
        case "closedate": return d.closedate || "";
        default: return 0;
      }
    };
    r.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return r;
  }, [deals, owner, sortKey, sortDir]);

  const onSort = (key) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "dealname" || key === "owner_name" ? "asc" : "desc"); }
  };

  const th = (label, key, right) => {
    const active = key === sortKey;
    return (
      <th style={{ padding: "8px 12px", textAlign: right ? "right" : "left", whiteSpace: "nowrap" }}>
        <button
          onClick={() => onSort(key)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: active ? "#2a303b" : "#20242c",
            color: active ? "#fff" : "#c7ccd4",
            border: "1px solid #333a45", borderRadius: 6,
            padding: "4px 8px", fontSize: 12, cursor: "pointer",
            fontWeight: active ? 600 : 400,
          }}
        >
          {label}
          <span style={{ opacity: active ? 1 : 0.4, fontSize: 10 }}>
            {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>{title} <span style={{ opacity: 0.5, fontWeight: 400 }}>({rows.length})</span></h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>Owner</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <p style={{ fontSize: 12, opacity: 0.4, margin: "0 0 8px" }}>Click a column button to sort ▲▼</p>

      {rows.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No deals.</p>
      ) : (
        <div style={{ border: "1px solid #2c313a", borderRadius: 12, overflow: "hidden", background: "#14171d" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#181c23" }}>
                {th("Deal", "dealname")}
                {th("Deal Owner", "owner_name")}
                {th("Locations", "locations", true)}
                {th("Amount", "amount", true)}
                {showWeighted && th("Weighted", "weighted", true)}
                {th("Close date", "closedate")}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid #232830" }}>
                  <td style={{ padding: "10px 12px" }}>{d.dealname}</td>
                  <td style={{ padding: "10px 12px", opacity: 0.85 }}>{d.owner_name}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{d.locations ?? "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtUSD(d.amount)}</td>
                  {showWeighted && <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtUSD((d.amount || 0) * WEIGHT)}</td>}
                  <td style={{ padding: "10px 12px" }}>{d.closedate ? d.closedate.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
