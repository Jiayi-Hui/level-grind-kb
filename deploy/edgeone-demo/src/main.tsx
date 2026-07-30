import React, { useState } from "react";
import { useAuth } from "@clerk/react";
import { createRoot } from "react-dom/client";
import { AICapex } from "../../../app/ai-capex";
import { AppClerkProvider, AuthGate } from "../../../app/auth-widgets";
import { EventResearch } from "../../../app/event-research";
import "../../../app/globals.css";
import "./mirror.css";

type DemoView = "events" | "aidc" | "settings";

const viewCopy = {
  events: {
    eyebrow: "CLAIM LEDGER",
    title: "事件库",
  },
  aidc: {
    eyebrow: "AI INFRASTRUCTURE",
    title: "AI Capex",
  },
  settings: {
    eyebrow: "WORKSPACE CONTROL",
    title: "设置",
  },
} satisfies Record<DemoView, {
  eyebrow: string;
  title: string;
}>;

// Clerk publishable keys are designed for browser bundles. Authentication
// secrets and authorization decisions remain outside this static deployment.
const clerkPublishableKey =
  "pk_test_YWR2YW5jZWQtc3RvcmstNy5jbGVyay5hY2NvdW50cy5kZXYk";

function ContinuityApp() {
  const [view, setView] = useState<DemoView>("events");
  const [mobileNav, setMobileNav] = useState(false);
  const heading = viewCopy[view];

  const selectView = (nextView: DemoView) => {
    setView(nextView);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="app-shell research-os continuity-app">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Level Grind</span>
        </div>
        <p className="workspace-label">RESEARCH OS</p>
        <nav aria-label="Workspace navigation">
          <button className="nav-item" disabled title="将在腾讯云完整迁移阶段恢复">
            <span className="nav-symbol">⌂</span>
            <span>个人知识库</span>
            <small>迁移中</small>
          </button>
          <button className="nav-item" disabled title="将在腾讯云完整迁移阶段恢复">
            <span className="nav-symbol">▤</span>
            <span>报告库</span>
            <small>迁移中</small>
          </button>
          <button
            className={`nav-item ${view === "events" ? "active" : ""}`}
            onClick={() => selectView("events")}
          >
            <span className="nav-symbol">◇</span>
            <span>事件库</span>
          </button>
          <button
            className={`nav-item ${view === "aidc" ? "active" : ""}`}
            onClick={() => selectView("aidc")}
          >
            <span className="nav-symbol">▥</span>
            <span>AI Capex</span>
          </button>
          <button className="nav-item" disabled title="将在腾讯云完整迁移阶段恢复">
            <span className="nav-symbol">▦</span>
            <span>模型工作台</span>
            <small>迁移中</small>
          </button>
          <button className="nav-item" disabled title="将在腾讯云完整迁移阶段恢复">
            <span className="nav-symbol">✦</span>
            <span>AskAI</span>
            <small>迁移中</small>
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => selectView("settings")}
          >
            <span className="nav-symbol">⚙</span>
            <span>设置</span>
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="打开导航"
            onClick={() => setMobileNav((current) => !current)}
          >
            ☰
          </button>
          <div className="continuity-search">
            <span>⌕</span>
            <span>Level Grind research continuity workspace</span>
          </div>
          <span className="continuity-live"><i /> 腾讯节点在线</span>
        </header>

        <div className="content">
          <header className="page-heading">
            <div>
              <p className="eyebrow">{heading.eyebrow}</p>
              <h1>{heading.title}</h1>
            </div>
          </header>

          {view === "events" ? (
            <EventResearch
              liveClaims={[]}
              onAsk={() => undefined}
            />
          ) : view === "aidc" ? (
            <AICapex language="zh" />
          ) : (
            <InviteSettings />
          )}
        </div>
      </section>
    </main>
  );
}

function InviteSettings() {
  const { getToken } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Analyst");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setStatus("");
    try {
      const token = await getToken();
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, role }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "邀请发送失败");
      setStatus(`邀请已发送至 ${email}`);
      setEmail("");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "邀请发送失败");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="settings-workspace">
      <div className="settings-grid">
        <article className="settings-card">
          <p className="eyebrow">TEAM ACCESS</p>
          <h2>邀请团队成员</h2>
          <form onSubmit={invite}>
            <label><span>公司邮箱</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@dymonasia.com" /></label>
            <label><span>角色</span><select value={role} onChange={(event) => setRole(event.target.value)}><option>Analyst</option><option>PM</option><option>GEM PM</option></select></label>
            <button type="submit" disabled={sending}>{sending ? "发送中…" : "发送邀请"}</button>
          </form>
          {status && <p className="settings-status">{status}</p>}
        </article>
        <article className="settings-card">
          <p className="eyebrow">RESEARCH PROFILE</p>
          <h2>研究偏好</h2>
          <dl><div><dt>研究范围</dt><dd>团队事件、公司、行业与 AI 基础设施</dd></div><div><dt>默认语言</dt><dd>中文</dd></div><div><dt>访问方式</dt><dd>受邀请的 Clerk 账户</dd></div></dl>
        </article>
      </div>
    </section>
  );
}

const app = <ContinuityApp />;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppClerkProvider publishableKey={clerkPublishableKey}>
      {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
        ? app
        : <AuthGate>{app}</AuthGate>}
    </AppClerkProvider>
  </React.StrictMode>,
);
