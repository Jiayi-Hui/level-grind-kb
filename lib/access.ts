import { createClerkClient } from "@clerk/backend";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runtimeEnv } from "./runtime-env";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
};

const membersSchema = `
  CREATE TABLE IF NOT EXISTS team_members (
    email TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    invited_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export function invitedEmails() {
  return new Set(
    (runtimeEnv("LEVEL_GRIND_INVITED_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function memberManagerEmails() {
  const configuredManagers = runtimeEnv("LEVEL_GRIND_MEMBER_MANAGER_EMAILS") ?? "";
  const ownerEmail = runtimeEnv("LEVEL_GRIND_OWNER_EMAIL") ?? "";
  return new Set(
    `${ownerEmail},${configuredManagers}`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isMemberManager(email: string) {
  return memberManagerEmails().has(email.trim().toLowerCase());
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
  const secretKey = runtimeEnv("CLERK_SECRET_KEY");
  const publishableKey = runtimeEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
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
  if (!email) return null;

  await env.DB.prepare(membersSchema).run();
  const normalizedOwner = (runtimeEnv("LEVEL_GRIND_OWNER_EMAIL") ?? "").trim().toLowerCase();
  const isBootstrapOwner = Boolean(normalizedOwner) && email === normalizedOwner;
  const isConfiguredManager = isMemberManager(email);
  const isLegacyInvite = isEmailInvited(email);
  let member = await env.DB.prepare(
    "SELECT role, status FROM team_members WHERE email = ?1"
  ).bind(email).first<{ role: string; status: string }>();

  if (!member && (isBootstrapOwner || isLegacyInvite)) {
    const now = new Date().toISOString();
    const role = isBootstrapOwner ? "owner" : "member";
    await env.DB.prepare(
      `INSERT INTO team_members (email, display_name, role, status, invited_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'active', ?1, ?4, ?4)`
    ).bind(email, user.fullName || user.firstName || "", role, now).run();
    member = { role, status: "active" };
  }

  if (!member || member.status !== "active") return null;
  const role = isBootstrapOwner
    ? "owner"
    : isConfiguredManager || member.role === "admin"
      ? "admin"
      : "member";

  return {
    id: user.id,
    email,
    name: user.fullName || user.firstName || email.split("@")[0] || "User",
    role,
  };
}

export async function requireAppUser(request?: NextRequest) {
  const user = await getAppUser(request);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Sign in required or this account is not an active team member." },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}
