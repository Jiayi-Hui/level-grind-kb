import { currentUser } from "@clerk/nextjs/server";
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
  return invited.size === 0 || invited.has(email.trim().toLowerCase());
}

export async function getAppUser(): Promise<AppUser | null> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!user || !email || !isEmailInvited(email)) return null;

  return {
    id: user.id,
    email,
    name: user.fullName || user.firstName || email.split("@")[0] || "User",
  };
}

export async function requireAppUser() {
  const user = await getAppUser();
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
