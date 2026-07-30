import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { createRoot } from "react-dom/client";
import { AgenticResearchPanel, PersonalKnowledgeView } from "../../../app/agentic-research";
import { AICapex } from "../../../app/ai-capex";
import { AppClerkProvider, AuthGate } from "../../../app/auth-widgets";
import { EventResearch } from "../../../app/event-research";
import "../../../app/globals.css";
import "./mirror.css";

type DemoView = "knowledge" | "events" | "aidc" | "ask" | "settings";
type AskScope = "events" | "aidc";

const viewCopy = {
  knowledge: {
    eyebrow: "PERSONAL KNOWLEDGE",
    title: "个人知识库",
  },
  events: {
    eyebrow: "CLAIM LEDGER",
    title: "事件库",
  },
  aidc: {
    eyebrow: "AI INFRASTRUCTURE",
    title: "AI Capex",
  },
  ask: {
    eyebrow: "AGENTIC RESEARCH",
    title: "AskAI",
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
// EdgeOne can override this at build time, while the production key keeps
// manual-upload builds attached to level-grind.com instead of Clerk dev mode.
const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  || "pk_live_Y2xlcmsubGV2ZWwtZ3JpbmQuY29tJA";

function ContinuityApp() {
  const [view, setView] = useState<DemoView>("events");
  const [askScope, setAskScope] = useState<AskScope>("events");
  const [mobileNav, setMobileNav] = useState(false);
  const heading = viewCopy[view];

  const selectView = (nextView: DemoView) => {
    setView(nextView);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openAsk = (scope: AskScope) => {
    setAskScope(scope);
    selectView("ask");
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
          <button
            className={`nav-item ${view === "knowledge" ? "active" : ""}`}
            onClick={() => selectView("knowledge")}
          >
            <span className="nav-symbol">⌂</span>
            <span>个人知识库</span>
          </button>
          <button className="nav-item" disabled title="待上线">
            <span className="nav-symbol">▤</span>
            <span>报告库</span>
            <small>待上线</small>
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
          <button className="nav-item" disabled title="待上线">
            <span className="nav-symbol">▦</span>
            <span>模型工作台</span>
            <small>待上线</small>
          </button>
          <button
            className={`nav-item ${view === "ask" ? "active" : ""}`}
            onClick={() => selectView("ask")}
          >
            <span className="nav-symbol">✦</span>
            <span>AskAI</span>
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
              <h1>{view === "ask" ? `${heading.title} · ${askScope === "events" ? "事件库" : "AI Capex"}` : heading.title}</h1>
            </div>
            {(view === "events" || view === "aidc") && (
              <button className="page-ask-button" onClick={() => openAsk(view)}>
                ✦ 询问此数据库
              </button>
            )}
            {view === "ask" && (
              <button className="page-ask-button secondary" onClick={() => selectView(askScope)}>
                ← 返回{askScope === "events" ? "事件库" : "AI Capex"}
              </button>
            )}
          </header>

          {view === "knowledge" ? (
            <PersonalKnowledgeView />
          ) : view === "events" ? (
            <EventResearch
              liveClaims={[]}
              onAsk={() => openAsk("events")}
            />
          ) : view === "aidc" ? (
            <AICapex language="zh" />
          ) : view === "ask" ? (
            <AgenticResearchPanel scope={askScope} />
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
  const [members, setMembers] = useState<Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: "active" | "pending" | "revoked";
  }>>([]);
  const [memberStatus, setMemberStatus] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setMemberStatus("");
    try {
      const token = await getToken();
      const response = await fetch("/api/invitations", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("成员服务仅在已部署环境可用");
      }
      const payload = await response.json() as {
        members?: Array<{ id: string; email: string; name: string; role: string; status: "active" | "pending" | "revoked" }>;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "无法读取成员");
      setMembers(payload.members || []);
    } catch (caught) {
      setMemberStatus(caught instanceof Error ? caught.message : "无法读取成员");
    } finally {
      setLoadingMembers(false);
    }
  }, [getToken]);

  useEffect(() => {
    const task = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(task);
  }, [loadMembers]);

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
      await loadMembers();
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
      <article className="settings-card member-management-card">
        <header>
          <div><p className="eyebrow">MEMBER MANAGEMENT</p><h2>成员管理</h2></div>
          <button className="quiet-button" onClick={() => void loadMembers()} disabled={loadingMembers}>{loadingMembers ? "刷新中…" : "刷新"}</button>
        </header>
        {memberStatus && <p className="settings-status">{memberStatus}</p>}
        <div className="settings-member-list">
          {!loadingMembers && members.length === 0 && !memberStatus && <p>还没有成员或待处理邀请。</p>}
          {members.map((member) => (
            <div key={member.id} className="settings-member-row">
              <span className="avatar">{(member.name || member.email).slice(0, 2).toUpperCase()}</span>
              <div><strong>{member.name || member.email.split("@")[0]}</strong><small>{member.email}</small></div>
              <span>{member.role}</span>
              <span className={`member-state ${member.status}`}>{member.status === "active" ? "已加入" : member.status === "pending" ? "待接受" : "已撤销"}</span>
            </div>
          ))}
        </div>
      </article>
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
