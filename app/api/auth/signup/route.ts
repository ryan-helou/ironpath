import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { hashPassword, sessionCookie, validateCredentials } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const err = validateCredentials(body.username, body.password);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const store = getStore();
  const username = String(body.username).trim();
  const existing = await store.getUserByUsername(username);
  if (existing) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });

  const user = await store.createUser(username, hashPassword(String(body.password)));
  const res = NextResponse.json({ user: { username: user.username }, state: {} });
  res.cookies.set(sessionCookie(user.id));
  return res;
}
