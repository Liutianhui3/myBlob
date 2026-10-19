# 聊天附件

输入框左下角点击附件按钮选择文件、在输入框直接粘贴截图，或将文件拖入聊天页面任意位置。拖入时显示全页提示，松手后添加到输入框；按 Esc 或拖出页面可关闭提示。选好后显示预览，点击 × 移除；发送时才随消息传给后端，不自动进入知识库。可以只发附件，也可以附加问题。

支持 PNG/JPEG/WebP（单张最大 2 MB）、UTF-8 TXT/Markdown（单份最大 100 KB），以及 Word `.docx`、Excel `.xlsx`、PDF `.pdf`、PowerPoint `.pptx`（单份源文件最大 10 MB）。每条最多 4 个附件，发送的图片和提取文本总大小最大 6 MB；单份文档提取文字最大 100 KB。旧版 `.doc/.xls/.ppt` 请另存为新版格式后上传。

Office/PDF 在选中文件后通过受登录保护的 `POST /api/conversations/attachments/extract`（multipart 字段 `file`）上传并提取文字，返回文档附件；发送消息时将提取内容一起发给模型。Excel 按工作表和行列提取，PPTX 按幻灯片顺序提取，PDF 和 DOCX 提取文字，不执行文档中的宏或脚本，不保留原始二进制文件。扫描版 PDF 与纯图片文档暂不支持 OCR，请上传截图。解析损坏、加密、空文档和超限内容会明确提示，不静默截断。

图片以纯缩略图展示，点击可打开大图预览，Esc 或点击背景关闭；草稿图片右上角可移除，不展示文件名。文档保留文件名；中文文件名同时在前端保留原名并在服务端修正 multipart 编码。更新后需要重启后端以加载提取接口。

`POST /api/conversations/:id/messages/stream` 在原有 JSON 中增加 `attachments`：

```json
{
  "content": "请分析附件",
  "attachments": [
    { "name": "notes.md", "type": "document", "text": "文档内容" },
    { "name": "photo.png", "type": "image", "mime": "image/png", "data": "data:image/png;base64,..." }
  ]
}
```

后端 `src/chat/attachments.ts` 校验附件，`ChatService` 保存消息附件到 PostgreSQL JSONB，`AiService` 把文档文本加入用户内容，图片转换为 OpenAI 兼容的 `image_url` 多模态内容。后续追问会按上下文预算携带历史附件。模型 API 密钥始终保留在后端。

图片理解需要当前 AI_BASE_URL 和所选模型支持 Chat Completions 的 image_url 输入；仅文本模型无法识图。这里的图片预算为估算，不是服务商精确 token 计费。大文档超过上下文预算时会明确报错，避免静默截断。

重启后端以执行 attachments 字段迁移。`node test/attachments-ui.mjs` 验证局域网粘贴/选择、预览移除和 SSE 请求；后端 attachments 测试验证校验和多模态上下文，attachments.integration.mjs 在设置 TEST_DATABASE_URL 后验证持久化。测试使用模拟模型，不调用付费模型服务。
