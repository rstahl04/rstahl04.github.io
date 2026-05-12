import { NextResponse } from "next/server";
import { createSessionCookie, findUser, hasAppAccess, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = findUser(email);

  if (!user || !verifyPassword(user, password)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const sessionUser = { email: user.email, role: user.role, access: user.access };

  if (!hasAppAccess(sessionUser)) {
    return NextResponse.json(
      { error: "Your account does not currently have access." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { ok: true, user: sessionUser },
    { headers: { "Set-Cookie": createSessionCookie(sessionUser) } }
  );
}
