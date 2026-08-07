import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function unavailable() {
  return Object.assign(new Error("OBJECT_STORE_NOT_CONFIGURED"), { status: 503 });
}

function safeKey(value) {
  return String(value || "").replace(/[^a-zA-Z0-9/_=-]/g, "_").replace(/^\/+/, "");
}

function safePath(root, key) {
  const target = path.resolve(root, safeKey(key));
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw unavailable();
  return target;
}

/**
 * Storage boundary for attachment bytes. P0 deliberately supports a local
 * adapter only for test/development. A production COS adapter must be added
 * explicitly; a missing/unsupported configuration fails closed.
 */
export function createObjectStore(environment = process.env, runtimeCredentials = {}) {
  const driver = String(environment.NOTES_OBJECT_STORE_DRIVER || "").toLowerCase();
  if (driver === "cos") return createCosStore(environment, runtimeCredentials);
  if (driver !== "local" || environment.NODE_ENV === "production") {
    return { configured: false, driver: driver || "none", async put() { throw unavailable(); }, async get() { throw unavailable(); }, async remove() { throw unavailable(); } };
  }
  const root = String(environment.NOTES_LOCAL_OBJECT_STORE_DIR || "").trim();
  if (!root) return { configured: false, driver: "local", async put() { throw unavailable(); }, async get() { throw unavailable(); }, async remove() { throw unavailable(); } };
  return {
    configured: true,
    driver: "local",
    directUpload: false,
    async put(key, bytes) {
      const target = safePath(root, key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
    },
    async get(key) { return readFile(safePath(root, key)); },
    async remove(key) { const { unlink } = await import("node:fs/promises"); try { await unlink(safePath(root, key)); } catch (error) { if (error?.code !== "ENOENT") throw error; } },
  };
}

function createCosStore(environment, runtimeCredentials = {}) {
  const bucket = String(environment.COS_BUCKET || "").trim();
  const region = String(environment.COS_REGION || "").trim();
  // Values are resolved inside CloudBase/CVM only. They are never serialized
  // into a response; temporary role credentials can populate these variables.
  const secretId = String(runtimeCredentials.secretId || environment.COS_SECRET_ID || environment.TENCENTCLOUD_SECRETID || environment.TENCENTCLOUD_SECRET_ID || "").trim();
  const secretKey = String(runtimeCredentials.secretKey || environment.COS_SECRET_KEY || environment.TENCENTCLOUD_SECRETKEY || environment.TENCENTCLOUD_SECRET_KEY || "").trim();
  const securityToken = String(runtimeCredentials.securityToken || environment.COS_SECURITY_TOKEN || environment.TENCENTCLOUD_SESSIONTOKEN || environment.TENCENTCLOUD_SESSION_TOKEN || "").trim();
  if (!bucket || !region || !secretId || !secretKey) {
    return { configured: false, driver: "cos", directUpload: true, async put() { throw unavailable(); }, async get() { throw unavailable(); }, async head() { throw unavailable(); }, async presignPut() { throw unavailable(); }, async remove() { throw unavailable(); } };
  }
  // COS exposes an S3-compatible API. Using the maintained AWS SDK avoids the
  // deprecated request stack still bundled by the legacy COS Node SDK.
  const client = new S3Client({
    region,
    endpoint: `https://cos.${region}.myqcloud.com`,
    forcePathStyle: false,
    credentials: {
      accessKeyId: secretId,
      secretAccessKey: secretKey,
      ...(securityToken ? { sessionToken: securityToken } : {}),
    },
  });
  return {
    configured: true,
    driver: "cos",
    directUpload: true,
    async presignPut(key, { mediaType, sha256 }) {
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mediaType, Metadata: { sha256 } });
      const url = await getSignedUrl(client, command, { expiresIn: 600 });
      return { url, method: "PUT", expiresInSeconds: 600, headers: { "Content-Type": mediaType, "x-amz-meta-sha256": sha256 } };
    },
    async put() { throw unavailable(); },
    async head(key) {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { byteSize: Number(result.ContentLength || 0), sha256: String(result.Metadata?.sha256 || "").toLowerCase() };
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) return Buffer.alloc(0);
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async remove(key) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); },
  };
}

export function attachmentObjectKey(teamId, targetType, targetId, attachmentId, filename) {
  const extension = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
  return `research/${teamId}/${targetType}/${targetId}/${attachmentId}-${crypto.randomUUID()}${extension}`;
}
