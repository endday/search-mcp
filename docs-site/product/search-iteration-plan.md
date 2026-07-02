# Search MCP 迭代计划

这份文档不是泛泛路线图，而是针对当前仓库的一份可执行迭代说明。

目标不是把项目做成搜索网站，也不是把它做成问答系统，而是继续把它收敛成一个：

- 本地优先
- 可策略化
- 可观测
- 面向 Agent 的 Search Gateway

## 当前判断

结合当前代码结构、最近的手工验证，以及对几个同类 GitHub 项目的对标，接下来最值得投入的方向不是前端，不是远程部署形态，也不是更花哨的结果展示，而是下面四类能力：

1. 搜索能力分层
2. 引擎参数与地域语言控制
3. 结果质量评估与回归基线
4. 可扩展的上游能力面

## 对标项目

这轮对标最值得参考的项目有四个：

### 1. [searxng/searxng](https://github.com/searxng/searxng)

最值得学习的是它的引擎适配层，而不是 UI。

可借鉴点：

- 把 `web`、`news`、`images`、`videos` 视为不同能力面
- 更重视 `mkt`、`Accept-Language`、地区设置，而不是依赖隐蔽 query 参数
- 每个引擎的 request / parse / locale 处理都相对独立

不建议照搬的点：

- 它的系统体量很大，不适合直接复制到当前仓库
- 当前项目不需要先演化成完整 metasearch 平台

### 2. [brave/brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server)

最值得学习的是工具面设计。

可借鉴点：

- `web_search` 和 `news_search` 分离
- 参数正式化：`country`、`search_lang`、`ui_lang`、`count`、`offset`、`freshness`
- 把 LLM 友好的上下文能力当成独立工具，而不是塞进普通搜索返回

不建议照搬的点：

- 它是 API-first，不是 scrape-first
- 你这个项目不应该为了模仿它而引入必需 API key 的主路径

### 3. [mrkrsl/web-search-mcp](https://github.com/mrkrsl/web-search-mcp)

这是和当前仓库路线最接近的项目之一。

可借鉴点：

- 多引擎失败回退
- 搜索和全文提取的分层
- 根据结果质量继续尝试其他引擎

不建议照搬的点：

- Playwright 比例较高，运行成本和维护成本都偏重
- 当前仓库没有必要默认走浏览器自动化主路径

### 4. [firecrawl/firecrawl-mcp-server](https://github.com/firecrawl/firecrawl-mcp-server)

最值得学习的是能力边界。

可借鉴点：

- `search`、`scrape`、`crawl`、`extract` 分成独立工具
- 对“搜索发现”和“内容抽取”做清晰分层

不建议照搬的点：

- 当前项目不需要演化成通用抓取平台
- 不需要把复杂交互式浏览能力拉进主线

## 迭代原则

接下来每一轮迭代都应该遵守这几个原则：

1. 先增强参数和策略，再引入更重的运行时依赖
2. 先把能力面拆清楚，再扩更多上游
3. 先建立可重复评估，再继续调排序
4. 优先做本地、默认可用的路径；付费 API 只做增强上游
5. 不在服务端根据关键词猜意图；优先把能力显式暴露给 AI 选择

## 迭代分期

### P0：把现有 Web Search 做稳

这是最近一到两个版本最值得做的部分。

### P0.1 参数面正式化

当前仓库虽然已经支持 `language`、`time_range`、`pageno` 等参数，但还不够系统。

建议补齐并统一：

- `country`
- `search_lang`
- `ui_lang`
- `count`
- `offset`
- `freshness` 或继续保留 `time_range` 但做语义映射

目标：

- 不同引擎能明确接收“地域”和“语言”信号
- MCP 输入层不要只依赖 query 文本猜测

### P0.2 先拆能力，不做关键词意图判断

这里需要先定一个边界：

- 不建议依赖关键词分析来判断“这是不是新闻查询”
- 更合理的做法是把能力显式暴露给上层 AI，由 AI 决定调用哪个 API / MCP tool

也就是说，服务端不应该靠 `新闻`、`news`、`最新消息` 之类的词去偷偷改写主策略。

短期内仍然不建议直接切到 Bing News / Yahoo News / Baidu News 页面作为默认 web search 路径，因为那会直接带来 parser 分叉。

更稳的短期方案：

- 保持 `web_search` 为通用搜索
- 为未来的 `news_search` 预留单独能力面
- 对中文查询允许调用方显式传入更明确的 locale / market
- 提高部分引擎的结果数上限

核心原则：

- AI 负责选工具
- 搜索网关负责把工具能力做清楚
- 搜索网关内部只做参数映射、能力校验和结果归一化

### P0.3 建立查询样本回归

