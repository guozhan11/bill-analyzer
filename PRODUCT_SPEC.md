# Bill Critique MVP — Product Specification

## 1. 文档状态

- 产品：美国联邦法案证据化评析工具
- 交付目标：7 个自然日内完成可演示 MVP
- 目标版本：`v0.1`
- 主要数据源：Congress.gov
- 本版本不是法律意见、投票建议或自动立法工具

## 2. 产品命题

用户输入一个 Congress.gov 法案 URL，或输入 `congress + bill type + bill number`，系统针对一个明确的文本版本生成一份可核验的 critique：

1. 用通俗语言说明法案要解决的问题和采用的政策机制；
2. 检查实施所需的关键组成部分是否存在；
3. 从政策回应性、行政可执行性、经济效率、分配公平、权利风险、abundance/state-capacity 等视角提出分析；
4. 为每个重要判断提供法案条款或外部材料的直接引用；
5. 明确区分文本事实、外部证据、推断、价值判断和未知事项；
6. 同时呈现主要支持理由、主要反对理由和证据缺口。

产品不回答“这个法案客观上好不好”。它回答的是：“在明确的评价标准和现有证据下，这个法案有哪些优势、风险和未知事项？”

## 3. 第一用户与核心任务

### 3.1 第一用户

MVP 优先服务：需要快速初步审查联邦法案的政策研究者、记者、倡议组织研究人员和公共政策学生。

暂不优先服务：国会立法起草人员、诉讼律师、企业合规部门、游说团队和普通选民的大规模消费产品。

### 3.2 Job to be done

> 当我拿到一项陌生的联邦法案时，我希望在 10 分钟内得到一份有条款引用、能看到不同观点、并能告诉我还需要查什么的初步分析，以便决定下一步是否值得投入人工研究。

### 3.3 核心用户流程

1. 用户提交 Congress.gov URL 或法案标识；
2. 系统列出可用文本版本，并默认选择 introduced version；
3. 用户确认或切换版本；
4. 系统展示法案身份、文本版本、发布日期和数据更新时间；
5. 系统生成法案地图、结构检查、多视角 critique 和证据缺口；
6. 用户展开每个 finding，查看引用、推理、反论证和置信度；
7. 用户复制或导出 Markdown 报告。

## 4. MVP 功能范围

### 4.1 必须完成（P0）

- 解析常见 Congress.gov bill URL 和法案编号；
- 通过 Congress.gov API 获取 bill metadata、subjects、summaries 和 text-version links；
- 获取并缓存一个指定版本的 XML、HTML 或 TXT 法案文本；
- 按 title、section、subsection 保留结构地解析文本；
- 提取以下法案地图字段：
  - stated purpose；
  - covered entities / beneficiaries；
  - implementing agencies；
  - policy instruments；
  - deadlines；
  - authorizations / appropriations；
  - enforcement / penalties；
  - reporting / evaluation；
  - amendments and cross-references；
- 按 `CRITIQUE_RUBRIC.md` 生成 applicable dimensions；
- 每个 finding 输出 claim、evidence、reasoning、counterargument、confidence 和 evidence gap；
- 引用精确到法案 section/subsection；
- 对没有充分证据的问题输出 `Unknown`，不补造结论；
- 生成 Markdown 报告；
- 保留生成时间、模型版本、prompt/rubric 版本和 source snapshot。

### 4.2 尽力完成（P1）

- 自动获取 CRS summary；
- 自动识别法案直接引用的 U.S. Code sections，并按需加载相关条文；
- 若 Congress.gov 页面提供 CBO cost estimate 链接，加载其摘要或正文；
- introduced version 与一个后续版本的 section-level diff；
- 简单 Web UI；
- 用户选择 2–3 个 lens，而不是固定展示全部 lens。

### 4.3 明确不做（Non-goals）

