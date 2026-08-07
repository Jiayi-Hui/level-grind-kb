import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  const [graph, hostCss, main, packageJson, canonicalGraph, canonicalData, canonicalCss, sourceManifest] = await Promise.all([
    readFile(new URL("../deploy/edgeone-demo/src/idea-graph.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/idea-graph-host.css", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/@jiayi-hui/investment-graph/src/investment-main.jsx", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/@jiayi-hui/investment-graph/src/investment-data.js", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/@jiayi-hui/investment-graph/src/investment-styles.css", import.meta.url), "utf8"),
    readFile(new URL("../vendor/investment-graph/SOURCE.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.match(main, /view === "graph"/);
  assert.match(main, /graph-content/);
  assert.match(graph, /@jiayi-hui\/investment-graph/);
  assert.match(graph, /<InvestmentGraph/);
  assert.doesNotMatch(graph, /cytoscape|selectedSectors|selectedMarkets|graphPositions/);
  assert.match(packageJson, /file:vendor\/investment-graph/);
  assert.equal(sourceManifest.repository, "Jiayi-Hui/investment-graph");
  assert.equal(sourceManifest.sourceCommit, "c4c94a3b44167c8a098c57ba6dcccbd8c6ab207d");
  assert.match(hostCss, /\.atlas-shell/);
  assert.doesNotMatch(hostCss, /\.atlas-workspace|\.atlas-controls|\.atlas-stage|\.atlas-detail/);

  assert.match(canonicalGraph, /selectedSectors/);
  assert.match(canonicalGraph, /selectedMarkets/);
  assert.match(canonicalGraph, /toggleSelection/);
  assert.match(canonicalGraph, /crossIndustryBridgeIds/);
  assert.match(canonicalGraph, /graphPositions/);
  assert.match(canonicalGraph, /layout:\s*\{\s*name:\s*"preset"/);
  assert.match(canonicalGraph, /mouseover/);
  assert.match(canonicalGraph, /mouseout/);
  assert.match(canonicalGraph, /逐日观点演进/);
  assert.match(canonicalGraph, /type="range"/);
  assert.match(canonicalGraph, /setPlaying/);
  assert.match(canonicalGraph, /VISIBLE CONNECTIONS/);
  assert.match(canonicalGraph, /sourceUrl/);
  assert.match(canonicalGraph, /atlas-kpis/);
  assert.match(canonicalData, /export const periods/);
  assert.match(canonicalData, /"2026-08-06"/);
  assert.match(canonicalData, /export const sectors/);
  assert.match(canonicalData, /export const markets/);
  assert.match(canonicalCss, /\.atlas-workspace/);
  assert.match(canonicalCss, /\.atlas-controls/);
  assert.match(canonicalCss, /\.atlas-stage/);
  assert.match(canonicalCss, /\.atlas-detail/);
  assert.match(canonicalGraph, /"border-style": "dashed"/);
  assert.match(canonicalGraph, /width: 62/);
  assert.match(canonicalGraph, /height: 62/);

  for (const [relativePath, expected] of Object.entries(sourceManifest.files)) {
    const content = await readFile(new URL(`../vendor/investment-graph/${relativePath}`, import.meta.url));
    assert.equal(createHash("sha256").update(content).digest("hex"), expected, `${relativePath} must match its canonical source hash`);
  }
});
