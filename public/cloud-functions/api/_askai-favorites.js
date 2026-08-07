// Pure, provider-independent helpers for AskAI favourites.  They deliberately
// contain no auth or storage calls so the history route remains the only place
// that decides which Clerk subject can read or mutate a record.

const asText = (value, max) => String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
const asIso = (value, fallback) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
};

function sourceCount(value) {
  return Array.isArray(value) ? value.slice(0, 30).filter((item) => item && typeof item === "object").length : 0;
}

export function emptyFavorites() {
  return { answers: [], chats: [] };
}

export function normalizeFavorites(value, now = new Date().toISOString()) {
  const raw = value && typeof value === "object" ? value : {};
  const normalize = (entry, kind) => {
    const id = asText(entry?.id, 220);
    const sourceChatId = asText(entry?.sourceChatId, 160);
    const sourceMessageId = kind === "answer" ? asText(entry?.sourceMessageId, 160) : "";
    if (!id || !sourceChatId || (kind === "answer" && !sourceMessageId)) return null;
    return {
      id,
      kind,
      title: asText(entry?.title, 180) || (kind === "answer" ? "已收藏回答" : "已收藏 Chat"),
      body: asText(entry?.body, kind === "answer" ? 100_000 : 400_000),
      scope: entry?.scope === "aidc" ? "aidc" : "events",
      projectTitle: asText(entry?.projectTitle, 180) || "未命名研究项目",
      chatTitle: asText(entry?.chatTitle, 180) || "新研究对话",
      sourceCount: sourceCount(entry?.sources) || Math.max(0, Math.min(300, Number(entry?.sourceCount) || 0)),
      sourceChatId,
      ...(sourceMessageId ? { sourceMessageId } : {}),
      createdAt: asIso(entry?.createdAt, now),
      updatedAt: asIso(entry?.updatedAt || entry?.createdAt, now),
    };
  };
  const unique = (entries) => [...new Map(entries.filter(Boolean).map((entry) => [entry.id, entry])).values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 240);
  return {
    answers: unique((Array.isArray(raw.answers) ? raw.answers : []).map((entry) => normalize(entry, "answer"))),
    chats: unique((Array.isArray(raw.chats) ? raw.chats : []).map((entry) => normalize(entry, "chat"))),
  };
}

export function upsertFavorite(favorites, kind, candidate, now = new Date().toISOString()) {
  const normalized = normalizeFavorites(favorites, now);
  const entry = normalizeFavorites({ [kind === "answer" ? "answers" : "chats"]: [{ ...candidate, updatedAt: now, createdAt: candidate?.createdAt || now }] }, now)[kind === "answer" ? "answers" : "chats"][0];
  if (!entry) throw new Error("HISTORY_INVALID_FAVORITE");
  const field = kind === "answer" ? "answers" : "chats";
  return { ...normalized, [field]: [entry, ...normalized[field].filter((item) => item.id !== entry.id)] };
}

export function removeFavorite(favorites, kind, id, now = new Date().toISOString()) {
  const normalized = normalizeFavorites(favorites, now);
  const field = kind === "answer" ? "answers" : "chats";
  return { ...normalized, [field]: normalized[field].filter((entry) => entry.id !== id) };
}

export function personalKnowledgeEntries(favorites, now = new Date().toISOString()) {
  const normalized = normalizeFavorites(favorites, now);
  return [...normalized.answers, ...normalized.chats]
    .map((entry) => {
      const result = { ...entry };
      delete result.updatedAt;
      return result;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
