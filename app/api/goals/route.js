import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CODA = "https://coda.io/apis/v1";
const DOC = "3vHRxIEnIw";
const GOALS_TABLE = "grid-giQc6Qubf1";

async function codaGet(path) {
  const res = await fetch(`${CODA}${path}`, {
    headers: { Authorization: `Bearer ${process.env.CODA_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coda ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function GET() {
  try {
    const goals = [];
    let pageToken = undefined;
    do {
      const qs = new URLSearchParams({ limit: "200", useColumnNames: "true", ...(pageToken ? { pageToken } : {}) });
      const data = await codaGet(`/docs/${DOC}/tables/${GOALS_TABLE}/rows?${qs.toString()}`);
      for (const row of data.items || []) {
        const v = row.values || {};
        // month may be a full date like "2026-07-01T00:00:00.000-07:00".
        // Normalize to "YYYY-MM" using the calendar year/month of the string
        // (ignore timezone shifting by reading the leading YYYY-MM directly).
        let month = String(v.month || "");
        const match = month.match(/^(\d{4})-(\d{2})/);
        if (match) month = `${match[1]}-${match[2]}`;
        goals.push({
          owner_name: v.owner_name || "",
          month,
          goal_amount: Number(v.goal_amount) || 0,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return NextResponse.json({ ok: true, goals });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
