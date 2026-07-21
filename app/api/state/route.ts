import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = getUserIdFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = getStore();
  const data = await store.getData(uid);
  return NextResponse.json({ state: data ?? {} });
}

export async function PUT(req: NextRequest) {
  const uid = getUserIdFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const store = getStore();
  await store.setData(uid, {
    profile: body.profile ?? null,
    plan: body.plan ?? null,
    updatedAtISO: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
