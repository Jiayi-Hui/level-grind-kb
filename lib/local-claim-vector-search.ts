export type ClaimSearchDocument = {
  id: string;
  text: string;
  exact: string;
};

export type ClaimVectorSearchResult = {
  id: string;
  score: number;
  semanticScore: number;
  keywordScore: number;
};

type EmbeddingTensor = {
  tolist: () => number[] | number[][];
};

type FeatureExtractor = (
  text: string | string[],
  options: { pooling: "cls"; normalize: true },
) => Promise<EmbeddingTensor>;

let extractorPromise: Promise<FeatureExtractor> | null = null;
let documentCache: {
  signature: string;
  vectors: number[][];
} | null = null;

function modelProgressMessage(progress: unknown) {
  if (!progress || typeof progress !== "object") return "正在加载本地语义模型…";
  const event = progress as { status?: string; progress?: number; file?: string };
  if (event.status === "progress" && Number.isFinite(event.progress)) {
    return `首次加载本地语义模型 ${Math.round(event.progress || 0)}%…`;
  }
  if (event.status === "ready") return "正在初始化本地语义模型…";
  return event.file ? `正在加载 ${event.file.split("/").at(-1) || "语义模型"}…` : "正在加载本地语义模型…";
}

async function getExtractor(onProgress?: (message: string) => void) {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = "/models/";
      // Keep the ONNX bootstrap module inside the Vite bundle. EdgeOne serves
      // standalone `.mjs` files as application/octet-stream, which browsers
      // reject as JavaScript modules. Only override the binary location.
      env.backends.onnx.wasm.wasmPaths = {
        wasm: "/transformers-wasm/ort-wasm-simd-threaded.jsep.wasm",
      };
      // A single thread avoids SharedArrayBuffer / cross-origin-isolation
      // requirements and works consistently on desktop and mobile browsers.
      env.backends.onnx.wasm.numThreads = 1;
      const extractor = await pipeline(
        "feature-extraction",
        "bge-small-zh-v1.5",
        {
          dtype: "q8",
          progress_callback: (progress: unknown) => onProgress?.(modelProgressMessage(progress)),
        },
      );
      return extractor as unknown as FeatureExtractor;
    })();
  }
  return extractorPromise;
}

function matrix(tensor: EmbeddingTensor) {
  const values = tensor.tolist();
  if (!Array.isArray(values[0])) return [values as number[]];
  return values as number[][];
}

function cosine(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function literalScore(query: string, document: ClaimSearchDocument) {
  const needle = query.toLowerCase().replace(/\s+/g, "");
  const exact = document.exact.toLowerCase().replace(/\s+/g, "");
  const text = document.text.toLowerCase().replace(/\s+/g, "");
  if (exact.includes(needle)) return 1;
  if (text.includes(needle)) return 0.7;
  const segmented = [...new Intl.Segmenter("zh", { granularity: "word" }).segment(query)]
    .filter((item) => item.isWordLike)
    .map((item) => item.segment.toLowerCase().replace(/\s+/g, ""))
    .filter((item) => item.length >= 2);
  const terms = segmented.length > 1
    ? segmented
    : Array.from({ length: Math.max(0, needle.length - 1) }, (_, index) => needle.slice(index, index + 2));
  if (!terms.length) return 0;
  const exactCoverage = terms.filter((term) => exact.includes(term)).length / terms.length;
  const textCoverage = terms.filter((term) => text.includes(term)).length / terms.length;
  if (exactCoverage) return 0.6 * exactCoverage;
  if (textCoverage) return 0.3 * textCoverage;
  return 0;
}

function signatureFor(documents: ClaimSearchDocument[]) {
  return documents.map((document) => `${document.id}\u0000${document.text}`).join("\u0001");
}

export async function searchClaimsByVector(
  query: string,
  documents: ClaimSearchDocument[],
  onProgress?: (message: string) => void,
) {
  const extractor = await getExtractor(onProgress);
  const signature = signatureFor(documents);
  if (!documentCache || documentCache.signature !== signature) {
    onProgress?.("正在建立 Claim 向量索引…");
    const documentOutput = await extractor(
      documents.map((document) => document.text),
      { pooling: "cls", normalize: true },
    );
    documentCache = {
      signature,
      vectors: matrix(documentOutput),
    };
  }

  onProgress?.("正在进行本地向量检索…");
  const queryOutput = await extractor(
    `为这个句子生成表示以用于检索相关文章：${query}`,
    { pooling: "cls", normalize: true },
  );
  const queryVector = matrix(queryOutput)[0] || [];
  const ranked = documents.map((document, index) => {
    const semanticScore = cosine(queryVector, documentCache?.vectors[index] || []);
    const keywordScore = literalScore(query, document);
    return {
      id: document.id,
      score: semanticScore * 0.7 + keywordScore * 0.3,
      semanticScore,
      keywordScore,
    };
  }).sort((left, right) => right.score - left.score);

  const relevanceFloor = Math.max(0.34, (ranked[0]?.score || 0) - 0.12);
  return ranked
    .filter((result) => result.keywordScore > 0 || result.score >= relevanceFloor)
    .slice(0, 18);
}
