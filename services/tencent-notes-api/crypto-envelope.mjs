import crypto from "node:crypto";

const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const LEGACY_VERSION = 1;

function fail(code) {
  return Object.assign(new Error(code), { status: 503 });
}

function decodeMasterKey(value) {
  if (!value || typeof value !== "string") throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== value.replace(/\s/g, "")) {
    throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  }
  return key;
}

function parseKeyVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  return version;
}

function loadKeyRing(environment) {
  const serialized = String(environment.NOTES_MASTER_KEYS_JSON || "").trim();
  if (!serialized) {
    return new Map([[LEGACY_VERSION, decodeMasterKey(environment.NOTES_MASTER_KEY_B64)]]);
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");

  const keys = new Map();
  for (const [rawVersion, encodedKey] of Object.entries(parsed)) {
    keys.set(parseKeyVersion(rawVersion), decodeMasterKey(encodedKey));
  }
  if (!keys.size) throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  return keys;
}

/**
 * Production-only encryption context. The key is supplied by the runtime secret
 * manager and never written to PostgreSQL, audit records, or logs.
 */
export function loadCryptoContext(environment = process.env) {
  if (environment.NODE_ENV === "test" && !environment.NOTES_MASTER_KEY_B64 && !environment.NOTES_MASTER_KEYS_JSON) {
    throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  }
  const masterKeys = loadKeyRing(environment);
  const keyVersion = parseKeyVersion(environment.NOTES_ACTIVE_KEY_VERSION || LEGACY_VERSION);
  const masterKey = masterKeys.get(keyVersion);
  if (!masterKey) throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  return { masterKey, masterKeys, keyVersion };
}

function aad(binding, keyVersion) {
  if (!binding?.teamId || !binding?.recordType || !binding?.recordId) throw fail("NOTES_ENCRYPTION_BINDING_INVALID");
  return Buffer.from(`${binding.teamId}:${binding.recordType}:${binding.recordId}:${keyVersion}`, "utf8");
}

function seal(plaintext, key, additionalData) {
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

function open(ciphertext, nonce, authTag, key, additionalData) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
  decipher.setAAD(additionalData);
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

/** Encrypt one logical record with its own random data key and nonce. */
export function encryptText(plaintext, context, binding) {
  if (!context?.masterKey || context.masterKey.length !== KEY_BYTES) throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  const dataKey = crypto.randomBytes(KEY_BYTES);
  const additionalData = aad(binding, context.keyVersion);
  const body = seal(plaintext, dataKey, additionalData);
  const wrapped = seal(dataKey.toString("base64"), context.masterKey, additionalData);
  return {
    ciphertext_b64: body.ciphertext,
    nonce_b64: body.nonce,
    auth_tag_b64: body.authTag,
    wrapped_data_key_b64: wrapped.ciphertext,
    key_wrap_nonce_b64: wrapped.nonce,
    key_wrap_auth_tag_b64: wrapped.authTag,
    key_version: context.keyVersion,
  };
}

export function decryptText(record, context, binding) {
  if (!context?.masterKey || context.masterKey.length !== KEY_BYTES) throw fail("NOTES_ENCRYPTION_NOT_CONFIGURED");
  const keyVersion = parseKeyVersion(record.key_version);
  const masterKey = context.masterKeys?.get(keyVersion) || (context.keyVersion === keyVersion ? context.masterKey : null);
  if (!masterKey) throw fail("NOTES_ENCRYPTION_VERSION_UNSUPPORTED");
  const additionalData = aad(binding, keyVersion);
  const dataKey = Buffer.from(open(record.wrapped_data_key_b64, record.key_wrap_nonce_b64, record.key_wrap_auth_tag_b64, masterKey, additionalData), "base64");
  if (dataKey.length !== KEY_BYTES) throw fail("NOTES_ENCRYPTION_RECORD_INVALID");
  return open(record.ciphertext_b64, record.nonce_b64, record.auth_tag_b64, dataKey, additionalData);
}

/** Test-only utility. It is deliberately unavailable to a production runtime. */
export function createTestCryptoContext(seed = "level-grind-test-key") {
  if (process.env.NODE_ENV !== "test") throw new Error("TEST_CRYPTO_CONTEXT_FORBIDDEN");
  const masterKey = crypto.createHash("sha256").update(seed).digest();
  return { masterKey, masterKeys: new Map([[LEGACY_VERSION, masterKey]]), keyVersion: LEGACY_VERSION };
}
