import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CODA = "https://coda.io/apis/v1";
const DOC = "3vHRxIEnIw";
const NOTES_TABLE = "grid-JjDjRIrEDp";

const COL = {
  deal_id: "c-4f19i_s40N",
  deal_name: "c-U5otNiOmtB",
  cs_name: "c-5ZJwb0fdA8",
  note: "c-bLtR-rkbPg",
  timestamp: "c-PDjNvuHXk9",
};

async function coda(path, options = {}) {
  const res = await fetch(`${CODA}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.CODA_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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
    const notes = [];
    let pageToken = undefined;
    do {
      const qs = new URLSearchParams({ limit: "200", useColumnNames: "true", ...(pageToken ? { pageToken } : {}) });
      const data = await coda(`/docs/${DOC}/tables/${NOTES_TABLE}/rows?${qs.toString()}`);
      for (const row of data.items || []) {
        const v = row.values || {};
        notes.push({
          deal_id: String(v.deal_id || ""),
          deal_name: v.deal_name || "",
          cs_name: v.cs_name || "",
          note: v.note || "",
          timestamp: v.timestamp || "",
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return NextResponse.json({ ok: true, notes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { deal_id, deal_name, cs_name, note } = body || {};
    if (!deal_id || !cs_name || !note) {
      return NextResponse.json({ ok: false, error: "deal_id, cs_name and note are required" }, { status: 400 });
    }

    const payload = {
      rows: [
        {
          cells: [
            { column: COL.deal_id, value: String(deal_id) },
            { column: COL.deal_name, value: deal_name || "" },
            { column: COL.cs_name, value: cs_name },
            { column: COL.note, value: note },
            { column: COL.timestamp, value: new Date().toISOString() },
          ],
        },
      ],
    };

    await coda(`/docs/${DOC}/tables/${NOTES_TABLE}/rows`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