- 不生成或改写 legislative language；
- 不预测通过概率、投票结果或法院判决；
- 不给法案、议员或政党一个“社会价值总分”；
- 不分析 sponsor 动机或人格；
- 不基于党派标签推断政策质量；
- 不自动生成 lobbying strategy、comment letter 或 campaign content；
- 不覆盖州、地方、欧盟或全球立法；
- 不建设完整 U.S. Code、CFR、case law 或学术论文数据库；
- 不承诺法律检索的完整性；
- 不把 introduced bill 当成现行法律。

## 5. 产品输出

### 5.1 Report header

- Bill ID、official title、Congress；
- 分析的 text version code、version date；
- legislative status；
- 数据抓取时间；
- 明示免责声明。

### 5.2 Executive map

- 法案目标；
- 核心机制；
- 主要受影响群体；
- 执行机关；
- 关键日期与资金；
- 三项最重要的潜在优势；
- 三项最重要的风险或未知事项。

### 5.3 Structural completeness

每一项只允许以下结果：

- `Present`：文本明确包含；
- `Partial`：存在但不完整或依赖外部决定；
- `Absent`：对本法案适用但没有找到；
- `Not applicable`：本类法案不需要；
- `Unknown`：现有材料不足。

`Absent` 不自动等于缺陷，分析必须解释为什么该组件在本法案中应当存在。

### 5.4 Multi-lens critique

MVP 默认展示：

1. Policy responsiveness and evidence；
2. Implementation and state capacity；
3. Economic and administrative efficiency；
4. Distribution, equity and rights；
5. Abundance and supply capacity。

这是用户界面的 5 个综合 lens；分析引擎内部仍按 `CRITIQUE_RUBRIC.md` 的 8 个 policy dimensions 运行。映射如下：

| UI lens | Internal rubric dimensions |
|---|---|
| Responsiveness and evidence | P1 + P2 |
| Implementation and state capacity | P3 |
| Economic and administrative efficiency | P4 |
| Distribution, equity and rights | P5 + P6 |
| Abundance and supply capacity | P7，并吸收适用的 P8 findings |

P8 中不能自然归入上述 lens 的 coherence/durability finding 放入“Cross-cutting risks”。只运行适用维度。每个内部维度最多输出 3 个 material findings，综合展示时再去重和排序，避免用大量低价值观点稀释信号。

### 5.5 Finding schema

```json
{
  "id": "implementation-01",
  "dimension": "implementation_feasibility",
  "assessment": "risk",
  "claim": "The bill assigns a new reporting duty but does not specify a deadline.",
  "claim_type": "textual_fact",
  "bill_citations": [
    {"section": "Sec. 4(b)", "quote": "...", "source_url": "..."}
  ],
  "external_citations": [],
  "reasoning": "A duty without a deadline may be difficult to monitor and enforce.",
  "counterargument": "The implementing agency may set a deadline through guidance.",
  "confidence": "high",
  "evidence_gap": "No implementing regulation exists because the measure is only proposed."
}
```

## 6. 信息架构与最小界面

单页即可：

1. 输入框；
2. bill/version identity banner；
3. processing/error state；
4. executive map；
5. structural checklist；
6. lens tabs；
7. expandable citations；
8. sources and limitations；
9. export Markdown。

不需要账号、协作、通知、监控、支付、复杂 dashboard 或后台管理界面。

## 7. 技术流程

```text
Bill input
  -> Congress.gov resolver
  -> source snapshot/cache
  -> structure-aware parser
  -> bill map extractor
  -> targeted retrieval
  -> rubric analyzers
  -> citation verifier
  -> report composer
  -> UI / Markdown
```

建议把分析拆成小型结构化调用，而不是一个超长 prompt：

1. `extract_bill_map`
2. `classify_applicability`
3. `analyze_dimension`（逐维度）
4. `generate_counterarguments`
5. `verify_citations`
6. `compose_report`

所有步骤必须输出 JSON schema；schema 失败时重试一次，仍失败则标记该部分不可用。

