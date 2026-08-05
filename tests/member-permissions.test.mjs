import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("lets every signed-in member read the directory while reserving mutations for managers", async () => {
  const [api, edgeUi, workspace] = await Promise.all([
    readFile(new URL("../public/cloud-functions/api/invitations.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(api, /const currentUser = await requireSignedInUser\(request, env\)/);
  assert.match(api, /canManage: managers\.has\(currentUser\.currentEmail\)/);
  assert.match(api, /LEVEL_GRIND_PRIMARY_PM_EMAIL/);
  assert.equal((api.match(/await requireMemberManager\(request, env\)/g) || []).length, 3);

  assert.match(edgeUi, /setCanManage\(Boolean\(payload\.canManage\)\)/);
  assert.match(edgeUi, /\{canManage && \(/);
  assert.match(edgeUi, /canManage && !member\.protectedManager/);

  assert.match(workspace, /isAdmin && !member\.protected_manager/);
  assert.match(workspace, /\{isAdmin && <form key=\{editingMember\?\.email/);
});
