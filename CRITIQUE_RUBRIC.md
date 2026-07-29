# Bill Critique Rubric

## 1. 目的

本 rubric 用于生成可核验的研究线索，而不是替代法律、经济或政策专家判断。它规定：

- 系统可以提出什么问题；
- 每种判断需要什么证据；
- 什么时候必须输出 `Unknown` 或 `Not applicable`；
- 如何把事实、推断和价值判断分开；
- 如何避免党派化、虚假的确定性和“总分幻觉”。

## 2. 分析单位

分析对象必须是：

```text
{congress}-{bill_type}-{bill_number}-{text_version_code}
```

例如，一项 introduced version 和 engrossed version 是两个不同分析对象。任何 finding 都不得跨版本混用条款。

## 3. 证据等级

### E1 — Primary bill text

被分析版本的法案原文。适合证明法案包含什么、要求谁做什么、期限和定义是什么。

### E2 — Authoritative legal/context source

包括 CRS summary、U.S. Code、CFR、committee report、CBO cost estimate、GAO report 和官方统计。适合说明现行制度、预算影响或已知执行背景。

### E3 — High-quality external research

同行评审研究、可信研究机构的透明分析。MVP 仅在人工预先批准的来源中使用，不做开放网络自动 RAG。

### E4 — Model inference

基于 E1–E3 的推断，不是事实。必须解释推理链并标记不确定性。

### E5 — Normative judgment

依赖价值取舍的判断。必须指出采用的 lens，不能伪装成中立事实。

## 4. Claim 类型

| 类型 | 允许的证据 | 示例 |
|---|---|---|
| `textual_fact` | 必须有 E1 | “Sec. 4 要求年度报告。” |
| `legal_context` | E2，必要时 E1 | “该条修改 42 U.S.C. § …。” |
| `empirical_claim` | E2 或 E3 | “类似项目过去出现较高行政成本。” |
| `causal_inference` | E2/E3 + E4 | “该补贴可能增加供给。” |
| `risk_hypothesis` | E1 + E4，最好有 E2/E3 | “模糊定义可能扩大执行裁量。” |
| `normative_judgment` | 明示 lens + E1–E4 | “从 civil-liberties lens 看，该裁量缺乏保障。” |

最终报告不能把后四类改写成确定的文本事实。

## 5. Finding 评分方式

不计算 overall score。每个 finding 使用两个独立标签：

### 5.1 Assessment

- `strength`
- `risk`
- `tradeoff`
- `unknown`

### 5.2 Confidence

- `High`：结论直接由明确条文或高质量官方证据支持，合理替代解释很少；
- `Medium`：证据相关但需要推断，或存在可信替代解释；
- `Low`：证据有限、依赖重要假设，只适合作为进一步研究问题；
- `Unknown`：无法从当前证据负责任地判断。

置信度不是政策影响大小。影响大小不得在没有证据时推断。

## 6. Gate 0：法案地图

在 critique 前先提取：

- `stated_problem`
- `stated_objectives`
- `policy_instruments`
- `regulated_or_eligible_entities`
- `beneficiaries`
- `implementing_entities`
- `funding_and_authorization`
- `deadlines_and_effective_dates`
- `enforcement_and_remedies`
- `reporting_and_evaluation`
- `definitions`
- `amendments_and_cross_references`

如果无法识别核心政策机制，系统应停止深层效果推断，只提供文本地图和证据缺口。

## 7. Gate 1：结构完整性

### S1. Purpose and problem definition

问题：法案是否足够明确地表达对象、范围和目标，使实施者和评估者知道它要改变什么？

检查：

- findings/purpose 是否存在；
- operative provisions 是否与表述目标一致；
- 目标是否可观察或至少可解释。

注意：没有 findings clause 不自动构成缺陷；以 operative text 为准。

### S2. Definitions and scope

问题：关键术语、适用对象、地域和例外是否明确？

风险信号：循环定义、关键术语未定义、例外吞噬规则、跨 section 含义不一致。

