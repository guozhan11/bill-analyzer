# Data Sources and Ingestion Design

## 1. 一周 MVP 原则

本项目不在第一周建立完整“美国法律法规数据库”。MVP 采用两层数据策略：

1. **必备核心**：指定版本的 bill text 与 Congress.gov metadata；
2. **按需上下文**：CRS summary、法案直接引用的 U.S. Code sections，以及容易获得的 CBO estimate。

CFR、case law、完整 hearings、开放网络新闻和学术论文留到 MVP 之后。这样可以把工程时间集中在结构解析、引用正确性和 critique 方法上。

## 2. 来源优先级

| 优先级 | 来源 | MVP 用途 | 摄取方式 |
|---|---|---|---|
| P0 | Congress.gov API | bill identity、版本、actions、subjects、summaries | API |
| P0 | Congress.gov/GPO bill text | 被分析的权威文本 | API 返回的 format URL |
| P1 | CRS bill summary | 现行法律变化的非党派说明 | Congress.gov API |
| P1 | U.S. Code / OLRC | 解析被明确引用或修改的现行法 | 按需下载 XML/XHTML |
| P1 | CBO cost estimate | 财政和 mandate 背景 | bill link / CBO page，尽力获取 |
| P2 | Committee reports | legislative context | MVP 后 |
| P2 | GAO/CRS reports | 实施和历史证据 | 人工精选，MVP 后自动化 |
| P2 | eCFR/CFR | 监管实施背景 | MVP 后 |
| P3 | hearings/comments/news/research | stakeholders 和经验背景 | MVP 后，经来源治理 |

## 3. Congress.gov API

### 3.1 基础信息

- Base URL：`https://api.congress.gov/v3`
- 需要 data.gov API key；
- JSON 和 XML 均可，客户端必须显式请求格式；
- 官方文档公布的 rate limit 为每小时 5,000 次请求；
- 单页默认 20 条，最大 250 条；
- 列表接口使用 offset pagination。

