import type { Metadata } from "next";
import { Workspace } from "./workspace";

export const metadata: Metadata = {
  title: "Workspace · Level Grind",
  description: "Capture once. Find it everywhere.",
};

export default function Home() {
  return <Workspace />;
}
