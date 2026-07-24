import type { Metadata } from "next";
import { AuthGate } from "./auth-widgets";
import { Workspace } from "./workspace";

export const metadata: Metadata = {
  title: "Context Infra · Level Grind",
  description: "Personal, team and task context for research.",
};

export default function Home() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  );
}
