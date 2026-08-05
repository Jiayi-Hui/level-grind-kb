import {
  clerkIdentity,
  sharedDbConfigured,
  supabaseRequest,
} from "./_shared-auth.js";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

function cleanText(value, maxLength) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function cleanPayload(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    claimDateStart: cleanText(payload.claimDateStart, 10),
    claimTimeHkt: cleanText(payload.claimTimeHkt, 40),
    speaker: cleanText(payload.speaker, 120),
    entity: cleanText(payload.entity, 200),
    ticker: cleanText(payload.ticker, 120),
    title: cleanText(payload.title, 500),
    originalClaim: cleanText(payload.originalClaim, 8000),
    fundamentalValidationStatus: ["unreviewed", "supporting", "mixed", "challenged"].includes(payload.fundamentalValidationStatus) ? payload.fundamentalValidationStatus : "unreviewed",
    fundamentalValidationNotes: cleanText(payload.fundamentalValidationNotes, 20_000),
    validationNextCheck: cleanText(payload.validationNextCheck, 1_000),
  };
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : "SHARED_DB_ERROR";
  if (message.startsWith("AUTH_")) return json({ error: "请重新登录后再试" }, 401);
  if (message === "SHARED_DB_NOT_CONFIGURED") {
    return json({ error: "共享数据库正在接入，当前为只读模式", code: message }, 503);
  }
  return json({ error: "共享数据库暂时不可用", code: message }, 503);
}

export async function onRequestGet({ request, env }) {
  try {
    await clerkIdentity(request, env);
    if (!sharedDbConfigured(env)) {
      return json({ configured: false, overlays: [] });
    }
    const response = await supabaseRequest(
      env,
      "team_claim_overlays?select=source_claim_id,operation,payload,version,updated_at&order=updated_at.desc",
      { headers: { Prefer: "count=exact" } },
    );
    const body = await response.json();
    if (!response.ok) return json({ error: "无法读取共享 Claim", detail: body }, response.status);
    return json({
      configured: true,
      overlays: body.map((row) => ({
        sourceClaimId: row.source_claim_id,
        operation: row.operation,
        payload: row.payload,
        version: row.version,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function mutate(request, env, forcedOperation) {
  try {
    const actor = await clerkIdentity(request, env);
    const input = await request.json();
    const sourceClaimId = cleanText(input.sourceClaimId, 180);
    const operation = forcedOperation || (
      String(input.operation) === "add" ? "add" : "update"
    );
    const payload = operation === "delete" ? {} : cleanPayload(input.payload);
    if (!sourceClaimId || (operation !== "delete" && (!payload.claimDateStart || !payload.originalClaim))) {
      return json({ error: "Claim 日期、内容和标识不能为空" }, 400);
    }
    const expectedVersion = Number.isInteger(input.expectedVersion)
      ? input.expectedVersion
      : 0;
    const response = await supabaseRequest(env, "rpc/mutate_team_claim_overlay", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        p_source_claim_id: sourceClaimId,
        p_operation: operation,
        p_payload: payload,
        p_expected_version: expectedVersion,
        p_actor_auth_subject: actor.subject,
        p_actor_email: actor.email,
        p_actor_name: actor.name,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      const conflict = String(body.message || "").includes("LG_CONFLICT");
      return json({
        error: conflict ? "这条 Claim 已被其他成员更新，请刷新后重试" : "共享 Claim 保存失败",
        detail: body,
      }, conflict ? 409 : response.status);
    }
    return json({
      ok: true,
      overlay: {
        sourceClaimId: body.source_claim_id,
        operation: body.operation,
        payload: body.payload,
        version: body.version,
        updatedAt: body.updated_at,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  return mutate(request, env, null);
}

export async function onRequestDelete({ request, env }) {
  return mutate(request, env, "delete");
}
