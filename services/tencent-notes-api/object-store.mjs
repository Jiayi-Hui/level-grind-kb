import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import COS from "cos-nodejs-sdk-v5";

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
  const client = new COS({ SecretId: secretId, SecretKey: secretKey, ...(securityToken ? { SecurityToken: securityToken } : {}) });
  const call = (method, options) => new Promise((resolve, reject) => client[method](options, (error, result) => error ? reject(error) : resolve(result)));
  return {
    configured: true,
    driver: "cos",
    directUpload: true,
    async presignPut(key, { mediaType, sha256 }) {
      const url = await new Promise((resolve, reject) => client.getObjectUrl(
        { Bucket: bucket, Region: region, Key: key, Method: "PUT", Sign: true, Expires: 600, Headers: { "content-type": mediaType, "x-cos-meta-sha256": sha256 } },
        (error, result) => error ? reject(error) : resolve(result.Url || result),
      ));
      return { url, method: "PUT", expiresInSeconds: 600, headers: { "Content-Type": mediaType, "x-cos-meta-sha256": sha256 } };
    },
    async put() { throw unavailable(); },
    async head(key) { const result = await call("headObject", { Bucket: bucket, Region: region, Key: key }); return { byteSize: Number(result.headers?.["content-length"] || result.headers?.["Content-Length"] || 0), sha256: String(result.headers?.["x-cos-meta-sha256"] || result.headers?.["X-Cos-Meta-Sha256"] || "").toLowerCase() }; },
    async get(key) { const result = await call("getObject", { Bucket: bucket, Region: region, Key: key }); return Buffer.isBuffer(result.Body) ? result.Body : Buffer.from(result.Body || ""); },
    async remove(key) { await call("deleteObject", { Bucket: bucket, Region: region, Key: key }); },
  };
}

export function attachmentObjectKey(teamId, targetType, targetId, attachmentId, filename) {
  const extension = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
  return `research/${teamId}/${targetType}/${targetId}/${attachmentId}-${crypto.randomUUID()}${extension}`;
}
