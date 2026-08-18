# Evidergy CarbonOps MVP：完整代码实施说明

版本：0.1.0  
依据：2026-08-08 商业计划书与可行性分析  
产品边界：澳洲商业园区单一连接点（PCC）的只读式能源、资产证据、概率预测与 Scope 2 运营计量平台。

## 1. MVP 的目标与不做事项

MVP 必须让真实用户完成一条闭环：登录 → 选择有权限的园区 → 判断数据是否可信 → 查看实时能量流 → 查看 1/6/12/24 小时概率预测 → 查看 PV/BESS 异常证据 → 由人工确认或调查 → 导出可复算的月度 Scope 2 记录。

第一版必须遵守四条硬边界：

1. 只读接入，不向 EMS、PCS、BMS、逆变器或 SCADA 下发控制命令。
2. “异常候选、健康分、可能原因排序”不表述为确定性根因。
3. Scope 2 是可追溯运营估算，不替代 NGER 申报、审计、保证意见或净零认证。
4. 没有 OEM 告警、维修工单和现场确认时，不得输出电芯安全、热失控、绝缘、冷却或精确 SOH 结论。

## 2. 已实现的系统架构

```text
Browser
  ├─ Public landing + platform sign-in
  └─ Protected product routes
       ├─ Energy overview
       ├─ Data quality
       ├─ PV health
       ├─ BESS health
       ├─ Probabilistic forecast
       ├─ Carbon ledger
       └─ Alerts / settings
            │
            ▼
Vinext server routes on Cloudflare Worker
  ├─ platform identity headers / SIWC
  ├─ REST API v1
  ├─ domain calculations (TypeScript)
  └─ D1 persistence
       ├─ site membership
       ├─ assets and licence registry
       ├─ alerts and human actions
       ├─ emission factors / carbon ledger
       ├─ model versions
       └─ audit logs

Offline data and model pipeline
  ├─ official landing-page discovery
  ├─ checksum + licence manifest
  ├─ canonical 5-minute schema
  ├─ quality / physical balance gates
  ├─ quantile models + rolling backtest
  ├─ PV / BESS evidence rules
  └─ versioned output published to application storage
```

Web 层采用 Vinext + React Server Components，部署目标是 Cloudflare Worker；结构化持久化使用 D1。当前产品页使用确定性演示数据，算法、API、数据库和审计写入均已拆分，下一阶段把演示读取器替换成 D1/时序聚合读取器即可，不需要改 UI 路由。

## 3. 目录与职责

```text
app/
  page.tsx                         公共落地页与登录入口
  (product)/layout.tsx             统一保护产品路由
  (product)/*/page.tsx             七个操作界面
  api/health/route.ts              无认证健康检查
  api/v1/**/route.ts               受保护 API
components/
  product-shell.tsx                导航、站点、身份、只读边界
  charts.tsx                       能量、概率、碳图表
  ui.tsx                           KPI、面板、状态与进度组件
  alert-actions.tsx                人工告警动作
lib/
  auth.ts                          身份与本地演示策略
  types.ts                         领域类型
  analytics.ts                     Web 端纯函数计算
  demo-data.ts                     可替换演示读取器
db/
  schema.ts                        D1/SQLite 领域表
  bootstrap.ts                     写路径最小运行时初始化
  index.ts                         D1 与 Drizzle 入口
data_pipeline/
  sources.json                     数据源、许可和发现规则
  download_public_data.py          下载、SHA-256、清单
  normalize_energy.py              字段、时区、单位与符号标准化
  core_models.py                   离线核心模型
docs/
  openapi.yaml                     API 契约
  CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md
drizzle/                           可审计 SQL 迁移
```

## 4. 数据下载与治理

### 4.1 A 级数据

- DKP Microgrid 2024–2025：Grid、Site Demand、Solar、BESS、SOC、天气；用于同场能量平衡、负荷预测、BESS 规则和碳账。
- DKASC 2018–2021：阵列功率、电量、三相量、PR 与天气；用于 PV 正常基线、同类阵列比较和 2021 已知事件回放。
- DKA Notes on the Data 与 Terms：用于事件弱标签、署名、再分发和商业使用门槛。
- DCCEEW NGA Factors 2025 XLSX：北领地位置法 Scope 2 因子与来源版本。

