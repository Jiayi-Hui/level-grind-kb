import type { Metadata } from "next";
import { Workspace } from "./workspace";

export const metadata: Metadata = {
  title: "Context Infra · Level Grind",
  description: "Personal, team and task context for research.",
};

export default function Home() {
  return <Workspace />;
}
