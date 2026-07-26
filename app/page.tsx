import type { Metadata } from "next";
import { AuthGate } from "./auth-widgets";
import { ResearchWorkspace } from "./research-workspace";

export const metadata: Metadata = {
  title: "Research OS · Level Grind",
  description: "Company reports, public evidence, and durable AI-assisted research.",
};

export default function Home() {
  return (
    <AuthGate>
      <ResearchWorkspace />
    </AuthGate>
  );
}
