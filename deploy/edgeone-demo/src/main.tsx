import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AICapex } from "../../../app/ai-capex";
import { EventResearch } from "../../../app/event-research";
import "../../../app/globals.css";
import "./mirror.css";

type DemoView = "events" | "aidc";

const viewCopy = {
  events: {
    eyebrow: "EVENT MEMORY",
    title: "事件库",
    description: "跨事件比较历史价格反应、行业传导、证据来源与投资启示。",
  },
  aidc: {
    eyebrow: "AI INFRASTRUCTURE",
    title: "AI Capex",
    description: "追踪 AI 数据中心建设、未来容量与实物 Capex 动能。",
  },
} satisfies Record<DemoView, {
  eyebrow: string;
  title: string;
  description: string;
}>;

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
        </nav>
        <div className="continuity-note">
          <span>TENCENT EDGEONE</span>
          <strong>香港免 VPN 连续性版本</strong>
          <small>核心研究数据已随站点托管，不再回源 chatgpt.site。</small>
        </div>
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
              <p>{heading.description}</p>
            </div>
          </header>

          {view === "events" ? (
            <EventResearch
              liveClaims={[]}
              onAsk={() => undefined}
            />
          ) : (
            <AICapex language="zh" />
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContinuityApp />
  </React.StrictMode>,
);
