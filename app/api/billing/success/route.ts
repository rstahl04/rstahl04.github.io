import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";
import { retrieveCheckoutSession } from "@/lib/stripe";
import { getStoredUser, upsertStoredUser } from "@/lib/user-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.redirect(new URL("/?signup=missing-session", request.url));
    }

    const checkout = await retrieveCheckoutSession(sessionId);
    const email = (checkout.customer_email || checkout.client_reference_id || checkout.metadata?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.redirect(new URL("/?signup=missing-email", request.url));
    }

    const storedUser = getStoredUser(email);

    if (!storedUser) {
      return NextResponse.redirect(new URL("/?signup=missing-user", request.url));
    }

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const updatedUser = upsertStoredUser({
      ...storedUser,
      access: "active",
      stripeCustomerId: typeof checkout.customer === "string" ? checkout.customer : storedUser.stripeCustomerId,
      stripeSubscriptionId:
        typeof checkout.subscription === "string" ? checkout.subscription : storedUser.stripeSubscriptionId,
      trialEndsAt
    });

    const sessionUser = {
      email: updatedUser.email,
      role: updatedUser.role,
      access: updatedUser.access,
      stripeCustomerId: updatedUser.stripeCustomerId,
      stripeSubscriptionId: updatedUser.stripeSubscriptionId,
      trialEndsAt: updatedUser.trialEndsAt
    };

    return NextResponse.redirect(new URL("/", request.url), {
      headers: { "Set-Cookie": createSessionCookie(sessionUser) }
    });
  } catch {
    return NextResponse.redirect(new URL("/?signup=checkout-error", request.url));
  }
}
