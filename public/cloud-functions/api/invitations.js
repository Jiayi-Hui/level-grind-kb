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

function memberManagerEmails(env) {
  return new Set([
    env.LEVEL_GRIND_OWNER_EMAIL,
    ...(env.LEVEL_GRIND_MEMBER_MANAGER_EMAILS || "").split(","),
  ].map((email) => String(email || "").trim().toLowerCase()).filter(Boolean));
}

async function requireSignedInUser(request, env) {
  if (!env.CLERK_SECRET_KEY) throw new Error("邀请服务尚未配置 Clerk Secret Key");
  const token = await verifyClerkToken(request, env.CLERK_SECRET_KEY);
  const userResponse = await clerkRequest(`/users/${token.sub}`, env.CLERK_SECRET_KEY);
  if (!userResponse.ok) throw new Error("无法读取当前用户");
  const user = await userResponse.json();
  const emails = new Map((user.email_addresses || []).map((item) => [item.id, item.email_address]));
  const currentEmail = emails.get(user.primary_email_address_id);
  const normalizedEmail = String(currentEmail || "").trim().toLowerCase();
  return { user, currentEmail: normalizedEmail };
}

async function requireMemberManager(request, env) {
  const currentUser = await requireSignedInUser(request, env);
  if (!memberManagerEmails(env).has(currentUser.currentEmail)) throw new Error("成员管理权限不足");
  return currentUser;
}

