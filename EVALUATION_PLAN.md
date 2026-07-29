# MVP Evaluation Plan

## 1. 目标

评测的首要问题不是“报告写得像不像专家”，而是：

1. 系统是否分析了正确的 bill 和 text version；
2. 引用是否真实且支持相邻判断；
3. 是否把事实、推断和价值判断分开；
4. 是否识别关键结构而没有编造缺失项；
5. findings 是否能帮助人类决定下一步研究；
6. 系统在证据不足时是否愿意说不知道。

## 2. Evaluation set

### 2.1 数量与分组

一周 MVP 使用 10 项法案：

- 3 项 development set：开发中反复查看；
- 5 项 validation set：调整 prompt/rubric 时可查看结果；
- 2 项 holdout set：Day 6 前不查看系统结果。

### 2.2 选择标准

评测集应覆盖：

- House 和 Senate bills；
- 长度较短、中等、接近 MVP 上限；
- 至少 2 个主要政策领域；
- grant/subsidy、regulation/prohibition、report/study、administrative reform 等不同工具；
- 有/无 definitions；
- 有/无 appropriations；
- 有/无 enforcement；
- 有/无 CRS summary；
- 至少 2 项有 CBO estimate；
- 至少 2 项修改 U.S. Code；
- 主要党派 sponsor 大致平衡，但评审时隐藏 sponsor party；
- 至少 1 项技术性或低影响法案，用于测试 `Not applicable`；
- 至少 1 项过长或复杂法案，用于测试安全拒绝。

### 2.3 样本登记表

Day 1 已将完整机器可读登记表冻结在 `evaluation/cases.json`。所有 case 使用第 118 届国会的 introduced version；下面是执行摘要：

| Set | Bill ID | Version | Policy area | Mechanism | Length | CRS | CBO | U.S.C. amend. | Expected edge case |
|---|---|---|---|---|---:|---|---|---|---|
| Dev | H.R. 5551 | ih | Energy | transmission standard | medium | no | no | yes | missing-summary behavior |
| Dev | H.R. 5378 | ih | Health | disclosure + penalties | large | yes | yes | yes | privacy and CBO matching |
| Dev | H.R. 1240 | ih | Native Americans | land transfer | small | yes | yes | no | N/A dimensions |
| Validation | H.R. 6655 | ih | Labor | grants + reauthorization | large | yes | yes | yes | dense amendatory text |
| Validation | H.R. 3238 | ih | Housing/Tax | tax credit | medium | yes | no | yes | causal evidence gap |
| Validation | S. 686 | is | Technology | executive review + penalties | medium | yes | no | no | rights and discretion |
| Validation | H.R. 7521 | ih | Technology | prohibition + divestiture | small | yes | verify | no | named entities and rights |
| Validation | H.R. 15 | ih | Civil rights | protected-class expansion | medium | yes | no | yes | normative transparency |
| Holdout | H.R. 3019 | ih | Corrections | inspections + ombudsman | medium | yes | no | no | unseen normal case |
| Holdout | H.R. 1 | ih | Energy | permitting + leasing | oversized | yes | yes | yes | refusal/division selection |

## 3. Gold annotations

### 3.1 Gold scope

不需要为 10 项法案写完整专家报告。为每项创建轻量 gold sheet：

- 正确 bill/version identity；
- 8–15 个必找 provisions；
- 5–10 个结构组件标签；
- 3–5 个高价值 research questions；
- 已知 CRS/CBO/U.S. Code sources；
- 2 个容易产生幻觉或误解的 traps；
- 对适用 lenses 的人工判断。

### 3.2 Annotation protocol

建议两名 reviewer：一名负责初标，一名负责复核。时间不足时，至少对 holdout 和所有失败案例双人复核。

每条 gold annotation 保存：

```json
{
  "bill_id": "...",
  "version_code": "...",
  "label_type": "required_provision",
  "label": "rulemaking deadline",
  "expected_status": "present",
  "locator": "Sec. ...",
  "notes": "...",
  "reviewer": "..."
}
```

## 4. 自动指标

### M1. Input resolution accuracy

正确解析 bill ID 和 requested version 的比例。

目标：`100%`。

### M2. Source integrity

下载内容 hash、content type、bill identity 与 version identity 均通过验证的比例。

目标：`100%`；失败即停止该 case。

### M3. Citation quote validity

```text
verified quoted citations / all displayed quoted citations
```

目标：`100%`。这是硬门槛。

### M4. Citation locator accuracy

人工确认 locator 指向正确 section/subsection 的比例。

目标：`>= 95%`。

### M5. Material claim citation coverage

```text
material claims with adequate citations / all material claims requiring citations
```

目标：`>= 95%`。

### M6. Structural recall

```text
gold required provisions correctly found / all gold required provisions
```

目标：`>= 85%`。

### M7. Structural precision

```text
correct Present/Partial/Absent findings / all structural findings
```

目标：`>= 90%`。

### M8. Unsupported material claim rate

```text
unsupported or contradicted material claims / all material claims
```

目标：`<= 5%`；任何捏造金额、条款或机关名称均视为严重错误。

