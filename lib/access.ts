import { createClerkClient } from "@clerk/backend";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type AppUser = {
  id: string;
  email: string;
  name: string;
};

export function invitedEmails() {
  return new Set(
    (process.env.LEVEL_GRIND_INVITED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailInvited(email: string) {
  const invited = invitedEmails();
  return invited.size > 0 && invited.has(email.trim().toLowerCase());
}

function appUrlFromHeaders(requestHeaders: Headers) {
  const host = requestHeaders.get("host") ?? "localhost";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/`;
}

async function requestLike(request?: NextRequest) {
  if (request) {
    return new Request(request.url, { headers: request.headers });
  }

  const requestHeaders = await headers();
  return new Request(appUrlFromHeaders(requestHeaders), {
    headers: requestHeaders,
  });
}

export async function getAppUser(request?: NextRequest): Promise<AppUser | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) return null;

  const clerk = createClerkClient({ secretKey, publishableKey });
  const requestState = await clerk.authenticateRequest(await requestLike(request), {
    secretKey,
    publishableKey,
  });

  if (!requestState.isAuthenticated) return null;

  const authObject = requestState.toAuth();
  if (!authObject.isAuthenticated || !("userId" in authObject) || !authObject.userId) {
    return null;
  }

  const user = await clerk.users.getUser(authObject.userId);
  const email =
    user.primaryEmailAddress?.emailAddress?.toLowerCase() ??
    user.emailAddresses.at(0)?.emailAddress?.toLowerCase();
  if (!email || !isEmailInvited(email)) return null;

  return {
    id: user.id,
    email,
    name: user.fullName || user.firstName || email.split("@")[0] || "User",
  };
}

export async function requireAppUser(request?: NextRequest) {
  const user = await getAppUser(request);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Sign in required or this email has not been invited." },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}