### S3. Authority and responsibility

问题：谁被授权、谁负有义务、谁监督，是否明确？

风险信号：多个机关责任重叠、授权与义务不匹配、依赖未指定主体。

### S4. Funding and resources

问题：需要显著行政行动或支出的法案是否说明授权、拨款或资源来源？

必须区分：authorization of appropriations、mandatory spending、实际 appropriation。找不到 CBO estimate 时不得估算金额。

### S5. Timeline and transition

问题：effective date、rulemaking deadline、phase-in 和 legacy treatment 是否可执行？

### S6. Enforcement, review and remedies

问题：义务如何执行，是否存在处罚、申诉、豁免、judicial review 或监督？

不是每项法案都需要处罚；纯授权或纪念性法案通常为 `Not applicable`。

### S7. Measurement, reporting and learning

问题：是否能判断政策是否按计划实施并取得效果？

检查：baseline、metrics、data collection、reporting、independent review、sunset/review clause。

### S8. Amendments and legal coherence

问题：amendatory instructions、交叉引用和废止条款是否明确，是否提示与现行法律重叠或冲突？

MVP 只能做 issue spotting；没有加载完整相关法律时，输出 `Unknown`。

## 8. Policy critique dimensions

### P1. Policy responsiveness and evidence

核心问题：

- 法案针对的问题是否被清楚识别？
- 目标群体和问题机制是否匹配？
- 现有证据是否支持问题的重要性和所选干预方式？
- 是否遗漏明显的替代方案？

允许结论：问题—机制匹配、evidence gap、替代政策未被比较。

禁止：仅因为法案标题或 sponsor 声明就断言问题严重程度。

### P2. Likely effectiveness

核心问题：

- 政策工具是否能沿着可信的 theory of change 达到目标？
- 关键中间行为是否有激励或约束支持？
- 是否存在规避、替代效应或错误目标化？

输出至少包含一条简化 theory of change：

```text
legal mechanism -> actor response -> intermediate outcome -> intended outcome
```

没有外部证据时只能评价机制完整性，不得预测实际效果。

### P3. Implementation feasibility and state capacity

核心问题：

- 执行机关是否明确；
- 是否要求新的 rulemaking、IT、staff、data sharing 或 adjudication；
- 期限与任务规模是否匹配；
- federal/state/local/private actors 的责任是否协调；
- 是否创造重复报告、许可或审批层级。

### P4. Economic and administrative efficiency

核心问题：

- 明示的财政成本和收益是什么；
- 合规成本由谁承担；
- 是否存在更低成本的可行手段；
- 是否影响竞争、进入壁垒、小企业或创新；
- 是否产生明显的 deadweight、rent-seeking 或重复行政。

无 CBO 或可靠研究时，不输出净收益金额或精确数量级。

### P5. Distribution and social equity

核心问题：

- 谁获得直接和间接收益；
- 谁承担税收、价格、时间、合规或机会成本；
- 影响是否因收入、种族、性别、残障、年龄、地区或移民身份而不同；
- eligibility、documentation 或 digital access 是否造成排斥；
- 是否包含缓解措施。

不得从群体名称直接推断歧视。必须指出产生差异影响的文本机制或外部证据。

### P6. Rights, due process and bias risk

核心问题：

- 是否影响 speech、privacy、property、liberty、equal protection 或 access to benefits；
- 是否有 notice、hearing、appeal、reason-giving 和 review；
- 是否赋予宽泛裁量但缺乏标准；
- 自动化决策或数据使用是否有 audit、explanation 和 correction。

输出应使用“raises a question/risk”，除非有权威法律结论，不声称违宪或违法。

### P7. Abundance and supply capacity

此 lens 只在法案明显影响住房、能源、交通、医疗、劳动力、基础设施、创新或公共服务供给时适用。

核心问题：

- 是否增加或减少实物与服务供给；
- 是否降低或增加进入、建设、许可、采购和部署障碍；
- 是否解决关键投入约束；
- 是否只是增加需求而没有增加供给；
- 程序保障的边际收益是否可能伴随显著延误；
- 是否提高政府交付能力。