B 级数据包括 NT 太阳资源与 CQU DKA Fault Data。CQU 数据按 CC BY-NC-SA 4.0 只作非商业研究基准，不进入商业核心训练。

### 4.2 下载流程

1. 人工打开 `sources.json` 的 `licence_url`，登记权利人、允许用途、商业状态、署名、展示阈值、保留期和到期动作。
2. 先运行 `download_public_data.py --discover-only --accept-licence-review`。检查发现链接，不盲目下载整站。
3. 按数据源下载；每个文件记录 URL、时间、字节数和 SHA-256 到 `download_manifest.json`。
4. `data_raw/` 设为不可改写。任何清洗都输出到版本化的 `data_processed/<dataset>/<version>/`。
5. DKA 对商业训练、超过展示阈值或再分发的用途，先取得书面同意。产品只展示聚合或派生指标，不对外提供大规模原始 CSV。

推荐存储结构：

```text
data_raw/<source>/<download-date>/
metadata/<source>/mapping-vN.json
labels/<source>/<label-version>.parquet
data_processed/<site>/<data-version>/
models/<model>/<version>/
reports/<site>/<period>/
```

### 4.3 统一数据契约

核心时序字段为：`timestamp`、`site_id`、`asset_id`、`channel`、`value`、`unit`、`quality_flags`、`source_version`。宽表演示层使用 `grid_kw`、`load_kw`、`pv_kw`、`bess_kw`、`soc_pct`、`irradiance_wm2`、`temperature_c`。

符号规范必须由原始文件和现场人员确认：默认 Grid 正值表示购电，BESS 正值表示放电。时间统一保存 UTC，并保留原始时区；DKP 展示使用 `Australia/Darwin`，不应用夏令时。

## 5. 模块设计

### 5.1 Data Hub

职责：连接 NEM12、CSV、SCADA、Modbus、SunSpec 和厂商 API；进行文件登记、解析版本、幂等导入、时区/单位/符号映射。每个导入批次必须有 `source_version`、`mapping_version`、`checksum` 和 `ingested_at`。

**现状（2026-08）：** 已交付两个真实、可测试的原型连接器，均在同一份真实 2016 参考数据集上做端到端验证，而非装饰性代码：
- `edge-collector-cpp/`（C++17）— Modbus TCP（MBAP）帧解析 + CRC-16/MODBUS 校验 + 本地文档化的 SunSpec 风格寄存器解码，用于边缘/SCADA 网关采集场景。
- `bms-connector-java/`（Java 21，仅 JDK 无第三方依赖）— REST/JSON 接入网关，作为 BMS/OPC-UA 网关到本系统的桥接原型（明确说明：不是原生 OPC-UA 二进制协议实现）。

两者的定位是证明 Data Hub 架构在真实数据上的可行性（TRL4 证据），厂商级寄存器映射与生产级 OPC-UA 客户端仍是试点阶段（Sprint 1+）的工作。

### 5.2 Asset Graph

对象：Site、PCC、Meter、Transformer、Feeder、PV Array、Inverter、BESS、PCS、BMS、Weather Station；未来再增加 Tenant、Workshop、Production Line、MES Order。每条测量必须能追溯到资产与连接点。

### 5.3 Time Series + Quality Gate

先执行缺失、重复、冻结、跳变、越界、单位、符号和累计量一致性检查，再执行 PCC 物理平衡。质量未通过的时间段保留原值与标志，不静默插值；相关资产告警应被抑制或降低置信度。

### 5.4 Model Hub

保存模型名称、版本、训练数据版本、特征清单、时间切分、阈值、指标和状态。候选模型只有在滚动回测、区间校准和人工审查通过后才能成为 production。模型升级不得重写旧告警和旧碳账。

### 5.5 Alert / Work Order

告警包含：类型、严重度、状态、开始/结束、资产、置信度、持续时间、损失 kWh、成本/碳影响、数据健康、证据清单、模型/规则版本和人工动作。MVP 保存 acknowledge、investigate、resolve、false_positive 四类动作及操作者。

