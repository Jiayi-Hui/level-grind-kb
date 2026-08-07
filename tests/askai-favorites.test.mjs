import assert from "node:assert/strict";
import test from "node:test";
import { emptyFavorites, normalizeFavorites, personalKnowledgeEntries, removeFavorite, upsertFavorite } from "../public/cloud-functions/api/_askai-favorites.js";

const answer = {
  id: "askai-answer:chat-1:message-1", sourceChatId: "chat-1", sourceMessageId: "message-1",
  title: "中国算力", body: "**已验证的回答**", scope: "events", projectTitle: "事件", chatTitle: "算力", sourceCount: 2,
  createdAt: "2026-08-05T00:00:00.000Z",
};

test("AskAI favourites normalize legacy records and keep answer/chat snapshots distinct", () => {
  const favorites = normalizeFavorites({ answers: [answer, { id: "bad" }], chats: [{ ...answer, id: "askai-chat:chat-1", sourceMessageId: undefined }] });
  assert.equal(favorites.answers.length, 1);
  assert.equal(favorites.chats.length, 1);
  assert.equal(favorites.chats[0].kind, "chat");
  assert.equal(personalKnowledgeEntries(favorites).length, 2);
});

test("AskAI favourites upsert and removal preserve the other favourite kind", () => {
  const withAnswer = upsertFavorite(emptyFavorites(), "answer", answer, "2026-08-05T01:00:00.000Z");
  const withChat = upsertFavorite(withAnswer, "chat", { ...answer, id: "askai-chat:chat-1", sourceMessageId: undefined }, "2026-08-05T02:00:00.000Z");
  const afterRemoval = removeFavorite(withChat, "answer", answer.id);
  assert.equal(afterRemoval.answers.length, 0);
  assert.equal(afterRemoval.chats.length, 1);
  assert.equal(afterRemoval.chats[0].sourceChatId, "chat-1");
});
