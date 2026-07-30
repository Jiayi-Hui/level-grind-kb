# Level Grind AskAI Demo Questions

## Recommended demo sequence

Use `内部数据` first so the audience can see what the two databases already
know. Use `混合` for the follow-up when current public evidence is useful.

### 1. Event DB

Question:

> 事件库里哪些 AI 基础设施相关 Claim 的 T+0 到 T+5 价格反应最强？请按正负方向分组，只使用有真实价格数据的记录。

Expected evidence:

- China IDC/AIDC pricing and ByteDance tender Claims;
- Microsoft Capex-rumor Claim;
- Alphabet earnings and Capex Claims;
- domestic AI-chip and AI-server-material Claims.

The answer should preserve missing horizons as unavailable rather than infer
returns.

### 2. AI Capex

Question:

> 按当前 IT MW 比较 Google、Meta、Microsoft、Amazon、xAI 和 Oracle。哪些业主仍有建设中项目？请把已运营容量和建设状态分开。

Expected evidence:

- the 75-campus Epoch AI baseline;
- owner, current IT MW, H100-equivalent, status, country, and observation date.

This dataset is an estimated campus-capacity baseline, not company-reported
Capex.

### 3. Cross-database question

Question:

> 哪些事件库 Claim 可以由 AI Capex 数据支持、质疑或部分验证？请逐条列出 Claim、可对应的业主或园区、能验证的部分、不能验证的部分，以及对应的价格反应。

Strongest current overlaps:

- Microsoft “Capex cut” rumor versus Microsoft campus capacity and construction
  footprint;
- Meta “compute oversupply versus financing/SPV” discussion versus Meta's
  operating and construction footprint;
- Alphabet Capex/FCF pressure and GCP growth Claims versus Google's campus IT
  MW, H100e, and construction footprint;
- China IDC/AIDC pricing Claims versus the VNET, Huawei, and Alibaba China
  campuses;
- domestic AI-chip shipment Claims versus the Huawei campus record, with a
  strict warning that campus H100-equivalent estimates cannot verify specific
  Huawei-chip shipment volumes.

### 4. Cross-database follow-up with public web

Switch to `混合` and ask:

> 对刚才识别出的 Microsoft、Meta 和 Alphabet Claim，补充最新公司披露或可靠公开资料。哪些结论得到加强，哪些仍然只是推断？

The useful output is a verification boundary, not a forced yes/no answer.

## Additional questions

### Event-only

- `比较7月1日IDC涨价口径、字节AIDC招标报价和7月10日新意网入住率Claim，市场反应是否一致？`
- `哪些Claim出现了T+0为正、但随后回撤？哪些是T+0为负、随后修复？`
- `Alphabet 7月23日的多条业绩Claim里，哪些属于经营数据，哪些属于市场解释？不要把同一价格反应重复计算成多个独立事件。`
- `把未经验证、缺少价格映射或缺少未来交易日的Claim单独列出。`

### AI Capex-only

- `哪些业主的当前IT MW最高，但建设中项目数量并不多？`
- `Oracle、SoftBank和G42的建设中项目与已有运营容量有什么差别？缺失值保持空白。`
- `中国园区目前覆盖了哪些业主？按IT MW排序，并说明这一数据能和不能代表什么。`
- `列出当前H100e和估算资本成本最高的十个园区，并标注观察日期。`

### Cross-database

- `事件库中的中国IDC涨价Claim，能否从VNET、Huawei和Alibaba园区容量看出需求背景？哪些环节仍缺价格或利用率证据？`
- `Alphabet业绩不错但因Capex/FCF压力下跌，这一解释与Google的现有容量和建设中园区是否一致？`
- `Meta算力过剩的担忧，AI Capex数据能验证“容量很大”，但能否验证“需求过剩”？还缺什么数据？`
- `国产AI芯片出货Claim与AI Capex中国园区之间有哪些可能联系？请明确区分直接证据和推断。`

## Claims the demo should not make

- Epoch AI campus estimates do not verify a company's reported accounting
  Capex.
- H100-equivalent does not prove the installed chip model or a specific domestic
  chip shipment volume.
- Campus capacity does not by itself establish utilization, demand, returns, or
  overcapacity.
- Multiple Claims tied to the same event and price window are not independent
  market reactions.
