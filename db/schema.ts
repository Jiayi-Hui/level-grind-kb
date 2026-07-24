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
