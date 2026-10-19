# 聊天生成图片

支持两种 OpenAI 兼容协议：

1. 聊天模型在 `/chat/completions` 流式返回 `generate_image` 工具调用，后端收集完整参数后调用同一服务地址下的 `/images/generations`，将返回的 `data[0].url` 或 `data[0].b64_json` 转成图片消息。前端展示图片，可点击放大、下载。
2. 服务商直接在聊天流中返回 `delta.content` 的 `image_url` 内容块，或 `delta.images[].image_url.url`，后端将图片转换为相同的消息展示格式。普通 Markdown 图片也支持展示与预览。

在后端环境变量中配置服务商提供的真实图片模型 ID：

```dotenv
AI_IMAGE_MODEL=服务商提供的图片模型ID
AI_IMAGE_API_KEY=生图专用密钥
AI_IMAGE_TOOLS_ENABLED=true
```

图片生成与聊天共用 `AI_BASE_URL`，优先使用 `AI_IMAGE_API_KEY`，未配置时回退到 `AI_API_KEY`。未设置 `AI_IMAGE_MODEL` 时使用当前选择的聊天模型 ID；只有当该模型也可用于 `/images/generations` 时才能工作。模型能理解图片不代表支持生成图片，须以服务商接口文档为准。

Xcode 接入按 [GPTImage 文档](https://docs.xcode.best/docs/paint/GPTImage)：`AI_IMAGE_MODEL=gpt-image-2`，使用“gpt生图”分组的专用令牌。聊天模型负责调用应用定义的 `generate_image` 函数，后端再调用 Images API；不会将 `gpt-image-2` 发送到 Chat Completions 或 Responses API。请求固定 `n=1`、`size=1024x1024`、`quality=auto`、`output_format=png`、`response_format=url`，不向图片接口发送 `stream`。当前接入文生图，未接入 `/images/edits` 图片编辑。

如果服务商仅支持聊天接口直接返回图片、不支持函数工具，设置 `AI_IMAGE_TOOLS_ENABLED=false`。当前不支持 Responses、Gemini 原生协议或图片编辑接口，需要服务商提供相应兼容接口或另加适配。

发送示例：`请生成一张图片：一只坐在窗边看雨的橘猫，水彩画风。` 工具调用由模型决定，不靠关键词匹配。一次最多生成一张，不执行模型返回的任意代码。生成耗时较长时可设置 `AI_TIMEOUT_MS=600000`；停止生成会取消上游请求。

后端开始调用图片接口时发送 `image_generation` SSE 事件。前端显示“正在创建图像”、粉色点阵动画和百分比，生成完成后替换成图片，停止或失败时移除占位区。Images API 不返回实时进度，百分比按等待时间模拟，最高停在 94%，不代表服务端实际进度；动画遵循减少动态效果设置。

图片结果随聊天正文保存，重新打开会话可展示。base64 图片不再原样放入后续文本上下文；服务商返回的远程地址可能有有效期，当前不额外存储远程图片。

远程图片通过受登录保护的 `POST /api/conversations/:id/messages/:messageId/images/download` 下载。服务端校验会话所有权和图片链接是否属于该条助手消息，再下载图片字节返回，不依赖浏览器 CORS。下载只允许 HTTPS 的 `*.r2.dev` 域名；其他图片存储域名通过后端 `AI_IMAGE_DOWNLOAD_HOSTS` 逗号分隔配置精确主机名。重定向目标同样校验域名，不转发用户登录令牌或 AI 密钥，并限制图片 20 MB、超时 60 秒。Base64 图片直接在浏览器下载。SVG 和任意脚本不会作为下载图片接受。

自动测试使用模拟图片服务，验证工具参数分片、实际 API 请求路径、返回格式、原生多模态流以及浏览器预览和下载；不消耗真实图片生成额度。真实生成仍需服务商模型和接口匹配。
