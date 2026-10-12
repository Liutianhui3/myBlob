# 知识库入门版

聊天右上角进入「知识库」。创建知识库，设置切片长度和重叠长度，选择或拖入文件后自动上传并切片。

支持 UTF-8 TXT / Markdown，单文件最大 1 MB。默认切片 500 字符、重叠 50 字符；单位是 Unicode 字符，不是 token。上传失败可重试，取消等待后请刷新确认后端是否已保存。

后端 `my-blob-api` 的 `src/knowledge`：

- `knowledge.controller.ts`：接收 multipart 文件，限制大小，校验登录。
- `knowledge.service.ts`：校验归属与文件，调用切片函数，事务保存原文和切片。
- `split-text.ts`：固定字符长度切片，每次移动 `chunkSize - chunkOverlap`。

重启后端会自动创建 PostgreSQL 表。原文保存在 `knowledge_documents`，切片保存在 `knowledge_chunks`。当前仅保存文本切片，没有 embedding、向量数据库或聊天检索。

接口均以 `/api` 开头，需要 Bearer token：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET / POST | `/knowledge-bases` | 列表 / 创建（JSON：name、description） |
| GET / POST | `/knowledge-bases/:id/documents` | 文档列表 / 上传并同步切片 |
| GET | `/knowledge-bases/:id/documents/:documentId/chunks?page=1` | 每页 20 个切片 |
| DELETE | `/knowledge-bases/:id/documents/:documentId` | 删除文档和切片 |

上传字段：`file`、`chunkSize`、`chunkOverlap`。浏览器使用 FormData，不手动设置 Content-Type。接口返回成功时，文档与所有切片均已保存。
