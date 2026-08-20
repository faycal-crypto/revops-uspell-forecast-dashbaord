"use client";

import { useEffect, useMemo, useState } from "react";

const STAGE_UPSELL = "100309148";
const STAGE_WON = "13452120";
const WEIGHT = 0.75;
const HUB_ID = "21233403";
const hsUrl = (id) => `https://app.hubspot.com/contacts/${HUB_ID}/record/0-3/${id}`;
const EXCLUDED_OWNERS = ["Jon Scharfman"];

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const dayKey = (iso) => (iso ? iso.slice(0, 10) : null);

function lastOfMonthKey() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
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
  const [goals, setGoals] = useState([]);
  const [from, setFrom] = useState(firstOfMonthKey());
  const [to, setTo] = useState(lastOfMonthKey());

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "API error");
        setDeals(data.deals);
      })
      .catch((e) => setError(String(e.message || e)));

    fetch("/api/goals")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setGoals(data.goals); })
      .catch(() => {});
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

  const goal = useMemo(() => {
    // Team goals, prorated by day-overlap per month across [lo, hi]
    const teamGoals = {};
    for (const g of goals) {
      if ((g.owner_name || "").toLowerCase() !== "team") continue;
      if (g.month) teamGoals[g.month] = g.goal_amount || 0;
    }
    const start = new Date(lo + "T00:00:00Z");
    const end = new Date(hi + "T00:00:00Z");
    let total = 0;
    for (const [mk, amount] of Object.entries(teamGoals)) {
      const [y, m] = mk.split("-").map(Number);
      if (!y || !m) continue;
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const monthEnd = new Date(Date.UTC(y, m, 0)); // last day of month
      const daysInMonth = monthEnd.getUTCDate();
      const ovStart = monthStart > start ? monthStart : start;
      const ovEnd = monthEnd < end ? monthEnd : end;
      if (ovStart > ovEnd) continue;
      const coveredDays = Math.round((ovEnd - ovStart) / 86400000) + 1;
      total += amount * (coveredDays / daysInMonth);
    }
    return total;
  }, [goals, lo, hi]);

  const gap = goal - wonTotal;
  const attainment = goal > 0 ? wonTotal / goal : null;
  const covGross = gap > 0 ? totals.amount / gap : null;
  const covWeighted = gap > 0 ? totals.weighted / gap : null;

  const attainmentTone = useMemo(() => {
    if (attainment === null) return null;
    const todayStr = new Date().toISOString().slice(0, 10);
    // fraction of the selected period elapsed as of today
    const start = new Date(lo + "T00:00:00Z");
    const end = new Date(hi + "T00:00:00Z");
    const totalDays = Math.round((end - start) / 86400000) + 1;
    let elapsedDays;
    if (todayStr > hi) elapsedDays = totalDays;       // period closed
    else if (todayStr < lo) elapsedDays = 0;          // period not started
    else elapsedDays = Math.round((new Date(todayStr + "T00:00:00Z") - start) / 86400000) + 1;
    const expectedFrac = totalDays > 0 ? elapsedDays / totalDays : 1;
    const expected = goal * expectedFrac;
    const pace = expected > 0 ? wonTotal / expected : (wonTotal > 0 ? Infinity : 0);
    return pace >= 1 ? "green" : pace >= 0.8 ? "yellow" : "red";
  }, [attainment, goal, wonTotal, lo, hi]);

  const covGrossTone = covGross === null ? null : covGross >= 3 ? "green" : covGross >= 1 ? "yellow" : "red";
  const covWeightedTone = covWeighted === null ? null : covWeighted >= 3 ? "green" : covWeighted >= 1 ? "yellow" : "red";

  const expectedLanding = wonTotal + totals.weighted;
  const expectedAttainment = goal > 0 ? expectedLanding / goal : null;
  const expectedTone = expectedAttainment === null ? null : expectedAttainment >= 1 ? "green" : expectedAttainment >= 0.7 ? "yellow" : "red";

  const dateStyle = { background: "#1a1d24", color: "#e6e6e6", border: "1px solid #2c313a", borderRadius: 8, padding: "8px 12px", fontSize: 14, colorScheme: "dark" };

  return (
    <main style={{ maxWidth: 1150, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Master Report — Upsell Forecast</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>From</span>
          <input type="date" value={from} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(e) => setFrom(e.target.value)} style={dateStyle} />
          <span style={{ fontSize: 13, opacity: 0.6 }}>To</span>
          <input type="date" value={to} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(e) => setTo(e.target.value)} style={dateStyle} />
        </div>
      </div>

      <div style={{ border: "1px solid #2c313a", borderRadius: 10, padding: "12px 14px", background: "#14171d", marginBottom: 24, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
        This report forecasts Expansion upsell revenue. It considers only two deal stages: <strong>Upsell (Forecast)</strong> (open pipeline, actively chased by CS with a high estimated likelihood to close at a 75% win rate) and <strong>Closed Won</strong> (secured revenue). All figures are filtered by deal close date over the selected period.
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 32 }}>
            <Stat label="Goal" value={goal > 0 ? fmtUSD(goal) : "—"} def="Team goal, prorated by day across each month in the period." />
            <Stat label="Gap" value={goal > 0 ? fmtUSD(gap) : "—"} def="Goal minus Closed Won — what is left to reach the goal." />
            <Stat label="Goal Attainment" value={attainment !== null ? `${Math.round(attainment * 100)}%` : "—"} def="Closed Won divided by Goal. Color reflects pacing vs. time elapsed (or actual attainment once the period is closed)." tone={attainmentTone} />
            <Stat label="Expected Attainment" value={expectedAttainment !== null ? `${Math.round(expectedAttainment * 100)}%` : "—"} def="(Closed Won + Weighted) divided by Goal — projected landing if open pipeline converts at the 75% win rate." tone={expectedTone} />
            <Stat label="Coverage (Gross)" value={covGross !== null ? `${covGross.toFixed(2)}×` : "—"} def="Gross Amount divided by Gap. Shown only while a positive gap remains." tone={covGrossTone} />
            <Stat label="Coverage (Weighted)" value={covWeighted !== null ? `${covWeighted.toFixed(2)}×` : "—"} def="Weighted divided by Gap. Shown only while a positive gap remains." tone={covWeightedTone} />
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
                <th style={{ padding: "8px 12px", textAlign: "left" }}>HubSpot</th>
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
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    <a href={hsUrl(d.id)} target="_blank" rel="noopener noreferrer" style={{ color: "#6ea8fe" }}>{d.id} ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const TONES = {
  green: { bg: "#132a1d", border: "#2f7d54", text: "#5fd694" },
  yellow: { bg: "#2b2712", border: "#8a7a2f", text: "#e2c94e" },
  red: { bg: "#2c1618", border: "#8a3a3f", text: "#f0757c" },
};

function Stat({ label, value, def, tone }) {
  const t = tone && TONES[tone];
  return (
    <div style={{ border: `1px solid ${t ? t.border : "#2c313a"}`, borderRadius: 12, padding: 16, background: t ? t.bg : "#14171d", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 12, opacity: 0.6, minHeight: 32, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, margin: "8px 0 10px", color: t ? t.text : "#e6e6e6" }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.45, lineHeight: 1.45, marginTop: "auto" }}>{def}</div>
    </div>
  );
}
