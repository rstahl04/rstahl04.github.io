import { NextResponse } from "next/server";
import { findUser, hasAppAccess } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ exists: false, hasAccess: false });
  }

  const user = findUser(email);
  const sessionUser = user ? { email: user.email, role: user.role, access: user.access } : null;

  return NextResponse.json({
    exists: Boolean(user),
    hasAccess: sessionUser ? hasAppAccess(sessionUser) : false
  });
}
