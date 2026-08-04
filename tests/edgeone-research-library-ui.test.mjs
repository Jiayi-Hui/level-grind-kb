import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EdgeOne ships first-class Notes and Idea Book navigation with fail-closed writes", async () => {
  const [main, notes, ideas] = await Promise.all([
    readFile(new URL("../deploy/edgeone-demo/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/idea-book.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(main, /"notes" \| "ideas"/);
  assert.match(main, /<span>Notes<\/span>/);
  assert.match(main, /<span>Idea Book<\/span>/);
  assert.match(main, /<SharedNotesView \/>/);
  assert.match(main, /<IdeaBookView \/>/);

  for (const source of [notes, ideas]) {
    assert.match(source, /VITE_UI_FIXTURES === "true"/);
    assert.match(source, /ingestionFrozen/);
    assert.match(source, /configured/);
    assert.match(source, /不会伪装成功/);
    assert.match(source, /版本冲突/);
  }
  assert.match(notes, /本地演示模式 · 不会上传或写入团队/);
  assert.match(notes, /团队 Notes API 未启用/);
  assert.match(ideas, /公开\/合成演示数据 · 不会保存/);
  assert.match(ideas, /尚未开放上传/);
});

test("Notes uses the authenticated direct-COS attachment contract without browser parsing", async () => {
  const notes = await readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8");
  assert.match(notes, /\.pdf,\.docx,\.txt,\.md/);
  assert.match(notes, /\/api\/shared-notes\/\$\{noteId\}\/attachments/);
  assert.match(notes, /sha256/);
  assert.match(notes, /init\.upload\.url/);
  assert.match(notes, /COS 直传/);
  assert.match(notes, /\/complete/);
  assert.match(notes, /\/retry/);
  assert.match(notes, /expectedVersion: attachment\.version/);
  assert.match(notes, /团队写入已确认 · Note ID/);
  assert.match(notes, /仅保存到本地演示/);
  assert.match(notes, /本地演示：文件已选择但不会上传/);
  assert.match(notes, /登录凭证不可用/);
  assert.match(notes, /uploading/);
  assert.match(notes, /ocr_required/);
  assert.match(notes, /重试/);
  assert.match(notes, /软删除|移入已删除状态/);
  assert.doesNotMatch(notes, /\/api\/shared-notes\/parse/);
  assert.doesNotMatch(notes, /parseLocalDocument/);
  assert.doesNotMatch(notes, /local-document-parser/);
  assert.match(notes, /sharedWriteEnabled && configured && !ingestionFrozen/);
  assert.match(notes, /团队 Notes 写入未能在刷新后确认/);
  assert.match(notes, /disabled=\{!writeOpen\}/);
  assert.match(notes, /团队写入已确认/);
});

test("Notes renders attachment content in a read-only document preview, with a separate edit mode", async () => {
  const [notes, css] = await Promise.all([
    readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/mirror.css", import.meta.url), "utf8"),
  ]);
  assert.match(notes, /ReadonlyTextPreview/);
  assert.match(notes, /document-preview-panel/);
  assert.match(notes, /尚未选择文件/);
  assert.match(notes, /editingBody/);
  assert.match(notes, /编辑正文/);
  assert.match(notes, /document-pdf-preview/);
  assert.match(notes, /safePreviewUrl/);
  assert.match(notes, /DOCX · 后端已解析正文/);
  assert.match(notes, /attachment-preview-select/);
  assert.match(css, /document-preview-panel/);
  assert.match(css, /document-pdf-preview/);
  assert.match(css, /document-text-preview/);
});

test("Idea Book models workflow statuses and linked Notes in the preview contract", async () => {
  const ideas = await readFile(new URL("../deploy/edgeone-demo/src/idea-book.tsx", import.meta.url), "utf8");
  for (const status of ["draft", "pending_review", "approved", "rejected", "archived"]) assert.match(ideas, new RegExp(status));
  assert.match(ideas, /关联 Notes/);
  assert.match(ideas, /ATTACHMENT PARSING/);
  assert.match(ideas, /\/api\/shared-ideas\/\$\{ideaId\}\/attachments/);
  assert.match(ideas, /sha256/);
  assert.match(ideas, /init\.upload\.url/);
  assert.match(ideas, /\/complete/);
  assert.match(ideas, /\/retry/);
  assert.match(ideas, /替换判断/);
  assert.match(ideas, /补充判断/);
  assert.match(ideas, /已软删除/);
  assert.match(ideas, /expectedVersion/);
  assert.match(ideas, /模拟版本冲突/);
  assert.match(ideas, /团队 Idea 写入未能在刷新后确认/);
  assert.match(ideas, /登录凭证不可用/);
  assert.match(ideas, /团队写入已确认/);
  assert.match(ideas, /disabled=\{!writeOpen\}/);
});