### 5.6 Carbon Ledger

物理电量、运营估算和报告输出分离。每条碳账保存地区、因子值、单位、有效年份、来源版本、下载日期、计算方法、数据版本和人工调整。任何因子升级只影响新账期；历史账默认不可变。

## 6. 核心算法

### 6.1 能量平衡

`r_t = P_grid,t + P_PV,t + P_BESS,t − P_load,t`

在线门槛先用 `|r_t| / max(|P_load,t|, 1) ≤ 3%`，再按现场计量精度、辅助负载和拓扑校准。验收目标是至少 95% 有效时间段位于现场阈值内。持续残差优先解释为漏表、时间错位、通信、单位或拓扑问题，不直接解释为设备故障。

### 6.2 数据质量分

对期望时间轴生成完整索引，计算 missing、duplicate、frozen、jump、out_of_range。总分是可解释的加权扣分，不用于掩盖具体故障。验收要求是 100% 时间段“有值或有缺失标志”，不是假定源数据无缺失。

### 6.3 概率预测

使用时间有序特征：小时、星期、月份、节假日、滞后 1/2/12/24 小时、滚动均值/标准差、温度、辐照、PV 与 BESS 状态。分别训练 q=0.05、0.50、0.95 的分位数模型；MVP 参考实现使用 Gradient Boosting quantile loss。

切分固定为：DKP 2024-01-01–09-30 训练、2024-10-01–12-31 验证、2025 全年测试；禁止随机打乱。对 1/6/12/24h 做 expanding-window 或 rolling-origin 回测。指标至少包括 P50 MAE、P90 经验覆盖率、平均区间宽度、偏差、峰值召回和阈值超越概率。目标覆盖率 85%–95%；覆盖率高但区间过宽不算通过。

阈值概率在样本/分布预测中计算 `Pr(Y > threshold)`；UI 同时展示中位数、P05–P95、阈值和概率。

### 6.4 PV 异常证据

1. 用太阳高度、辐照和温度建立天气校正 P05/P50/P95 基线。
2. 与同容量/同朝向阵列比较，排除全站天气变化。
3. 数据质量通过且实际功率连续 6 个 5 分钟间隔低于 P05，才生成候选。
4. 损失电量为 `Σ max(P50_expected − P_actual, 0) × interval_hours`。
5. DKA 运行记录只作弱监督；2021 已知设备/计量事件用于独立测试。目标已知停机召回 ≥80%，同时报告误报和提前量。

### 6.5 BESS 运行证据

在 BESS 放电正值约定下，放电时 SOC 应下降，充电时 SOC 应上升；允许死区和遥测延迟。额外计算吞吐量 `Σ |P_bess| × Δt`、等效循环、估算往返效率、功率越限、长时间满/低电和削峰反事实。没有电芯电压、温度、绝缘和冷却数据时不生成安全/SOH 结论。

### 6.6 Scope 2

`C_t = max(E_grid_import,t, 0) × EF_region,year`

结果以 kg CO₂-e 存储，以 t CO₂-e 展示。对每个月执行购电量 × 因子复算一致性 100% 测试。PV “避免排放”只作同因子参考，不等同于可交易证书或净零声明。BESS 放电不能默认视为零碳；需要可再生电力属性证据。

## 7. API 规则

API 契约见 `docs/openapi.yaml`。所有 `/api/v1` 路由在服务端读取平台身份，不相信浏览器传入的 `userId` 或 `role`。所有 site 查询必须先校验 membership；当前演示读取器返回单站点，生产读取器必须把 `site_id` 放入每条查询谓词。

响应统一为 `{ data, meta }` 或 `{ error, detail? }`。写请求限制 JSON 体积、字段长度与枚举；告警动作通过 prepared statement 写入 `alert_actions` 和 `audit_logs`。API 版本通过 URL 固定为 v1；破坏性变化使用 v2，不在 v1 静默改语义。

当前端点：

