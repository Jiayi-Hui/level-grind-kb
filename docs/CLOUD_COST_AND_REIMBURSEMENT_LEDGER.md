# Level Grind 云资源与报销台账

最后更新：2026-08-04（HKT）

> 本表记录 Level Grind 已启用或购买的云资源、试用到期日、预计费用和停用动作。金额以控制台账单为最终依据；未核实的项目不得作为报销金额提交。

## 当前资源

| 服务 | 账号/区域 | 当前状态 | 已确认费用 | 预计持续费用 | 复核或到期日 | 到期前动作 | 报销凭证 |
|---|---|---|---:|---:|---|---|---|
| Tencent EdgeOne Pages / Personal | Tencent Cloud 国际站；香港边缘网络 | 生产站点 `level-grind.com` 正在使用 | 待从订单核实 | 待从月账单核实 | 每月 25 日 | 核对套餐、流量和是否自动续费 | Billing Center 的订单、Invoice 和 Payment Record |
| TencentDB for PostgreSQL | 香港；实例 `postgres-peuru8zp` | Running；1 vCPU / 2 GiB / 10 GB；高可用 | 按量计费，无预付订单金额 | 前 15 天约 USD 0.1404/小时；其后页面显示约 USD 0.0704/小时，约 USD 51.4/月（按 730 小时估算），另有超额备份费 | 每月 25 日 | 核对实际小时费、备份和公网流量；不再使用时先备份再销毁 | PostgreSQL 实例账单、费用明细、Invoice |
| Serverless Cloud Function Personal Premium 试用 | 香港目标区域；账户级新用户试用 | 已开通 3 个月试用 | USD 0 | 试用期内额度内 USD 0；超额及 HTTP 响应流量可能按量计费 | **2026-11-04 11:46:20 HKT** | 2026-10-20 开始评估；最迟 2026-10-28 决定停用或继续。若继续使用，预计最低基础包约 USD 1.86/月，另加实际用量 | SCF Subscription 页面、月账单、Invoice |
| Tencent Container Registry Personal | 香港共享实例 | 已授权，正在初始化仓库 | USD 0 | USD 0（个人版无 SLA、有限额） | 每月 25 日 | 保留部署镜像；若迁移到其他运行环境再删除 | TCR 资源截图；官方免费说明 |
| Tencent VPC / 子网 / 安全组 | 香港 | `level-grind-hk-vpc`；数据库仅私网 5432 | USD 0 | 通常 USD 0 | 每月 25 日 | 检查没有误开公网入口、NAT 或固定公网 IP | 网络资源清单 |
| Cloudflare DNS | `level-grind.com` | 仅 DNS / 域名配置 | 待核实域名注册费；DNS 本身为免费方案 | 域名续费金额待注册商账单核实 | 域名到期前 30 天 | 核对域名续费和 nameserver 状态 | 域名注册商 Invoice |
| Clerk Auth | Level Grind production | 邀请制登录与成员身份 | 当前未发现付费订单 | 免费额度内 USD 0；超额按 Clerk 当期定价 | 每月 25 日 | 核对 MAU、短信/邮件和组织功能用量 | Clerk Billing 页面 |

## 费用提醒

- **2026-08-04 12:05 HKT：账户出现 USD 0.07 欠费。** TencentDB、EdgeOne 和 PostgreSQL 备份计划于 2026-08-05 12:05 HKT 停止；PostgreSQL 计划于 2026-08-12 12:05 HKT回收，EdgeOne 计划于 2026-10-04 12:05 HKT回收。必须充值使可用余额恢复为正，并在 Billing Center 核实资源恢复。
- **USD 50 月度 alert 仅作为预算提醒处理，不能视为自动充值成功。** 只有 Billing Center 明确显示正余额或有效的自动充值/扣款规则，才能解除欠费风险。
- 2026-08-25：首次月度核账，下载 Tencent Cloud 费用明细与 Invoice。
- 每月 25 日：核对 EdgeOne、TencentDB、SCF、COS/CLS（如启用）和 Clerk。
- 2026-10-20：开始评估 SCF 试用后的保留方案。
- 2026-10-28：完成 SCF 停用或续用决定，避免临近到期遗漏。
- 2026-11-04 11:46 HKT：SCF Premium 试用到期。

## 每次报销需要保存

1. Billing Center 月度账单或费用明细导出。
2. 对应订单与付款记录。
3. 带币种和税项的 Invoice。
4. 本表当月快照，解释资源用途和项目归属。
5. 若金额与估算不同，记录差异原因（流量、备份、日志、按量执行或汇率）。

## 安全与成本约束

- 不启用 SCF 固定公网出口 IP、NAT Gateway、TCR Enterprise、KMS Professional 或付费 CLS，除非先记录预估费用并获得确认。
- 数据库保持私网连接；只允许同 VPC 的 API 运行环境访问 5432。
- SCF 日志先使用最低必要保留期，防止 CLS 长期累积费用。
- 文件对象存储 COS 上线前，另行记录桶区域、容量、外网流量和生命周期规则。
