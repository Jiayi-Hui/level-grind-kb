import assert from "node:assert/strict";
import test from "node:test";
import { extractIdeaCandidates } from "../services/tencent-notes-api/idea-candidate-extractor.mjs";

test("deterministic attachment extractor returns explicit multi-Idea candidates without a thesis", () => {
  const candidates = extractIdeaCandidates({
    fileName: "coverage-memo.docx",
    text: `Company: Meta Platforms\nTicker: META\nDirection: Long\nUpside: +25%\nDownside: -15%\n\nCompany: NVIDIA\nTicker: NVDA\nDirection: Short\nDownside: -20%`,
  });
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0], {
    id: "candidate-1",
    title: "Meta Platforms (META)",
    company: "Meta Platforms",
    ticker: "META",
    direction: "long",
    upsideTargetPct: "+25%",
    downsideRiskPct: "-15%",
    matchedFields: ["title", "company", "ticker", "direction", "upside", "downside"],
    extractor: "deterministic-attachment-v1",
  });
  assert.equal(candidates[1].ticker, "NVDA");
  assert.equal(candidates[1].direction, "short");
  assert.equal("thesis" in candidates[0], false);
  assert.equal(JSON.stringify(candidates).includes("coverage-memo"), false);
});

test("deterministic attachment extractor ignores unstructured prose", () => {
  assert.deepEqual(extractIdeaCandidates({ fileName: "notes.txt", text: "市场今天有很多消息，后续继续跟踪。" }), []);
});