- `GET /api/health`
- `GET /api/v1/sites`
- `GET /api/v1/sites/{siteId}/summary`
- `GET /api/v1/sites/{siteId}/alerts?status=`
- `GET /api/v1/sites/{siteId}/carbon?format=json|csv`
- `POST /api/v1/alerts/{alertId}/actions`

下一阶段端点：timeseries 查询、forecast runs、data-quality events、model cards、report jobs 和 R2 报告下载。大文件与报告放 R2，D1 只保存元数据、所有权和处理状态。

## 8. 认证、授权与租户隔离

公开落地页不要求登录；产品路由和业务 API 要求 dispatch-owned Sign in with ChatGPT。身份头只在服务端读取：稳定用户键、邮箱和可选全名。SIWC 证明身份，不自动证明客户组织成员关系，因此生产版必须用 `site_memberships` 或 hosting access policy 做授权。

本地开发在没有身份头时使用固定 demo user；`NODE_ENV=production` 不允许该回退。任何管理员、导出、数据接入或因子修改动作都需要 server-side role 检查并记录审计。

## 9. UI/UX 规范

产品以桌面操作台为主，移动端保持可读与可导航。首屏不使用通用“欢迎仪表盘”，而是直接显示当前站点、连接只读状态、数据更新时间、能量流与最高优先级证据。

六个 BP 页面已逐一实现：

1. 能源总览：Grid/Load/PV/BESS/SOC、自用率、峰值、平衡残差。
2. 数据质量：缺失、重复、冻结、正负号、残差、传感器健康和诊断顺序。
3. PV 健康：阵列健康、实际/预期区间、停机候选、损失 kWh 和证据。
4. BESS 健康：SOC、功率、一致性、吞吐量、循环、效率和削峰。
5. 概率预测：1/6/12/24h P05/P50/P95、峰值、阈值概率和回测。
6. 电碳账本：购电、位置法 Scope 2、PV 参考贡献、因子版本和计算链。

第七页 Alerts 把所有模型输出转成可操作证据，并保留人工确认。Settings 展示站点、符号、阈值和许可登记，降低“隐藏假设”。颜色不作为唯一状态信息；所有按钮、链接与图表提供文字或 aria 标签；支持键盘和 reduced-motion。

## 10. 数据库与迁移

D1 表包括 sites、site_memberships、assets、data_sources、alerts、alert_actions、emission_factors、carbon_ledger_entries、model_versions、audit_logs。常用谓词已建立组合索引：用户 membership、站点+状态+时间告警、资产+时间告警、告警动作+时间、站点审计+时间。

每次 schema 变化都运行 `pnpm run db:generate`，人工检查 `drizzle/*.sql`：一个迁移只包含预期对象；没有删除/重命名误伤；索引匹配真实查询。部署后对代表查询运行 `EXPLAIN QUERY PLAN`，确认使用目标索引，再执行 `PRAGMA optimize`。

## 11. 测试与验收

### 11.1 自动化

- TypeScript 严格检查与生产构建。
- SSR 测试：公共落地页无 starter 标记；登录用户可渲染 Dashboard。
- 算法单元测试：能量平衡符号、分位数单调、质量分边界、碳单位换算、BESS SOC 方向。
- API 测试：无身份 401、越权 404/403、非法枚举 400、告警动作双写审计。
- 数据管线测试：重复时间戳、DST/非 DST 时区、缺失字段、单位转换、checksum 重建。
- 回测测试：训练集不得包含验证/测试时间；P05 ≤ P50 ≤ P95；每个模型卡包含数据版本和阈值。

### 11.2 BP 门槛

- 数据质量：所有期望间隔都有测量或明确缺失标志。
- 能量平衡：至少 95% 时段在现场校准阈值内。
- 概率预测：90% 区间经验覆盖率 85%–95%，并审计区间宽度。
- PV：已知停机事件召回 ≥80%，同步报告误报。
- BESS：SOC–功率不一致事件专家可解释率 ≥80%。
- 碳账：购电量 × 因子复算一致性 100%。
- 产品：六页与证据工作流端到端可用，不手工改数据库造结果。

## 12. 安全、隐私和运行

