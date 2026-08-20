"use client";

import { useEffect, useMemo, useState } from "react";

const STAGE_UPSELL = "100309148";
const STAGE_WON = "13452120";
const WEIGHT = 0.75;
const EXCLUDED_OWNERS = ["Jon Scharfman"];

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function monthKey(iso) {
  if (!iso) return null;
  return iso.slice(0, 7);
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonths(deals) {
  const set = new Set();
  for (const d of deals) {
    const k = monthKey(d.closedate);
    if (k) set.add(k);
  }
  set.add(currentMonthKey());
  return Array.from(set).sort().reverse();
}

function inRange(iso, from, to) {
  const k = monthKey(iso);
  if (!k) return false;
  return k >= from && k <= to;
}

export default function Recap() {
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState(currentMonthKey());
  const [to, setTo] = useState(currentMonthKey());

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "API error");
        setDeals(data.deals);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const months = useMemo(() => (deals ? buildMonths(deals) : []), [deals]);

  // keep from <= to
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  const rows = useMemo(() => {
    if (!deals) return [];
    return deals
      .filter((d) => d.dealstage === STAGE_UPSELL)
      .filter((d) => inRange(d.closedate, lo, hi))
      .filter((d) => !EXCLUDED_OWNERS.includes(d.owner_name))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [deals, lo, hi]);

  const won = useMemo(() => {
    if (!deals) return 0;
    return deals
      .filter((d) => d.dealstage === STAGE_WON)
      .filter((d) => inRange(d.closedate, lo, hi))
      .filter((d) => !EXCLUDED_OWNERS.includes(d.owner_name))
      .reduce((s, d) => s + (d.amount || 0), 0);
  }, [deals, lo, hi]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, d) => ({
        count: acc.count + 1,
        amount: acc.amount + (d.amount || 0),
        weighted: acc.weighted + (d.amount || 0) * WEIGHT,
      }),
      { count: 0, amount: 0, weighted: 0 }
    );
  }, [rows]);

  const selectStyle = { background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "8px 12px", fontSize: 14 };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Recap — Upsell Forecast</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ fontSize: 13, opacity: 0.6 }}>To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      {!deals && !error && <p style={{ opacity: 0.6 }}>Loading…</p>}

      {deals && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            <Stat label="Deals" value={totals.count} def="Number of Upsell Forecast deals with a close date in the selected period." />
            <Stat label="Gross Amount" value={fmtUSD(totals.amount)} def="Sum of the raw deal amount across all Upsell Forecast deals in the period." />
            <Stat label={`Weighted (${WEIGHT * 100}%)`} value={fmtUSD(totals.weighted)} def="Gross Amount multiplied by a fixed 75% probability factor." />
            <Stat label="Closed Won" value={fmtUSD(won)} def="Sum of amounts for deals in Closed Won (Expansion) with a close date in the period." />
          </div>

          {rows.length === 0 ? (
            <p style={{ opacity: 0.6 }}>No deals for {lo === hi ? lo : `${lo} → ${hi}`}.</p>
          ) : (
            <div style={{ border: "1px solid #2c313a", borderRadius: 12, overflow: "hidden", background: "#14171d" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.6, background: "#181c23" }}>
                    <th style={{ padding: "10px 12px" }}>Deal</th>
                    <th style={{ padding: "10px 12px" }}>Deal Owner</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Locations</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Amount</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Weighted</th>
                    <th style={{ padding: "10px 12px" }}>Close date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} style={{ borderTop: "1px solid #232830" }}>
                      <td style={{ padding: "10px 12px" }}>{d.dealname}</td>
                      <td style={{ padding: "10px 12px", opacity: 0.85 }}>{d.owner_name}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{d.locations ?? "—"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtUSD(d.amount)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtUSD((d.amount || 0) * WEIGHT)}</td>
                      <td style={{ padding: "10px 12px" }}>{d.closedate ? d.closedate.slice(0, 10) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
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
