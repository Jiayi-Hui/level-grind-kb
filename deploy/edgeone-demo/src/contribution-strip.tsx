import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

type Summary = {
  isManager: boolean;
  mine: { notes: number; ideas: number; uploadedFiles: number; linkedIdeas: number; pendingIdeas: number; trackedIdeas: number };
  manager?: { pendingReview: number; contributors: number; restrictedRecords: number };
};

export function ContributionStrip() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch("/api/research-contributions", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as Summary;
        if (active) setSummary(payload);
      } catch { /* The library remains usable when the summary is unavailable. */ }
    })();
    return () => { active = false; };
  }, [getToken]);
  if (!summary) return null;
  return <section className="contribution-strip" aria-label="我的研究贡献">
    <div><strong>我的贡献</strong><span>Notes {summary.mine.notes}</span><span>Ideas {summary.mine.ideas}</span><span>附件 {summary.mine.uploadedFiles}</span><span>关联 Idea {summary.mine.linkedIdeas}</span><span>进入跟踪 {summary.mine.trackedIdeas}</span></div>
    {summary.manager && <div className="manager-review-strip"><strong>PM Review</strong><span>待审核 {summary.manager.pendingReview}</span><span>贡献者 {summary.manager.contributors}</span><span>受限记录 {summary.manager.restrictedRecords}</span></div>}
  </section>;
}
