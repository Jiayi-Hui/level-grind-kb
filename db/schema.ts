import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull().default(""),
    sourceUrl: text("source_url"),
    authorEmail: text("author_email").notNull(),
    authorName: text("author_name").notNull(),
    project: text("project").notNull().default("General"),
    importance: text("importance").notNull().default("normal"),
    visibility: text("visibility").notNull().default("team"),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileType: text("file_type"),
    fileSize: integer("file_size"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("documents_created_idx").on(table.createdAt)]
);

export const documentContext = sqliteTable(
  "document_context",
  {
    documentId: text("document_id")
      .primaryKey()
      .references(() => documents.id, { onDelete: "cascade" }),
    contextScope: text("context_scope").notNull().default("team"),
    sourceSystem: text("source_system").notNull().default("manual"),
    topics: text("topics").notNull().default(""),
    eventDate: text("event_date"),
    confidence: text("confidence").notNull().default("medium"),
  },
  (table) => [
    index("document_context_scope_idx").on(table.contextScope),
    index("document_context_source_idx").on(table.sourceSystem),
  ]
);

export const personalContexts = sqliteTable("personal_contexts", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  coverage: text("coverage").notNull().default(""),
  outputPreferences: text("output_preferences").notNull().default(""),
  workingMethod: text("working_method").notNull().default(""),
  privateMemory: text("private_memory").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const taskContexts = sqliteTable(
  "task_contexts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    topic: text("topic").notNull().default("General"),
    status: text("status").notNull().default("ready"),
    ownerEmail: text("owner_email").notNull(),
    contextScope: text("context_scope").notNull().default("personal+team"),
    outputFormat: text("output_format").notNull().default("Concise brief with sources"),
    guardrails: text("guardrails").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("task_context_owner_idx").on(table.ownerEmail),
    index("task_context_status_idx").on(table.status),
  ]
);

// Legacy tables remain declared only to avoid a destructive production
// migration. They have no route or user-facing product surface.
export const routingPolicies = sqliteTable("routing_policies", {
  email: text("email").primaryKey(),
  reminderEnabled: integer("reminder_enabled", { mode: "boolean" }).notNull().default(true),
  triggerRules: text("trigger_rules").notNull().default(
    "Remind me when the goal, deliverable, repository, data boundary, permissions, or long-term workstream changes."
  ),
  updatedAt: text("updated_at").notNull(),
});

export const conversationWorkstreams = sqliteTable(
  "conversation_workstreams",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    projectName: text("project_name").notNull(),
    chatTitle: text("chat_title").notNull(),
    activeGoal: text("active_goal").notNull(),
    deliverable: text("deliverable").notNull().default(""),
    shiftReason: text("shift_reason").notNull().default(""),
    recommendedAction: text("recommended_action").notNull().default("new-chat"),
    handoffSummary: text("handoff_summary").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("conversation_workstream_owner_idx").on(table.ownerEmail),
    index("conversation_workstream_status_idx").on(table.status),
    index("conversation_workstream_updated_idx").on(table.updatedAt),
  ]
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    email: text("email").primaryKey(),
    displayName: text("display_name").notNull().default(""),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    invitedBy: text("invited_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("team_members_status_idx").on(table.status),
    index("team_members_role_idx").on(table.role),
  ],
);

export const corpusDocuments = sqliteTable(
  "corpus_documents",
  {
    id: text("id").primaryKey(),
    securityCode: text("security_code").notNull(),
    companyName: text("company_name").notNull(),
    title: text("title").notNull(),
    documentType: text("document_type").notNull(),
    publishedAt: text("published_at").notNull(),
    sourceUrl: text("source_url").notNull(),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    pageCount: integer("page_count").notNull().default(0),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("corpus_documents_company_idx").on(table.securityCode),
    index("corpus_documents_published_idx").on(table.publishedAt),
    uniqueIndex("corpus_documents_source_idx").on(table.sourceUrl),
  ],
);

export const corpusChunks = sqliteTable(
  "corpus_chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => corpusDocuments.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    content: text("content").notNull(),
  },
  (table) => [
    index("corpus_chunks_document_idx").on(table.documentId),
    index("corpus_chunks_page_idx").on(table.documentId, table.pageNumber),
  ],
);

export const aiUsageEvents = sqliteTable(
  "ai_usage_events",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: text("estimated_cost_usd").notNull().default("0"),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("ai_usage_user_idx").on(table.userEmail),
    index("ai_usage_created_idx").on(table.createdAt),
  ],
);

export const userPreferences = sqliteTable("user_preferences", {
  email: text("email").primaryKey(),
  language: text("language").notNull().default("en"),
  storageQuotaBytes: integer("storage_quota_bytes").notNull().default(5_368_709_120),
  updatedAt: text("updated_at").notNull(),
});

export const researchQueries = sqliteTable(
  "research_queries",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    evidenceMode: text("evidence_mode").notNull().default("reports"),
    citationsJson: text("citations_json").notNull().default("[]"),
    webResultsJson: text("web_results_json").notNull().default("[]"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: text("estimated_cost_usd").notNull().default("0"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("research_queries_user_created_idx").on(table.userEmail, table.createdAt),
  ],
);

export const researchProjects = sqliteTable(
  "research_projects",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("research_projects_user_updated_idx").on(table.userEmail, table.updatedAt),
  ],
);

export const researchChats = sqliteTable(
  "research_chats",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    evidenceMode: text("evidence_mode").notNull().default("hybrid"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("research_chats_project_updated_idx").on(table.userEmail, table.projectId, table.updatedAt),
  ],
);

export const researchMessages = sqliteTable(
  "research_messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull(),
    userEmail: text("user_email").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citationsJson: text("citations_json").notNull().default("[]"),
    webResultsJson: text("web_results_json").notNull().default("[]"),
    provider: text("provider"),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: text("estimated_cost_usd").notNull().default("0"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("research_messages_chat_created_idx").on(table.chatId, table.createdAt),
  ],
);
