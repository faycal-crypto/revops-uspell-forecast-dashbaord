import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { code } = await req.json();
    const expected = process.env.ACCESS_CODE || "";
    if (!expected) {
      return NextResponse.json({ ok: false, error: "ACCESS_CODE not configured" }, { status: 500 });
    }
    if (code !== expected) {
      return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("cs_auth", expected, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
