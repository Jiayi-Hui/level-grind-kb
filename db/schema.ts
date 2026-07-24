import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
