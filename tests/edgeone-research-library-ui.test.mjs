import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EdgeOne ships first-class Notes库 and Ideas库 navigation with fail-closed writes", async () => {
  const [main, notes, ideas] = await Promise.all([
    readFile(new URL("../deploy/edgeone-demo/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/idea-book.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(main, /"notes" \| "ideas" \| "graph"/);
  assert.match(main, /<span>Notes库<\/span>/);
  assert.match(main, /<span>Ideas库<\/span>/);
  assert.match(main, /<span>Idea Graph<\/span>/);
  assert.match(main, /打开 Idea Graph/);
  assert.match(main, /<SharedNotesView \/>/);
  assert.match(main, /<IdeaBookView \/>/);

  for (const source of [notes, ideas]) {
    assert.match(source, /VITE_UI_FIXTURES === "true"/);
    assert.match(source, /ingestionFrozen/);
    assert.match(source, /configured/);
    assert.match(source, /不会将空白页面伪装成没有数据/);
    assert.match(source, /版本冲突/);
  }
  assert.match(notes, /本地演示模式 · 不会上传或写入团队/);
  assert.match(notes, /团队 Notes API 未启用/);
  assert.match(notes, /Executive Summary/);
  assert.match(notes, /Potential Expectation Gap/);
  assert.doesNotMatch(notes, /允许团队用户查看/);
  assert.doesNotMatch(notes, /允许下载/);
  assert.match(ideas, /公开\/合成演示数据 · 不会保存/);
  assert.match(ideas, /尚未开放上传/);
  assert.match(ideas, /Business & Industry Overview/);
  assert.match(ideas, /Our Case vs\. Consensus Expectations/);
  assert.doesNotMatch(ideas, /允许团队用户查看/);
  assert.doesNotMatch(ideas, /允许下载/);
});

test("Notes uses the authenticated direct-COS attachment contract without browser parsing", async () => {
  const notes = await readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8");
  assert.match(notes, /\.pdf,\.docx,\.txt,\.md/);
  assert.match(notes, /\/api\/research-attachments\?parentType=note&parentId=/);
  assert.match(notes, /sha256/);
  assert.match(notes, /init\.upload\.url/);
  assert.match(notes, /附件上传失败/);
  assert.match(notes, /action=complete/);
  assert.match(notes, /action=retry/);
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
  assert.match(notes, /useState\(true\).*internal gray-box retrieval|internal gray-box retrieval by default/s);
  assert.match(notes, /setAiProcessingAllowed\(true\)/);
  assert.match(notes, /团队 Notes 写入未能在刷新后确认/);
  assert.match(notes, /disabled=\{!writeOpen\}/);
  assert.match(notes, /团队写入已确认/);
});

test("Notes and Ideas start with an upload-first flow and keep manual entry secondary", async () => {
  const [notes, ideas, css] = await Promise.all([
    readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/idea-book.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/mirror.css", import.meta.url), "utf8"),
  ]);
  for (const source of [notes, ideas]) {
    assert.match(source, /upload-first-panel/);
    assert.match(source, /manual-entry/);
    assert.match(source, /创建并上传/);
    assert.match(source, /🎉 第一条/);
    assert.doesNotMatch(source, /research-preview-boundary/);
  }
  assert.match(notes, /上传你的第一个 Note/);
  assert.match(ideas, /上传你的第一个 Idea/);
  assert.match(css, /first-record-celebration/);
  assert.match(css, /manager-review-strip/);
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
  assert.match(ideas, /\/api\/research-attachments\?parentType=idea&parentId=/);
  assert.match(ideas, /sha256/);
  assert.match(ideas, /init\.upload\.url/);
  assert.match(ideas, /action=complete/);
  assert.match(ideas, /action=retry/);
  assert.match(ideas, /替换判断/);
  assert.match(ideas, /补充判断/);
  assert.match(ideas, /识别到 .* 个候选/);
  assert.match(ideas, /填入当前 Idea/);
  assert.match(ideas, /不会自动创建其余 Idea/);
  assert.match(ideas, /已软删除/);
  assert.match(ideas, /expectedVersion/);
  assert.match(ideas, /模拟版本冲突/);
  assert.match(ideas, /团队 Idea 写入未能在刷新后确认/);
  assert.match(ideas, /登录凭证不可用/);
  assert.match(ideas, /团队写入已确认/);
  assert.match(ideas, /useState\(true\).*internal gray-box retrieval|internal gray-box retrieval without/s);
  assert.match(ideas, /setInternalAiAllowed\(true\)/);
  assert.match(ideas, /disabled=\{!writeOpen\}/);
});

test("Idea Graph preserves atlas controls and daily playback", async () => {
  const [graph, data, css, main] = await Promise.all([
    readFile(new URL("../deploy/edgeone-demo/src/idea-graph.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/idea-graph-data.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/idea-graph.css", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/main.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(main, /view === "graph"/);
  assert.match(main, /graph-content/);
  assert.match(graph, /selectedSectors/);
  assert.match(graph, /selectedMarkets/);
  assert.match(graph, /toggleSelection/);
  assert.match(graph, /逐日观点演进/);
  assert.match(graph, /type="range"/);
  assert.match(graph, /setPlaying/);
  assert.match(graph, /fitGraph/);
  assert.match(graph, /rerunLayout/);
  assert.match(data, /export const periods/);
  assert.match(data, /export const sectors/);
  assert.match(data, /export const markets/);
  assert.match(css, /\.atlas-workspace/);
  assert.match(css, /\.atlas-controls/);
  assert.match(css, /\.atlas-stage/);
  assert.match(css, /\.atlas-detail/);
  assert.doesNotMatch(graph, /investment-graph\/src/);
});
