# AskAI 收藏跨设备持久化（Quick gate）

## Boundary

- 只复用既有、按 Clerk subject 隔离的 `/api/askai-history` Blob 记录；不新增团队共享收藏。
- 收藏的回答和 Chat 是快照，按同一账号跨设备可读；其他 Clerk 用户无法读取。
- 既有 `replace` / 本机历史迁移保留已有收藏，不会覆盖或清空。

## Acceptance

- `favorite-answer`、`favorite-chat`、`unfavorite` 均要求当前版本号，冲突时返回 409。
- `GET /api/askai-history?view=knowledge` 返回可直接展示的个人知识条目。
- 缺少 `favorites` 的旧记录读作空收藏，无需迁移或重新邀请。
- 通过 helper 行为测试、AskAI 合约测试、lint 与生产构建检查后才可进入后续 UI 接线。
