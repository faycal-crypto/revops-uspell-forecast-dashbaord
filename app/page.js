"use client";

import { useEffect, useMemo, useState } from "react";

const STAGE_UPSELL = "100309148";
const STAGE_WON = "13452120";
const WEIGHT = 0.75;

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

export default function Recap() {
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(currentMonthKey());

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Erreur API");
        setDeals(data.deals);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const months = useMemo(() => (deals ? buildMonths(deals) : []), [deals]);

  const groups = useMemo(() => {
    if (!deals) return [];
    const byOwner = {};
    for (const d of deals) {
      if (monthKey(d.closedate) !== month) continue;
      const key = d.owner_name || "(unknown)";
      if (!byOwner[key]) {
        byOwner[key] = { owner: key, count: 0, amount: 0, weighted: 0, won: 0, deals: [] };
      }
      const g = byOwner[key];
      if (d.dealstage === STAGE_UPSELL) {
        g.count += 1;
        g.amount += d.amount || 0;
        g.weighted += (d.amount || 0) * WEIGHT;
        g.deals.push(d);
      } else if (d.dealstage === STAGE_WON) {
        g.won += d.amount || 0;
      }
    }
    return Object.values(byOwner)
      .filter((g) => g.count > 0 || g.won > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [deals, month]);

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => ({
        count: acc.count + g.count,
        amount: acc.amount + g.amount,
        weighted: acc.weighted + g.weighted,
        won: acc.won + g.won,
      }),
      { count: 0, amount: 0, weighted: 0, won: 0 }
    );
  }, [groups]);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Récap — Upsell Forecast</h1>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "8px 12px", fontSize: 14 }}
        >
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>Erreur : {error}</p>}
      {!deals && !error && <p style={{ opacity: 0.6 }}>Chargement…</p>}

      {deals && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            <Stat label="Deals" value={totals.count} />
            <Stat label="Amount brut" value={fmtUSD(totals.amount)} />
            <Stat label={`Weighted (${WEIGHT * 100}%)`} value={fmtUSD(totals.weighted)} />
            <Stat label="Closed Won (mois)" value={fmtUSD(totals.won)} />
          </div>

          {groups.length === 0 && <p style={{ opacity: 0.6 }}>Aucun deal pour {month}.</p>}

          {groups.map((g) => (
            <div key={g.owner} style={{ border: "1px solid #2c313a", borderRadius: 12, padding: 16, marginBottom: 16, background: "#14171d" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>{g.owner}</h2>
                <div style={{ display: "flex", gap: 18, fontSize: 13, opacity: 0.85 }}>
                  <span>{g.count} deals</span>
                  <span>Brut {fmtUSD(g.amount)}</span>
                  <span>Weighted {fmtUSD(g.weighted)}</span>
                  <span>Won {fmtUSD(g.won)}</span>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.6 }}>
                    <th style={{ padding: "6px 8px" }}>Deal</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Locations</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Amount</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Weighted</th>
                    <th style={{ padding: "6px 8px" }}>Close date</th>
                  </tr>
                </thead>
                <tbody>
                  {g.deals.map((d) => (
                    <tr key={d.id} style={{ borderTop: "1px solid #232830" }}>
                      <td style={{ padding: "6px 8px" }}>{d.dealname}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.locations ?? "—"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtUSD(d.amount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtUSD((d.amount || 0) * WEIGHT)}</td>
                      <td style={{ padding: "6px 8px" }}>{d.closedate ? d.closedate.slice(0, 10) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ border: "1px solid #2c313a", borderRadius: 12, padding: "14px 16px", background: "#14171d" }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