必须同时展示可能被简化程序削弱的公共利益保护，不能默认 deregulation 等于 abundance。

### P8. Coherence, externalities and durability

核心问题：

- 与现有联邦项目或州政策是否重复、冲突或互补；
- 是否把成本转移给未被考虑的群体或未来时期；
- 是否设置 review、sunset、indexing 或适应机制；
- 定义和阈值是否容易因技术或市场变化而过时。

MVP 如果只加载部分法律上下文，coherence 结论默认最高为 `Medium` confidence。

## 9. Applicability rules

每个 dimension 先做适用性判断：

```json
{
  "dimension": "abundance_supply_capacity",
  "status": "applicable | not_applicable | unknown",
  "rationale": "...",
  "citations": []
}
```

- `not_applicable` 不参与结果数量或任何聚合；
- 不允许为了填满模板而生成低相关 finding；
- 纪念性命名法案、单纯延长日期法案和技术修正法案应使用缩短版 rubric；
- omnibus bills 在 MVP 中应拒绝，或要求用户选择 division/title。

## 10. Counterargument protocol

每个 `risk` 和 `strength` finding 都应尝试生成：

1. 最强的善意替代解释；
2. 哪条证据会改变当前判断；
3. 是否存在 strength–risk tradeoff。

Counterargument 不能凭空引入事实。没有证据时应写成假设条件。

## 11. Citation rules

- 法案文本 claim 必须引用 section/subsection 和 source URL；
- quote 必须是 source snapshot 中可精确匹配的连续文本；
- 为提高可读性可省略无关文字，但必须标记省略；
- 外部事实必须有独立 source citation；
- citation 不得仅指向搜索结果页；
- 一个 citation 必须实际支持相邻 claim；
- 模型输出 quote 后，程序必须进行 exact/normalized match；
- 验证失败的 finding 不得进入主报告；可进入“unverified draft”日志。

## 12. Bias controls

- 分析 prompt 不输入 sponsor party，除非用户明确研究政治过程；
- 不根据 bill title 的价值性语言作结论；
- 支持和反对理由采用相同证据门槛；
- 对相似机制的法案使用相同 rubric；
- 评测集应平衡主要党派 sponsor 和不同政策工具；
- 人工 reviewer 在评分 usefulness 前尽量不看 sponsor party；
- 记录不同模型运行间结论是否因非实质性政治线索变化。

## 13. 最终质量检查

报告发布前逐项检查：

- [ ] bill identity 与 text version 正确；
- [ ] 没有把提案称为现行法律；
- [ ] 每个 material textual claim 有 E1；
- [ ] 每个 material empirical claim 有 E2/E3；
- [ ] 推断和价值判断已明确标记；
- [ ] quote 已通过 snapshot match；
- [ ] `Absent` 已解释适用性；
- [ ] 金额和数量没有由模型自行估算；
- [ ] 至少呈现一个强反论证或说明为何没有；
- [ ] limitations 与 evidence gaps 已展示。

## 14. Rubric versioning

每份报告保存：

- `rubric_version`
- `prompt_version`
- `model_id`
- `generated_at`
- `source_snapshot_ids`
- `selected_lenses`

rubric 修改后不得静默覆盖旧结果；需要重新生成或明确显示版本差异。

## 15. 方法论参考

- [OECD: Better Criteria for Better Evaluation](https://www.oecd.org/en/publications/2019/12/better-criteria-for-better-evaluation_f7a307eb.html)
- [OECD: Regulatory Impact Assessment](https://www.oecd.org/en/publications/regulatory-impact-assessment_7a9638cb-en.html)
- [GAO: Program Evaluation — Key Terms and Concepts](https://www.gao.gov/products/gao-21-404sp)
- [CBO: Cost Estimates Explained](https://www.cbo.gov/system/files/2020-02/56166-CBO-cost-estimates.pdf)