参考：[Congress.gov API](https://api.congress.gov/) 与 [official GitHub repository](https://github.com/LibraryOfCongress/api.congress.gov)。

### 3.2 MVP endpoints

```text
GET /bill/{congress}/{billType}/{billNumber}
GET /bill/{congress}/{billType}/{billNumber}/text
GET /bill/{congress}/{billType}/{billNumber}/summaries
GET /bill/{congress}/{billType}/{billNumber}/subjects
GET /bill/{congress}/{billType}/{billNumber}/actions
```

必要时：

```text
GET /bill/{congress}/{billType}/{billNumber}/committees
GET /bill/{congress}/{billType}/{billNumber}/amendments
GET /bill/{congress}/{billType}/{billNumber}/relatedbills
```

### 3.3 Bill input normalization

统一内部 ID：

```text
bill:{congress}:{bill_type}:{bill_number}
```

`bill_type` 使用 API 接受的小写代码，例如 `hr`、`s`、`hjres`、`sjres`。输入解析器必须：

- 接受 Congress.gov URL；
- 接受 `H.R. 1234`, `HR1234`, `S. 42`；
- 当 congress 缺失时要求调用方提供，不能静默猜测；
- 拒绝 resolution 类型或在 UI 中明确其不同法律效果；
- 保留 API 返回的 canonical URL。

## 4. Bill text acquisition

### 4.1 Version identity

每个 text version 保存：

```json
{
  "bill_id": "bill:119:hr:1234",
  "version_code": "ih",
  "version_name": "Introduced in House",
  "date": "YYYY-MM-DD",
  "formats": {
    "xml": "https://...",
    "html": "https://...",
    "txt": "https://...",
    "pdf": "https://..."
  }
}
```

MVP 默认选择 introduced version，但用户必须在结果页看到并能确认版本。不能把 latest version 与 introduced version 隐式混用。

### 4.2 Format preference

优先级：

1. USLM/XML；
2. HTML；
3. TXT；
4. PDF 仅作为最后 fallback。

Congress.gov 说明，TXT 可能丢失准确阅读所需的格式信息，而 PDF 更适合打印展示；部分文本提供 USLM XML。因此解析优先使用结构格式，同时保留原始文件。[Legislation text formats](https://www.congress.gov/help/legislation-text)

### 4.3 Snapshot requirements

下载后不可只保留清洗文本。每个 source 保存：

- raw body；
- normalized body；
- source URL；
- fetched timestamp；
- HTTP content type；
- SHA-256 hash；
- parser version；
- upstream update date（若有）；
- retrieval status/error。

报告引用绑定 snapshot ID，而不是只绑定活动 URL。

## 5. Structure-aware parsing

### 5.1 Canonical node

```json
{
  "node_id": "bill:119:hr:1234:ih:sec-4:b:2",
  "bill_id": "bill:119:hr:1234",
  "version_code": "ih",
  "node_type": "subsection",
  "label": "(2)",
  "heading": null,
  "citation": "Sec. 4(b)(2)",
  "text": "...",
  "parent_id": "bill:119:hr:1234:ih:sec-4:b",
  "ordinal": 2,
  "source_snapshot_id": "sha256:...",
  "char_start": 12345,
  "char_end": 12890
}
```

### 5.2 Required node types

- document/division/title/subtitle；
- section/subsection/paragraph/subparagraph；
- heading；
- definition；
- table/list；
- note；
- amendatory instruction；
- quoted statutory text。

### 5.3 Chunking

向模型提供的 chunk 以法律节点为边界，不按固定 token 硬切。每个 chunk 附带：

- bill/version identity；
- 完整祖先 headings；
- section citation；
- 本 section 中适用的 definitions；
- 相邻节点的最少上下文；
- cross-reference list。

超长 section 可以按 subsection 切分，但不得把一个定义或 amendatory instruction 与其对象拆开。

## 6. U.S. Code context

美国法典由 House Office of the Law Revision Counsel 发布，并提供 current release point 的 XML/XHTML/PDF 下载。[U.S. Code downloads](https://uscode.house.gov/download/download.shtml)

MVP 不下载并索引全部法典。流程是：

1. 从 bill text 提取 `title + U.S.C. section` 引用和 amendatory instructions；
2. 标准化为 `usc:{title}:{section}`；
3. 仅加载被直接引用的 sections；
4. 保存 U.S. Code release point 和 currency metadata；
5. 将“当前法典文本”和“法案拟修改文本”分开呈现；
6. 未能可靠解析引用时，把 legal coherence 标记为 `Unknown`。

注意：U.S. Code 只收录一般和永久法律，且 source law 与 codified law 的关系可能复杂。MVP 不宣称完成完整法律效力分析。

## 7. CRS summaries

CRS summaries 可用于：

- 验证模型是否正确理解主要 provisions；
- 提供法案如何改变现行法律的背景；
- 为普通用户提供独立的非党派摘要。

不得把 summary 当作完整法案文本，也不得引用 summary 来证明原文中不存在某项条款。Congress.gov 说明，第 119 届国会因资源限制主要为 introduced versions 发布 summaries；因此缺失 summary 是正常状态。[About CRS Bill Summaries](https://www.congress.gov/help/bill-summaries)

## 8. CBO cost estimates

CBO cost estimate 可支持：

- direct spending、revenues 和 discretionary spending 背景；
- intergovernmental/private-sector mandates；
- 估算方法和不确定性。

CBO 通常为经 full committee approved 的法案制作 cost estimate，因此 introduced bill 没有 estimate 并不异常。[CBO processes](https://www.cbo.gov/about/processes)

MVP 规则：

- 找到与 bill/version 匹配的 estimate 才可使用；
- 保存 estimate date 和对应 legislative status；
- 如果 estimate 针对 amended/reported version，不得直接归给 introduced version；
- 未找到时显示“未找到匹配的 CBO estimate”，不生成自有财政数字。

## 9. Storage model

一周 MVP 可以使用 PostgreSQL，若只做单机 demo 也可使用 SQLite。向量数据库不是 P0；单项法案和少量上下文可以用结构过滤 + full-text search。

最小表：

```text
bills
bill_versions
source_snapshots
legal_nodes
cross_references
analysis_runs
findings
citations
evaluation_labels
```

关键约束：

- `bill_versions` 对 `(bill_id, version_code, source_hash)` 唯一；
- `findings` 必须关联 `analysis_run_id`；
- `citations` 必须关联 `source_snapshot_id` 和字符范围；
- 删除或更新上游内容不能破坏历史报告；
- API key 仅存在服务端环境变量，不写入仓库或浏览器。

## 10. Retrieval design

### 10.1 MVP retrieval

每个 rubric dimension 使用：

1. metadata filter：锁定 bill/version；
2. structure filter：优先 definitions、funding、enforcement 等相关节点；
3. lexical search：法定关键词和 rubric query；
4. optional embeddings：只用于候选召回，不直接决定引用；
5. rerank：保留少量完整节点；
6. answer only from supplied nodes。

### 10.2 Recommended query packs

- Funding：`authorize`, `appropriation`, `amounts`, `fund`, `grant`；
- Enforcement：`penalty`, `violation`, `liable`, `enforce`, `review`；
- Timeline：`effective`, `not later than`, `within`, `deadline`；
- Evaluation：`report`, `study`, `evaluation`, `audit`, `data`；
- Definitions：`means`, `includes`, `term`；
- Implementation：`Secretary`, `Administrator`, `shall issue regulations`；
- Rights：`notice`, `hearing`, `appeal`, `privacy`, `disclosure`。

关键词只做召回，不能作为最终判断。

## 11. Provenance and citation verification

引用对象：

```json
{
  "source_snapshot_id": "sha256:...",
  "node_id": "...",
  "locator": "Sec. 4(b)(2)",
  "quote": "...",
  "char_start": 12345,
  "char_end": 12480,
  "source_url": "https://...",
  "verified": true
}
```

验证顺序：

1. exact string match；
2. whitespace/punctuation normalized match；
3. 若仍失败，拒绝 citation；
4. citation 失败的 material finding 不展示。

不能依赖模型自行声称“citation verified”。验证必须由确定性代码完成。

## 12. Error handling

- API 404：显示 bill identifier 无效；
- API 429：指数退避，并尊重 retry headers；
- 无 text version：只显示 metadata，不生成 critique；
- XML parse failure：fallback HTML/TXT，并降低 parsing confidence；
- 文本过长：要求用户选择 division/title，不能静默截断；
- source mismatch：停止分析并记录；
- external source 不可用：继续 core bill-text analysis，显示 degraded mode。

## 13. 数据新鲜度

- 每次请求先检查缓存；
- current Congress 的 bill metadata 可设置短 TTL，例如 6 小时；
- 已下载的特定 text version 按 hash 视为 immutable snapshot；
- 每日 demo 不需要全量同步；
- UI 显示 `last_checked_at` 和 version date；
- API schema 变更应通过 adapter 隔离，关注官方 changelog。

## 14. MVP 后的数据扩展顺序

只有在核心评测通过后，按以下顺序扩展：

1. 全量 U.S. Code 与 cross-reference graph；
2. committee reports 和完整 CBO linkage；
3. GAO/CRS domain collections；
4. eCFR/CFR；
5. hearings 和 stakeholder positions；
6. curated academic research；
7. state legislation。

扩展一个来源前先定义：authority、coverage、freshness、licensing、versioning、citation granularity 和 evaluation cases。

## 15. 参考资料

- [Congress.gov API](https://api.congress.gov/)
- [Congress.gov API documentation repository](https://github.com/LibraryOfCongress/api.congress.gov)
- [Congress.gov legislation text guidance](https://www.congress.gov/help/legislation-text)
- [Congress.gov bill summaries](https://www.congress.gov/help/bill-summaries)
- [U.S. Code downloads — Office of the Law Revision Counsel](https://uscode.house.gov/download/download.shtml)
- [USLM User Guide](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf)
- [CBO processes](https://www.cbo.gov/about/processes)
- [CBO cost estimates explained](https://www.cbo.gov/system/files/2020-02/56166-CBO-cost-estimates.pdf)
