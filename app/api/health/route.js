import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    env: {
      hubspot_token: Boolean(process.env.HUBSPOT_TOKEN),
      access_code: Boolean(process.env.ACCESS_CODE),
      coda_token: Boolean(process.env.CODA_TOKEN),
    },
  });
}