- 现场账号只读、最小权限、网络分区；密钥只进入托管环境变量，不提交 `.env`。
- CSV/Excel 视为不可信输入：限制大小、列数、压缩比与公式；不执行宏；记录原始 checksum。
- API 进行 rate limit、请求体限制、严格 Content-Type、CSP、SameSite cookie 与审计。
- 日志不记录原始身份头、完整电表文件或访问令牌；错误返回不泄漏 SQL、绑定名或堆栈。
- 备份与退出方案包含 D1/R2 导出、数据保留期、租户删除、模型和报告可重建验证。
- 监控至少覆盖数据延迟、导入失败、质量分、模型覆盖率漂移、告警数量、D1 写失败与 API 5xx。

## 13. 从演示 MVP 到真实试点的实施顺序

### Sprint 0：当前代码基线

完成登录、多路由 UI、受保护 API、D1 schema、告警审计写入、公开数据发现脚本、标准化脚本、核心离线算法和文档。

### Sprint 0.5（已完成，2026-08-09）：公开参考数据集回测

在 DKP/DKASC 商业授权尚未取得前，用 Open Power System Data household_data（CC-BY，真实德国 Konstanz 智能电表数据，含一个真实光储案例）、Open-Meteo 历史天气与 DCCEEW NGA Factors 2025（真实 NT/DKIS 因子 0.56 kg CO₂-e/kWh）跑通 `data_pipeline/core_models.py` 全部算法：能量平衡（恒等式 100% + 真实子表覆盖率 65.7%）、数据质量门（真实缺失 31.6%）、概率负荷预测（1h P90 覆盖 86.5%，24h 降到 77.8%，如实报告未达标）、PV 证据（故障注入召回 88.0%）、BESS 证据（故障注入召回 82.5%，现场校准死区 0.2 kW）、Scope 2（100% 复算一致）。方法论、局限性和可复现命令见 `docs/REFERENCE_DATASET.md`；结果实时呈现在 `/methodology` 页面。这满足 PERIscope 报名对 TRL4 的字面要求（"proof of concept has been validated ... with representative data"），但明确不等同于 Alice Springs 试点结果。

### Sprint 1：真实公开数据（2 周）

取得/登记许可；下载 DKP 2024–2025、DKASC 2018–2021、Notes 和 NGA 2025；确认 Grid/BESS 符号、时区、单位和文件结构；形成只读 raw 层、字段字典、checksum 与第一份质量报告。

### Sprint 2：可复算分析（2–3 周）

运行能量平衡；按固定时间切分训练分位数模型；回放 2021 PV 事件；实现 BESS 一致性与 Scope 2 月账；生成模型卡与验收报告。所有输出带 `data_version + model_version`。

### Sprint 3：应用接线（2 周）

把 `demo-data.ts` 替换成 repository 接口；批量结果进入 D1/R2；图表 API 支持范围/粒度；告警动作与真实 alerts 表连接；实现月报任务和签名下载 URL。

### Sprint 4：真实园区只读试点（8–12 周）

签 SOW 和数据协议；获取 PCC、PV、BESS、天气、单线图、资产元数据、告警和工单；部署只读连接器；共同校准阈值；每周误报复盘；以数据质量、预测覆盖、证据可操作性、Scope 2 复算和转订阅条件验收。

### Go / No-Go

- 第 2 个月：数据、许可和字段字典完成，否则停止商业训练/再分发。
- 第 5 个月：能量平衡、概率预测和碳账可稳定复算，否则不扩大产品范围。
- 第 8 个月：六页、证据告警和报告导出端到端完成，否则继续聚焦证据链。
- 第 12 个月：至少一个真实园区和工单反馈；若未取得，暂停确定性根因扩张，保留计量/研究工具定位。

## 14. 完成定义

代码只有在以下条件全部满足时才算可交付：生产构建通过、迁移已检查、自动测试通过、无 starter 资产或预览标记、所有产品路由受保护、API 服务端授权、告警动作可持久化、数据来源与许可状态可追踪、算法输出有版本与边界、移动/桌面可用、真实试点接线不需要推翻当前领域模型。
