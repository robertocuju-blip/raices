// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const familyTrees = sqliteTable("family_trees", {
  owner: text("owner").primaryKey(), content: text("content").notNull(),
  revision: integer("revision").notNull(), updatedAt: text("updated_at").notNull(),
});