## 8. 安全、信任与表述规则

- 页面顶部显示：这是政策研究辅助工具，不是法律意见；
- 每次分析必须绑定具体 text version；
- 所有直接引语必须来自缓存的 source snapshot；
- 无引用的外部事实不得进入最终报告；
- 明确标注 `textual fact`、`external evidence`、`inference`、`normative judgment`；
- 不用 sponsor party、州或意识形态作为质量判断证据；
- 对受保护群体的影响必须有文本机制或外部证据支撑；
- 缺乏成本估算时只能说“未找到可靠估算”，不能自行生成金额；
- 对可能的宪法问题只标记 issue-spotting，不声称违宪；
- 保存来源 URL、抓取时间和内容 hash，确保结果可复现。

## 9. 一周交付计划

### Day 1 — Contract and skeleton

- 锁定 P0、数据 schema、finding schema；
- 建立最小应用骨架和环境配置；
- 选定 10 个候选法案、3 个开发法案；
- 取得 Congress.gov API key。

### Day 2 — Ingestion

- 完成 bill resolver、metadata/text version 获取；
- 实现 source cache、snapshot metadata 和错误处理；
- 用 3 个开发法案验证抓取。

### Day 3 — Parsing and bill map

- 完成 section-aware parser；
- 输出 bill map 和 structural checklist；
- 人工检查 3 个开发法案。

### Day 4 — Critique pipeline

- 实现 applicability 与 5 个默认 lenses；
- 强制 finding JSON schema；
- 加入 counterargument、confidence、Unknown。

### Day 5 — Citations and UI

- 实现 quote-to-source verification；
- 建立单页结果 UI；
- 支持 Markdown export。

### Day 6 — Evaluation and fixes

- 跑完 10 项评测集；
- 修复 citation、parsing 和 unsupported claims；
- 冻结 rubric/prompt 版本。

### Day 7 — Acceptance and demo

- 按 `EVALUATION_PLAN.md` 进行人工验收；
- 完成 3 个演示法案；
- 记录已知限制和失败案例；
- 发布本地或受控 demo。

## 10. MVP 验收标准

必须同时满足：

- 10 项评测法案中至少 8 项能够完成端到端分析；
- 被展示的法案引语 100% 可在 snapshot 中找到；
- section/subsection 定位准确率不低于 95%；
- material claims 的 citation coverage 不低于 95%；
- unsupported material claim rate 不高于 5%；
- 不存在把 bill 错称为 enacted law 的情况；
- 不存在把一个版本的条款归给另一个版本的情况；
- 人工评审认为至少 70% 的 material findings 对下一步研究“有用”；
- 单项普通长度法案在 5 分钟内返回，超长 omnibus bill 可拒绝并解释原因。

## 11. 一周后的决策门

MVP 不是“产品完成”，而是验证以下假设：

1. 结构化 rubric 是否比通用总结提供更多研究价值；
2. 模型能否稳定地把判断绑定到正确条款；
3. 多视角输出是否比单一总分更可信；
4. 用户是否愿意用它决定下一步人工研究方向。

如果 citation correctness 或 unsupported-claim rate 不达标，下一阶段优先修复 grounding，不增加数据源和功能。如果准确性达标但用户认为 findings 太泛，则优先缩小到一个政策领域并加入 domain-specific rubric。

## 12. 参考资料

- [Congress.gov API](https://api.congress.gov/)
- [Congress.gov API GitHub](https://github.com/LibraryOfCongress/api.congress.gov)
- [About CRS Bill Summaries](https://www.congress.gov/help/bill-summaries)
- [About Legislation and Law Text](https://www.congress.gov/help/legislation-text)
- [Statt policy intelligence platform](https://statt.com/)
- [OECD evaluation criteria](https://www.oecd.org/en/publications/2019/12/better-criteria-for-better-evaluation_f7a307eb.html)
