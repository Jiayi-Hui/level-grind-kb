import type { Metadata } from "next";
import { getAppUser } from "../lib/access";
import { AccountButton, SignInAction } from "./auth-widgets";
import { Workspace } from "./workspace";

export const metadata: Metadata = {
  title: "Context Infra · Level Grind",
  description: "Personal, team and task context for research.",
};

export default async function Home() {
  const user = await getAppUser();

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">PRIVATE ALPHA</p>
          <h1>Level Grind Context Infra</h1>
          <p>
            Sign in to your invited account before opening the research context
            workspace.
          </p>
          <SignInAction />
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="session-corner">
        <AccountButton />
      </div>
      <Workspace />
    </>
  );
}
