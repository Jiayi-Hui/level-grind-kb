const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

export async function clerkIdentity(request, env) {
  if (!env.CLERK_SECRET_KEY) throw new Error("AUTH_NOT_CONFIGURED");
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("AUTH_REQUIRED");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("AUTH_INVALID");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  const jwksResponse = await fetch("https://api.clerk.com/v1/jwks", {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  if (!jwksResponse.ok) throw new Error("AUTH_UNAVAILABLE");
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("AUTH_EXPIRED");
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);
  if (!valid || payload.exp < now || payload.nbf > now || ![
    "https://www.level-grind.com",
    "https://level-grind.com",
  ].includes(payload.azp)) {
    throw new Error("AUTH_INVALID");
  }

  const userResponse = await fetch(`https://api.clerk.com/v1/users/${payload.sub}`, {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  if (!userResponse.ok) throw new Error("AUTH_USER_UNAVAILABLE");
  const user = await userResponse.json();
  const emails = new Map((user.email_addresses || []).map((item) => [item.id, item.email_address]));
  const email = emails.get(user.primary_email_address_id) || [...emails.values()][0] || "";
  if (!email) throw new Error("AUTH_EMAIL_REQUIRED");
  return {
    subject: payload.sub,
    email: email.toLowerCase(),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || email.split("@")[0],
  };
}

export function sharedDbConfigured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function supabaseRequest(env, path, init = {}) {
  if (!sharedDbConfigured(env)) throw new Error("SHARED_DB_NOT_CONFIGURED");
  const url = `${String(env.SUPABASE_URL).replace(/\/$/, "")}/rest/v1/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}