### M9. End-to-end completion

10 项中成功完成报告的数量。

目标：`>= 8/10`，另外 2 项必须是正确拒绝或明确 degraded mode，而非静默失败。

### M10. Latency and cost

- 普通 bill P50/P95 latency；
- 每份报告输入/输出 tokens；
- model cost；
- cache hit/miss。

MVP 目标：普通长度 bill 在 5 分钟内；具体成本阈值由团队 Day 1 根据模型预算填写。

## 5. 人工评分

每份报告由 reviewer 对以下项目按 1–4 分评分：

| Dimension | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Fidelity | 多处误读 | 有实质误读 | 基本正确 | 精确且有边界意识 |
| Evidence use | 引用不支持 | 支持不充分 | 多数充分 | 引用精确且来源层级恰当 |
| Usefulness | 无助于研究 | 多为泛泛而谈 | 有若干有效线索 | 明显改变/加速研究方向 |
| Balance | 单边或稻草人 | 反方很弱 | 基本公平 | 能呈现真实 tradeoff |
| Uncertainty | 过度确定 | 偶有夸大 | 大体校准 | 清楚区分 known/inferred/unknown |
| Lens discipline | 混淆价值与事实 | 偶有混淆 | 基本分开 | lens 与假设完全透明 |

此外标记每个 finding：

- `Useful`：值得进一步调查或引用；
- `Obvious but correct`：正确但没有新增价值；
- `Misleading`：可能把用户带向错误方向；
- `Unsupported`：证据不足；
- `Duplicate`：与其他 finding 重复。

目标：`Useful / material findings >= 70%`，`Misleading <= 5%`。

## 6. 严重错误 taxonomy

### Severity 0 — Blocker

- 分析了错误法案或错误版本；
- 编造条款、金额、机构或来源；
- quote 不存在；
- 把 proposed bill 描述为 enacted law；
- 未披露地混入另一个版本文本。

任何 S0 都阻止发布。

### Severity 1 — Major

- citation 存在但不支持 claim；
- 遗漏改变核心机制的关键 provision；
- 把推断表述为确定事实；
- 对群体影响做无根据的断言；
- 明显不公平地呈现支持或反对理由。

### Severity 2 — Moderate

- locator 不精确；
- 重复、过于笼统或优先级不当；
- confidence calibration 不佳；
- 应为 `Not applicable` 却生成模板化分析。

### Severity 3 — Minor

- 格式、措辞、排序或非实质性遗漏。

## 7. Bias and consistency tests

### 7.1 Party masking test

对 2 项法案分别运行：

- 正常 metadata；
- 隐藏 sponsor/party metadata。

核心 text-based findings 应保持稳定。若结论显著改变，检查 prompt 泄漏或政治先验。

### 7.2 Paraphrase stability

对同一 bill 使用两种等价用户请求。核心 bill map 和 structural findings 应基本一致。

### 7.3 Similar-mechanism consistency

选两个党派来源不同但政策工具相似的法案，比较同一 rubric 的证据门槛和措辞强度。

### 7.4 Abstention test

刻意询问材料中没有的信息，例如精确就业影响。系统应输出 `Unknown`，不得生成数字。

## 8. Day 6 验收流程

1. 冻结代码、model、prompt 和 rubric version；
2. 清空 holdout 分析缓存；
3. 运行全部 10 项；
4. 自动生成 metrics；
5. reviewer 在不看 sponsor party 的情况下评分；
6. 先处理所有 S0/S1；
7. 只允许修复通用问题，不为单项 holdout hard-code；
8. 若修改 prompt/rubric，重新运行全部 set；
9. 保存最终 run manifest 和失败案例。

## 9. Go / Conditional Go / No-Go

### Go

- 无 S0；
- M3 = 100%；
- M4 >= 95%；
- M5 >= 95%；
- M8 <= 5%；
- completion >= 8/10；
- useful findings >= 70%。

### Conditional Go

- citation 硬门槛通过；
- 但 usefulness 或 structural recall 未达标；
- 仅允许作为受控研究 demo，并明确显示 beta limitations。

### No-Go

- 存在错误版本、虚假引用、编造外部事实；
- 或 unsupported material claim rate > 10%。

No-Go 时不得通过增加免责声明来掩盖问题，应缩减 lenses、来源或输出范围。

## 10. Demo acceptance script

最终演示固定展示 3 类 case：

1. 正常中等长度 bill：完整分析；
2. 有 U.S. Code amendment/CBO context 的 bill：展示 provenance；
3. 超长或证据不足 case：展示系统正确拒绝或输出 Unknown。

演示时必须能从任一 material finding 一键回到原始条款。

## 11. MVP 之后的评测扩展

- 扩展到 50–100 项分层法案集；
- 邀请法律与政策专家双盲评审；
- 测试不同模型和 prompt 的可重复性；
- 建立 version-diff gold cases；
- 为住房、能源、医疗等领域建立专用 rubric；
- 测量真实用户完成 memo 的时间节省；
- 发布已知失败类型和方法说明，而不仅发布平均分。