现在已经有 parser fixture 测试，但还缺少“搜索质量回归样本”。

建议增加一组固定 query corpus，例如：

- 品牌词：`DeepSeek`
- 中文新闻：`DeepSeek 新闻`
- 英文新闻：`OpenAI latest news`
- 技术词：`Cloudflare Workers`
- 模型词：`Qwen3 benchmark`

每次变更后记录：

- 参与引擎
- 超时引擎
- Top 5 结果
- official / paper / media 占比

目的不是追求绝对正确，而是防止参数调整让结果明显退化。

### P0.4 可观测性补强

当前仓库已有一定 metrics 基础，但还不够贴近搜索调优。

建议增加：

- tool / capability 调用日志
- 各引擎最终 URL 参数快照
- skipped / blocked / timeout 原因统计
- 上层传入参数与最终下发参数对照

这样后续调 URL 参数时，不会变成盲调。

### P1：拆出垂类搜索面

这部分是下一阶段最值得做的功能增量。

### P1.1 新增 `news_search`

这是最明确的一步，而且应该作为显式能力暴露出去。

原因：

- 现在“新闻查询”不应该只是 web search 的一个隐式子场景
- 真正的 news vertical 和通用 web vertical 结构、排序目标、结果源都不同

建议做法：

- 保留现有 `web_search`
- 新增 `news_search`
- 第一版先只支持 `bing`、`brave`、`yahoo`
- 不要求所有引擎都支持 news

调用模型：

- AI 需要通用网页检索时，调用 `web_search`
- AI 需要新闻检索时，调用 `news_search`
- 服务端不根据 query 文本代替 AI 做路由决策

第一版输出字段建议：

- 标题
- URL
- 来源
- 发布时间文本
- 摘要
- 引擎名

### P1.2 搜索参数模型拆成“通用参数 + 垂类参数”

建议把输入模型拆成两层：

- 通用：`query`、`country`、`search_lang`、`ui_lang`
- 垂类：`freshness`、`count`、`offset`、`safe_search`

好处：

- 更接近 Brave MCP 这类项目的工具设计
- 后续扩 `image_search`、`video_search` 时不需要重新发明 schema

### P1.3 引擎能力声明升级

当前的 `supports` 已经有基础能力：

- `time_range`
- `pageno`

后续建议补成更清楚的能力矩阵，例如：

- `verticals: ["web", "news"]`
- `supports.count`
- `supports.offset`
- `supports.country`
- `supports.search_lang`
- `supports.ui_lang`

这样工具层才能知道参数是“忽略”还是“返回不支持”，而不是退回到关键词猜测。

### P2：增强上游与策略层

这是中期能力，不是当前发布阻塞项。

### P2.1 付费增强上游

建议接入，但不作为默认路径：

- Exa
- Brave Search API

原则：

- 通过 env 配置 API key
- 结果映射到现有统一结构
- 只作为增强上游，不替代默认免费源

### P2.2 Source Policy Engine 真正接入搜索链路

当前仓库已经有这个方向文档，但还不是运行时主线。

后续可以让它在搜索前决定：

- 优先哪些引擎
- 优先哪些来源类型
- 是否压低社区/聚合站
- 是否对新闻、论文、品牌词采用不同源策略

### P2.3 AI Context Resolver 与 search 的衔接

建议未来把它建立在：

- `web_search`
- `news_search`
- `content`
- `jina_content`

之上，而不是直接把 search 做成问答层。

## 这轮明确不建议做的事

这些方向短期内不值得投入：

### 1. 不先做搜索网站

项目主线不是 UI 产品。

### 2. 不先做复杂浏览器自动化主路径

浏览器抓取可以作为 fallback，但不应该变成默认核心。

### 3. 不继续把所有能力塞进一个 `web_search`

这会让参数、排序、parser 和测试面都越来越混乱。

### 4. 不在服务端做重关键词意图分析

这会让工具边界变模糊，也会让 AI 难以形成稳定的工具使用习惯。

### 5. 不为了“更像竞品”而引入远程托管依赖

当前项目的差异化价值之一就是本地优先和默认可用。

## 推荐的落地顺序

如果按最小风险推进，建议顺序如下：

1. 补 query corpus 回归
2. 补 locale / country / count / offset 参数面
3. 设计并预留 `news_search` 的 schema 和能力矩阵
4. 增加观测字段
5. 新增 `news_search`
6. 再评估是否接入付费增强上游

## 当前版本的明确建议

如果只看当前仓库的下一轮迭代，最推荐的组合是：

- 保持 `web_search` 主线不变
- 不急着动排序主逻辑
- 先把参数面、能力暴露、引擎能力声明和评估体系做扎实

这是风险最低、收益也最高的一条线。