export async function onRequestGet({ request, env }) {
  try {
    const currentUser = await requireSignedInUser(request, env);
    const [usersResponse, invitationsResponse] = await Promise.all([
      clerkRequest("/users?limit=100&order_by=-created_at", env.CLERK_SECRET_KEY),
      clerkRequest("/invitations?limit=100", env.CLERK_SECRET_KEY),
    ]);
    const [usersBody, invitationsBody] = await Promise.all([usersResponse.json(), invitationsResponse.json()]);
    if (!usersResponse.ok || !invitationsResponse.ok) {
      const errorBody = usersResponse.ok ? invitationsBody : usersBody;
      return json({ error: errorBody.errors?.[0]?.long_message || "无法读取成员" }, usersResponse.ok ? invitationsResponse.status : usersResponse.status);
    }
    const users = Array.isArray(usersBody) ? usersBody : usersBody.data || [];
    const invitations = Array.isArray(invitationsBody) ? invitationsBody : invitationsBody.data || [];
    const ownerEmail = (env.LEVEL_GRIND_OWNER_EMAIL || "").toLowerCase();
    const managers = memberManagerEmails(env);
    const activeMembers = users.map((user) => {
      const emails = new Map((user.email_addresses || []).map((item) => [item.id, item.email_address]));
      const email = emails.get(user.primary_email_address_id) || [...emails.values()][0] || "";
      return {
        id: user.id,
        email,
        name: [user.first_name, user.last_name].filter(Boolean).join(" "),
        role: email.toLowerCase() === ownerEmail ? "Owner" : user.public_metadata?.role || "Member",
        status: user.banned ? "disabled" : "active",
        protectedManager: managers.has(email.toLowerCase()),
      };
    }).filter((member) => member.email && member.status !== "disabled");
    const activeEmails = new Set(activeMembers.map((member) => member.email.toLowerCase()));
    const pendingMembers = invitations
      .filter((invitation) => !activeEmails.has(String(invitation.email_address || "").toLowerCase()))
      .map((invitation) => ({
        id: invitation.id,
        email: invitation.email_address,
        name: "",
        role: invitation.public_metadata?.role || "Invited",
        status: invitation.status === "revoked" ? "revoked" : "pending",
        protectedManager: managers.has(String(invitation.email_address || "").toLowerCase()),
      }));
    return json({
      canManage: managers.has(currentUser.currentEmail),
      members: [...activeMembers, ...pendingMembers],
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "邀请服务不可用" }, 401);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireMemberManager(request, env);
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

function validRole(value) {
  return ["Analyst", "PM", "GEM PM"].includes(value);
}

async function selectedUser(id, env) {
  const response = await clerkRequest(`/users/${encodeURIComponent(id)}`, env.CLERK_SECRET_KEY);
  if (!response.ok) return null;
  return response.json();
}

function primaryEmail(user) {
  const emails = new Map((user.email_addresses || []).map((item) => [item.id, item.email_address]));
  return emails.get(user.primary_email_address_id) || [...emails.values()][0] || "";
}

export async function onRequestPatch({ request, env }) {
  try {
    await requireMemberManager(request, env);
    const { id, email, name, role, status } = await request.json();
    if (!id || !validRole(role)) return json({ error: "成员和角色不能为空" }, 400);
    const managers = memberManagerEmails(env);
    const user = await selectedUser(id, env);

    if (user) {
      if (managers.has(primaryEmail(user).toLowerCase())) {
        return json({ error: "成员管理账户不能在这里修改" }, 409);
      }
      const displayName = cleanMemberName(name);
      const [profileResponse, metadataResponse] = await Promise.all([
        clerkRequest(`/users/${encodeURIComponent(id)}`, env.CLERK_SECRET_KEY, {
          method: "PATCH",
          body: JSON.stringify({ first_name: displayName, last_name: "" }),
        }),
        clerkRequest(`/users/${encodeURIComponent(id)}/metadata`, env.CLERK_SECRET_KEY, {
          method: "PATCH",
          body: JSON.stringify({ public_metadata: { role } }),
        }),
      ]);
      if (!profileResponse.ok || !metadataResponse.ok) {
        const body = await (profileResponse.ok ? metadataResponse : profileResponse).json();
        return json({ error: body.errors?.[0]?.long_message || "成员修改失败" }, profileResponse.ok ? metadataResponse.status : profileResponse.status);
      }
      if (status === "disabled" && user.banned) {
        const unbanResponse = await clerkRequest(`/users/${encodeURIComponent(id)}/unban`, env.CLERK_SECRET_KEY, { method: "POST" });
        if (!unbanResponse.ok) return json({ error: "成员恢复失败" }, unbanResponse.status);
      }
      return json({ ok: true, id, role });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "待接受邀请的邮箱无效" }, 400);
    }
    const revokeResponse = await clerkRequest(`/invitations/${encodeURIComponent(id)}/revoke`, env.CLERK_SECRET_KEY, { method: "POST" });
    if (!revokeResponse.ok) return json({ error: "原邀请无法撤销" }, revokeResponse.status);
    const inviteResponse = await clerkRequest("/invitations", env.CLERK_SECRET_KEY, {
      method: "POST",
      body: JSON.stringify({
        email_address: email.trim().toLowerCase(),
        redirect_url: "https://www.level-grind.com",
        public_metadata: { role, displayName: cleanMemberName(name), invitedFrom: "Level Grind Settings" },
        notify: true,
      }),
    });
    const inviteBody = await inviteResponse.json();
    return inviteResponse.ok
      ? json({ ok: true, id: inviteBody.id, role, invitationReissued: true })
      : json({ error: inviteBody.errors?.[0]?.long_message || "新邀请发送失败" }, inviteResponse.status);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "成员修改失败" }, 401);
  }
}

function cleanMemberName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

export async function onRequestDelete({ request, env }) {
  try {
    await requireMemberManager(request, env);
    const { id } = await request.json();
    if (!id) return json({ error: "成员不能为空" }, 400);
    const user = await selectedUser(id, env);
    if (user) {
      if (memberManagerEmails(env).has(primaryEmail(user).toLowerCase())) {
        return json({ error: "成员管理账户不能删除" }, 409);
      }
      const response = await clerkRequest(`/users/${encodeURIComponent(id)}/ban`, env.CLERK_SECRET_KEY, { method: "POST" });
      return response.ok
        ? json({ ok: true, id, status: "disabled" })
        : json({ error: "成员访问权限撤销失败" }, response.status);
    }
    const response = await clerkRequest(`/invitations/${encodeURIComponent(id)}/revoke`, env.CLERK_SECRET_KEY, { method: "POST" });
    return response.ok
      ? json({ ok: true, id, status: "revoked" })
      : json({ error: "邀请撤销失败" }, response.status);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "成员删除失败" }, 401);
  }
}
