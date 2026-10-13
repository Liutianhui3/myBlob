# 文章与写作空间

- `/article` 保留原来的 BentoGrid/BentoGridItem 卡片，改为读取接口，每页 6 篇，可左右翻页。
- `/article/:id` 展示已发布文章的富文本正文。
- `/articleManage` 仅管理员管理全部文章：新建、编辑、保存草稿、发布、撤回、预览、搜索、状态筛选和确认删除。

正文使用 Tiptap 富文本编辑器，支持段落、标题、粗体、斜体、下划线、删除线、列表、引用、代码块、链接、HTTPS 图片、撤销与重做。图片和封面通过 HTTPS URL 插入，本次没有新增文件上传服务。

富文本以 HTML 存储。服务端白名单过滤标签、属性和链接协议，阅读端通过 DOMPurify 再过滤。草稿仅管理员可见；管理、更新及删除均由后端校验管理员权限。已发布内容所有用户（包括未登录访客）均可阅读。

后端启动时会创建 `articles` 表及索引，无需手动删除或重建数据库。本次已在当前开发数据库创建表，已有数据保持不变。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/articles` | 已发布列表 |
| GET | `/api/articles/:id` | 已发布详情 |
| GET | `/api/articles/manage` | 管理员查看全部文章 |
| GET | `/api/articles/manage/:id` | 管理员查看文章详情（含草稿） |
| POST | `/api/articles` | 创建文章 |
| PATCH | `/api/articles/:id` | 更新文章（完整表单 + version） |
| DELETE | `/api/articles/:id` | 删除文章，成功返回 204 |

列表参数：`page`（默认 1）、`limit`（1–50，默认 12）、`q`（标题/摘要搜索）、`category`；管理列表额外支持 `status=draft|published`。返回 `{ items, total, page, limit }`。

写入字段：`title`（必填，最多 160 字）、`content`（HTML，最多 200000 字符）、`summary`（最多 300 字，留空自动截取正文）、`category`（最多 40 字）、`tags`（最多 8 个，每个 24 字）、`coverUrl`（可选 HTTPS 图片地址）、`status`（draft/published）。更新必填当前 `version`，过期版本返回 409，避免多个窗口覆盖彼此内容。

## 验证

前端：`npm run build`、`npm test`、`npm run test:articles-ui`（需已有 Vite 服务，默认 8082；可设置 ARTICLE_UI_BASE）。浏览器测试全部模拟 API，不调用真实账号、验证码或数据库。

后端：`npm test`、`npm run lint`。单独设置 `ARTICLE_TEST_DATABASE=1 node --import dotenv/config --test test/articles.integration.mjs` 可使用本地 PG 配置验证完整文章接口；测试数据在事务内写入并回滚。

修改后端后需重启用户自己启动的服务；本次不替用户重启后台进程。

## 角色管理

Dock 的文章管理与角色管理入口、`/roleManage` 和文章管理入口仅管理员可见。后端独立校验权限，普通用户不能通过直接请求绕过限制。

`users.is_admin` 默认为 FALSE，不会自动授予任何账号管理员。首次管理员由你手动执行 SQL（替换用户名）：

```sql
UPDATE users SET is_admin = TRUE WHERE username = '你的用户名';
```

重启后端以加载新接口，再刷新页面。管理员可在角色管理页搜索用户并授予/取消管理员；接口禁止取消最后一位管理员。

- GET `/api/admin/users`：分页用户列表，支持 `q`、`role=admin|user`、`page`。
- PATCH `/api/admin/users/:id/role`：仅接受 `{ "isAdmin": true/false }`。

文章分页无页码，第一页隐藏左箭头，最后一页隐藏右箭头。

文章列表卡片按视口高度自适应排列，不产生页面滚动条；文章管理入口移至 Dock，仅管理员显示。
