# PRD — Context Infra V2

## Objective

Upgrade Level Grind from a research inbox into the first usable context-infrastructure layer for a fundamental research team.

## Users

- Analyst: owns personal context and contributes approved team context.
- PM: reviews shared topic lines, provenance, historical context, and task outputs.
- Agent operator: prepares minimum-sufficient context for research or model-update tasks.

## Scope

- Personal context profile: coverage, preferences, method, and private working memory.
- Team context: topics, provenance, confidence, event dates, and approved shared material.
- Task context packs: objective, allowed scope, output format, and guardrails.
- Context-aware capture and search.
- Honest boundary view for Obsidian, company AVD, Excel, and Quant research.
- Record-level personal/team visibility enforcement for lists and file downloads.

## Non-Goals

- Direct Bloomberg, Wind, WeChat, Teams, or AlphaPai ingestion.
- AVD, Claude Code, or Excel execution.
- Multi-agent orchestration, OCR, embeddings, or a production knowledge graph.
- Two-way Obsidian sync.
- Quant backtesting or portfolio construction.
- Multi-user administration in the owner-only preview.

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

## Acceptance Criteria

- AC-1: Existing documents still load after the schema extension.
- AC-2: New context-aware material persists after refresh.
- AC-3: Personal profiles and task contexts persist.
- AC-4: Personal/team visibility is enforced server-side.
- AC-5: The production build, lint, typecheck, and focused tests pass.

## Risks

- Team access still requires production membership and role administration.
- Topic strings are an MVP; canonical entities and relationships require a later ontology.
- No connector is implied by its boundary card.
