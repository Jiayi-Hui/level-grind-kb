import type { Metadata } from "next";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { isEmailInvited } from "../lib/access";
import { Workspace } from "./workspace";

export const metadata: Metadata = {
  title: "Context Infra · Level Grind",
  description: "Personal, team and task context for research.",
};

export default async function Home() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

  if (!user || !email) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">PRIVATE ALPHA</p>
          <h1>Level Grind Context Infra</h1>
          <p>
            Sign in to your invited account before opening the research context
            workspace.
          </p>
          <SignInButton mode="modal">
            <button className="upload-button">Sign in</button>
          </SignInButton>
        </section>
      </main>
    );
  }

  if (!isEmailInvited(email)) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-row">
            <p className="eyebrow">ACCESS PENDING</p>
            <UserButton />
          </div>
          <h1>This account is not invited yet.</h1>
          <p>
            You are signed in as {email}. Ask the owner to add this email to
            LEVEL_GRIND_INVITED_EMAILS.
          </p>
        </section>
      </main>
    );
  }

  return <Workspace />;
}
