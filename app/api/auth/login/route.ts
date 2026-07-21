import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { sessionCookie, verifyPassword } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  const store = getStore();
  const user = await store.getUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  const res = NextResponse.json({ user: { username: user.username }, state: user.data ?? {} });
  res.cookies.set(sessionCookie(user.id));
  return res;
}
