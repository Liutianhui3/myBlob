# 聊天图示

聊天支持顶层 `diagram` fenced code block，内容为 JSON。正文可在图示前后正常使用 Markdown。历史、复制回复和导出保留原始内容，无需修改消息存储接口。

```diagram
{
  "title": "AI 对话系统",
  "steps": [
    { "title": "Vue3 前端", "description": "输入问题、展示回答、处理流式输出", "connector": "both" },
    {
      "title": "后端服务：二选一",
      "tone": "accent",
      "items": [
        { "title": "NestJS", "description": "TypeScript" },
        { "title": "FastAPI", "description": "Python" }
      ],
      "description": "鉴权、业务逻辑、上下文管理、调用模型"
    },
    { "title": "大模型 API", "description": "生成回答、工具调用、结构化输出" }
  ]
}
```

`steps` 为 1–12 个步骤，`title` 必填，`description` 可选。每个步骤可包含 1–6 个并列 `items`。`tone` 为 `neutral`（默认）或 `accent`；`connector` 为 `down`（默认）、`both` 或 `none`，表示与下一步的连接；`connectorLabel` 可用于连接说明。所有文字为纯文本，不执行 HTML。每段文字最多 1000 字符，每块 JSON 最多 24000 字符。

闭合且校验通过后显示卡片。流式传输中的未闭合块、无效 JSON 或不符合协议的块显示为可复制代码，避免破坏整条回复。支持浅色、深色及窄屏，窄屏并列选项自动堆叠。

## 后端模型接入

当前仓库不包含模型服务端。将以下指令加入服务端的系统提示词，模型才能主动生成图示（仅接入前端不会改变模型输出）：

> 当架构、流程或技术方案的关系适合可视化时，使用顶层 diagram 代码块，内容为严格 JSON，不要输出 HTML。结构为 {"title":"图示标题","steps":[{"title":"步骤名","description":"可选说明","tone":"neutral 或 accent","items":[{"title":"并列选项","description":"可选说明"}],"connector":"down、both 或 none","connectorLabel":"可选连接说明"}]}。steps 限 1–12 项，items 可省略、存在时限 1–6 项，所有文本限 1000 字符。连接描述与下一步的关系。仅在需要强调的步骤使用 accent。图示前后仍可使用普通 Markdown 解释。

也可将本文件中的示例作为用户消息发给模型，让它按此格式输出，验证渲染。
