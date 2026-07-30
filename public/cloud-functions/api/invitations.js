const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

async function verifyClerkToken(request, secretKey) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("请先登录");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("登录状态无效");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  const jwksResponse = await fetch("https://api.clerk.com/v1/jwks", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!jwksResponse.ok) throw new Error("无法验证 Clerk 登录状态");
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("登录密钥已过期，请重新登录");
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
  if (!valid || payload.exp < now || payload.nbf > now || !["https://www.level-grind.com", "https://level-grind.com"].includes(payload.azp)) {
    throw new Error("登录状态验证失败");
  }
  return payload;
}

async function clerkRequest(path, secretKey, init = {}) {
  return fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function requireOwner(request, env) {
  if (!env.CLERK_SECRET_KEY) throw new Error("邀请服务尚未配置 Clerk Secret Key");
  const token = await verifyClerkToken(request, env.CLERK_SECRET_KEY);
  const userResponse = await clerkRequest(`/users/${token.sub}`, env.CLERK_SECRET_KEY);
  if (!userResponse.ok) throw new Error("无法读取当前用户");
  const user = await userResponse.json();
  const emails = new Map((user.email_addresses || []).map((item) => [item.id, item.email_address]));
  const currentEmail = emails.get(user.primary_email_address_id);
  const ownerEmail = env.LEVEL_GRIND_OWNER_EMAIL || "jiayihui01@gmail.com";
  if (currentEmail?.toLowerCase() !== ownerEmail.toLowerCase()) throw new Error("只有 workspace owner 可以发送邀请");
  return user;
}

export async function onRequestGet({ request, env }) {
  try {
    await requireOwner(request, env);
    const response = await clerkRequest("/invitations?limit=100", env.CLERK_SECRET_KEY);
    const body = await response.json();
    return response.ok ? json(body) : json({ error: body.errors?.[0]?.long_message || "无法读取邀请" }, response.status);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "邀请服务不可用" }, 401);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireOwner(request, env);
    const { email, role } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "邮箱格式不正确" }, 400);
    if (!["Analyst", "PM", "GEM PM"].includes(role)) return json({ error: "角色不正确" }, 400);
    const response = await clerkRequest("/invitations", env.CLERK_SECRET_KEY, {
      method: "POST",
      body: JSON.stringify({
        email_address: email.trim().toLowerCase(),
        redirect_url: "https://www.level-grind.com",
        public_metadata: { role, invitedFrom: "Level Grind Settings" },
        notify: true,
      }),
    });
    const body = await response.json();
    return response.ok ? json({ id: body.id, email: body.email_address, status: body.status }) : json({
      error: body.errors?.[0]?.long_message || body.errors?.[0]?.message || "邀请发送失败",
    }, response.status);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "邀请服务不可用" }, 401);
  }
}
