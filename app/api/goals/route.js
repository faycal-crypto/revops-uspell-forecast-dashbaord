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
        goals.push({
          owner_name: v.owner_name || "",
          month: v.month || "",
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
