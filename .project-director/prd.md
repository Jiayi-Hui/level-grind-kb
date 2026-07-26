# PRD — Multi-user Alpha

## Objective

Add conversation routing so a user can keep chats attached to a clear project, active goal, and deliverable, then carry a concise handoff into a new chat or project.

## Users

- Analyst: owns personal context and contributes approved team context.
- PM: reviews shared topic lines, provenance, historical context, and task outputs.
- Agent operator: prepares minimum-sufficient context for research or model-update tasks.
- Multi-device user: continues Context Infra work across work and personal computers through a shared GitHub repository.

## Scope

- Personal context profile: coverage, preferences, method, and private working memory.
- Team context: topics, provenance, confidence, event dates, and approved shared material.
- Task context packs: objective, allowed scope, output format, and guardrails.
- Context-aware capture and search.
- Honest boundary view for Obsidian, company AVD, Excel, and Quant research.
- Record-level personal/team visibility enforcement for lists and file downloads.
- Personal conversation-routing rules.
- Durable workstream handoffs with project, chat, goal, deliverable, shift reason, recommended route, and summary.
- Persistent team membership with owner, admin, member, active, and suspended states.
- Owner/admin member administration inside Team context.
- An honest distinction between manual routing and future automatic topic-shift detection.

## Non-Goals

- Direct Bloomberg, Wind, WeChat, Teams, or AlphaPai ingestion.
- AVD, Claude Code, or Excel execution.
- Multi-agent orchestration, OCR, embeddings, or a production knowledge graph.
- Two-way Obsidian sync.
- Quant backtesting or portfolio construction.
- Organization provisioning, SCIM, SSO, and multi-team tenancy.
- Reading Codex, Claude, WeChat, or Teams chat history without an explicit connector.
- Automatically creating external chats or projects.
- Storing raw chat transcripts in D1.
- Treating GitHub as the storage layer for live D1 or R2 data.

## Assumptions

- Raw data remains in its legally appropriate source system.
- Level Grind owns context, provenance, permissions, task state, and approved results.
- Connectors and specialized compute will integrate later through explicit boundaries.

## Requirements

- FR-1: Every captured item records context scope, source system, topic, event date, and confidence.
- FR-2: A user can persist personal context independently of shared documents.
- FR-3: Team context aggregates topic lines and provenance from authorized records.
- FR-4: A user can persist a reusable task-context specification.
- FR-5: Private records are visible and downloadable only by their owner.
- FR-6: The interface explains what Level Grind owns and what remains external.
- FR-7: A user can persist a private reminder rule for conversation scope changes.
- FR-8: A user can save a workstream handoff and choose continue, new chat, or new project.
- FR-9: The interface clearly states that automatic drift detection requires a connector.
- FR-10: A configured owner can bootstrap safely after verified Clerk sign-in.
- FR-11: Owners and admins can add or update members; ordinary members cannot.
- FR-12: Suspended or unknown accounts cannot access application data.

## Acceptance Criteria

- AC-1: Existing documents still load after the schema extension.
- AC-2: New context-aware material persists after refresh.
- AC-3: Personal profiles and task contexts persist.
- AC-4: Personal/team visibility is enforced server-side.
- AC-5: The production build, lint, typecheck, and focused tests pass.
- AC-6: Routing preferences and handoffs survive refresh and are owner-scoped.
- AC-7: The Clerk bearer-token boundary protects the routing API.
- AC-8: Membership and roles persist in D1 and gate every protected API.
- AC-9: The owner role cannot be overwritten through the member API.

## Risks

- Team access still requires production membership and role administration.
- Topic strings are an MVP; canonical entities and relationships require a later ontology.
- No connector is implied by its boundary card.
- GitHub synchronization must stop on conflicts, secret-like files, or failed checks.
