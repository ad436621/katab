import { pgTable, text, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const languageEnum = pgEnum("language", ["arabic", "english"]);
export const statusEnum = pgEnum("status", ["draft", "sent", "read", "replied"]);

export const lettersTable = pgTable("letters", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  body: text("body").notNull(),
  recipientName: text("recipient_name").notNull(),
  uniqueToken: text("unique_token").notNull().unique(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  language: languageEnum("language").notNull().default("arabic"),
  status: statusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const questionsTable = pgTable("questions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  letterId: text("letter_id").notNull().references(() => lettersTable.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  answerText: text("answer_text").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const repliesTable = pgTable("replies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  letterId: text("letter_id").notNull().references(() => lettersTable.id, { onDelete: "cascade" }),
  replyBody: text("reply_body").notNull(),
  replyFrom: text("reply_from").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminSessionsTable = pgTable("admin_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLetterSchema = createInsertSchema(lettersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true });
export const insertReplySchema = createInsertSchema(repliesTable).omit({ id: true, createdAt: true });
export const insertAdminSessionSchema = createInsertSchema(adminSessionsTable).omit({ id: true, createdAt: true });

export type Letter = typeof lettersTable.$inferSelect;
export type InsertLetter = z.infer<typeof insertLetterSchema>;
export type Question = typeof questionsTable.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Reply = typeof repliesTable.$inferSelect;
export type InsertReply = z.infer<typeof insertReplySchema>;
export type AdminSession = typeof adminSessionsTable.$inferSelect;
