"use client";

import { useEffect, useMemo, useState } from "react";
import DateRange from "../components/DateRange";

const STAGE_WON = "13452120";
const EXCLUDED_OWNERS = ["Jon Scharfman", "Breanne Foofat"];

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const dayKey = (iso) => (iso ? iso.slice(0, 10) : null);
const monthKey = (iso) => (iso ? iso.slice(0, 7) : null);

function jan2026() { return "2026-01-01"; }
function endOfPrevMonth() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth(), 0); // day 0 of current month = last day prev month
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

// list of YYYY-MM between two YYYY-MM-DD bounds inclusive
function monthsBetween(lo, hi) {
  const out = [];
  let [y, m] = lo.slice(0, 7).split("-").map(Number);
  const [hy, hm] = hi.slice(0, 7).split("-").map(Number);
  while (y < hy || (y === hy && m <= hm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const MONTH_LABEL = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

export default function Actuals() {
  const [deals, setDeals] = useState(null);
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState(jan2026());
  const [to, setTo] = useState(endOfPrevMonth());

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

  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  const teamGoalByMonth = useMemo(() => {
    const map = {};
    for (const g of goals) {
      if ((g.owner_name || "").toLowerCase() !== "team") continue;
      if (g.month) map[g.month] = g.goal_amount || 0;
    }
    return map;
  }, [goals]);

  const wonByMonth = useMemo(() => {
    const map = {};
    if (!deals) return map;
    for (const d of deals) {
      if (d.dealstage !== STAGE_WON) continue;
      if (EXCLUDED_OWNERS.includes(d.owner_name)) continue;
      const mk = monthKey(d.closedate);
      if (!mk) continue;
      map[mk] = (map[mk] || 0) + (d.amount || 0);
    }
    return map;
  }, [deals]);

  const rows = useMemo(() => {
    const months = monthsBetween(lo, hi);
    return months.map((mk) => {
      const actual = wonByMonth[mk] || 0;
      const forecast = teamGoalByMonth[mk] || 0;
      const varAbs = actual - forecast;
      const varPct = forecast > 0 ? varAbs / forecast : null;
      return { month: mk, actual, forecast, varAbs, varPct };
    });
  }, [lo, hi, wonByMonth, teamGoalByMonth]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({ actual: acc.actual + r.actual, forecast: acc.forecast + r.forecast }),
      { actual: 0, forecast: 0 }
    );
  }, [rows]);
  const totalVarAbs = totals.actual - totals.forecast;
  const totalVarPct = totals.forecast > 0 ? totalVarAbs / totals.forecast : null;

  const varColor = (v) => (v >= 0 ? "#5fd694" : "#f0757c");

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Master Report (Actuals)</h1>
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      <div style={{ border: "1px solid #2c313a", borderRadius: 10, padding: "12px 14px", background: "#14171d", marginBottom: 24, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
        Monthly <strong>Closed Won</strong> actuals vs. the Team forecast (goal) for each month. Variance is actual minus forecast — positive (green) means above target, negative (red) means below.
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      {!deals && !error && <p style={{ opacity: 0.6 }}>Loading…</p>}

      {deals && (
        <div style={{ border: "1px solid #2c313a", borderRadius: 12, overflow: "hidden", background: "#14171d" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ opacity: 0.6, background: "#181c23", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Month</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Closed Won (Actual)</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Forecast (Goal)</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Variance $</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Variance %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} style={{ borderTop: "1px solid #232830" }}>
                  <td style={{ padding: "10px 12px" }}>{MONTH_LABEL(r.month)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtUSD(r.actual)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{r.forecast > 0 ? fmtUSD(r.forecast) : "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: r.forecast > 0 ? varColor(r.varAbs) : "#e6e6e6" }}>
                    {r.forecast > 0 ? `${r.varAbs >= 0 ? "+" : "−"}${fmtUSD(Math.abs(r.varAbs)).replace("$", "$")}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: r.varPct !== null ? varColor(r.varPct) : "#e6e6e6" }}>
                    {r.varPct !== null ? `${r.varPct >= 0 ? "+" : "−"}${Math.abs(Math.round(r.varPct * 100))}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #2c313a", background: "#181c23", fontWeight: 600 }}>
                <td style={{ padding: "10px 12px" }}>Total</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtUSD(totals.actual)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{totals.forecast > 0 ? fmtUSD(totals.forecast) : "—"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: totals.forecast > 0 ? varColor(totalVarAbs) : "#e6e6e6" }}>
                  {totals.forecast > 0 ? `${totalVarAbs >= 0 ? "+" : "−"}${fmtUSD(Math.abs(totalVarAbs))}` : "—"}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: totalVarPct !== null ? varColor(totalVarPct) : "#e6e6e6" }}>
                  {totalVarPct !== null ? `${totalVarPct >= 0 ? "+" : "−"}${Math.abs(Math.round(totalVarPct * 100))}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
