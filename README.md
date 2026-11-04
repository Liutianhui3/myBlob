# MyBlob

**集个人展示、AI 对话与知识文档管理于一体的 Web 工作空间。**


MyBlob 基于 Vue 3 与 TypeScript 构建，将个人主页、资料管理、文章阅读与管理、管理员角色配置、流式 AI 对话和知识库整合在统一界面中。项目采用前后端分离架构：本仓库负责页面与交互，账号认证、数据持久化和模型调用由配套的 `python-backend`（FastAPI） 服务提供。

## 核心功能

### AI 工作台

- **会话管理**：新建、搜索、切换与删除会话，分页加载历史消息，导出 Markdown。
- **流式对话**：通过 SSE 实时呈现回复，支持多轮上下文、停止生成、Markdown 渲染、代码高亮与内容复制。
- **模型设置**：从后端获取可用模型与思考强度，按账号保留当前选择，切换模型时保留会话上下文。
- **附件输入**：支持文件选择、粘贴截图和全页拖放。文件拖入时显示提示，放下后加入输入框，发送前可预览或移除。
- **思考过程与图片生成**：展示模型返回的思考内容；接收后端图片生成状态，支持生成图片预览与下载。具体能力取决于后端和模型配置。
- **结构化内容与文件**：将有效的 `diagram` JSON 代码块展示为流程图，将 `xlsx` JSON 代码块转换为可下载的 Excel 文件；支持下载后端返回的文件附件。
- **回复朗读**：使用浏览器 Web Speech API 分段朗读，支持随时停止；切换会话或离开页面时自动结束。
- **响应式布局**：可折叠侧栏、移动端覆盖式导航、明暗主题与减少动态效果适配。

支持通过 `/chat?c=<会话 UUID>` 恢复指定会话。聊天记录由后端持久化，前端不将聊天正文保存至浏览器存储。

### 知识文档管理

创建知识库，上传或拖入 TXT / Markdown 文档，配置切片长度与重叠长度，并分页查看切片内容。支持上传进度、失败重试、文档删除，以及文档向量化操作与状态展示。

向量化需要配套后端提供 embeddings 接口与模型配置。当前后端在聊天时自动检索当前用户全部知识库中已向量化的片段，并在上下文预算内加入匹配资料；前端无需携带知识库 ID，暂不支持限定单个知识库。没有匹配资料时仍可进行普通聊天；来源标注由模型生成，尚无结构化引用展示。

### 文章与管理员工作台

- **公开阅读**：无需登录浏览已发布文章，支持搜索、分类筛选、分页与文章详情。
- **文章管理**：管理员与文章编辑使用 Tiptap 富文本编辑器创建、编辑、预览、发布与删除文章，管理草稿、分类、标签与封面。
- **编辑冲突**：更新时提交文章版本号，由后端检测并拒绝冲突更新。
- **角色管理**：管理员分页查询用户，按关键词与角色筛选，配置管理员 / 普通用户 / 文章编辑角色；后端禁止撤销最后一位管理员。
- **权限控制**：管理入口与路由按后端返回的 `roles` 和 `src/config/access.ts` 控制，管理员可管理所有文章，文章编辑仅能管理自己的文章；后端独立校验权限；文章 HTML 在后端清理。

新注册用户默认为普通用户；首位管理员的初始化方式见配套 [`python-backend` README](../python-backend/README.md)。

### 个人主页与资料

- 编辑头像、昵称、邮箱、手机号、所在地、网站、简介和关于内容。
- 管理技术标签与工作经历，支持经历增删、排序及在职状态。
- 省份与城市联动选择，头像预览与压缩处理。
- 已保存资料同步展示至个人主页和聊天侧栏。
- 保存失败保留编辑内容，离开未保存页面时提示。

### 账号与会话

提供登录、注册、路由访问控制、登录过期处理及跨标签页退出同步。接口统一使用 Bearer Token 认证，模型密钥由后端管理。

## 技术栈

| 领域 | 技术 |
| --- | --- |
| 应用框架 | Vue 3、TypeScript、Vue Router 4 |
| 构建工具 | Vite 5 |
| 状态管理 | Pinia |
| 样式与主题 | Tailwind CSS 4、Less |
| 动画与交互 | GSAP、Motion for Vue、Tippy.js |
| 数据请求 | Axios、SSE 流式读取 |
| 内容展示 | Markdown-it、Highlight.js、ECharts、Tiptap、DOMPurify、ExcelJS |
| 自动化验证 | Node.js Test Runner、Playwright |

## 快速开始

### 环境准备

- 推荐使用 Node.js 22 LTS 与 npm。
- 准备配套的 `python-backend`（FastAPI） 后端服务。
- 需要使用 AI 对话时，在后端配置 `DASHSCOPE_API_KEY`（或 `AI_API_KEY`）、`AI_BASE_URL` 与 `AI_MODEL`；向量化另需配置 `EMBEDDING_*`，具体见后端 README 和 `.env.example`。

### 安装与启动

在本仓库根目录执行：

```bash
npm ci
npm run dev
```

默认访问地址：<http://localhost:8082>。

开发服务器将 `/api` 请求代理至 `http://127.0.0.1:8000`，并移除 `/api` 前缀。例如，前端请求 `/api/users/me` 时，后端收到 `/users/me`。请按照 [`python-backend` 启动说明](../python-backend/README.md#启动)完成环境配置、数据库迁移并启动 API 服务；如端口不同，修改 [`vite.config.ts`](./vite.config.ts) 中的 `server.proxy`。

前端无需填写模型 API 密钥；模型服务地址与密钥应配置在后端。

### 页面入口

| 路径 | 页面 |
| --- | --- |
| `/login` | 登录；默认入口 `/` 跳转至此 |
| `/register` | 注册 |
| `/home` | 个人主页 |
| `/article` | 公开文章列表 |
| `/article/:id` | 公开文章详情 |
| `/articleManage` | 文章管理，管理员 / 文章编辑 |
| `/roleManage` | 角色管理，仅管理员 |
| `/chat` | AI 工作台 |
| `/knowledge` | 知识库 |
| `/profile` | 个人资料 |

文章列表与详情允许匿名访问；个人主页、聊天、知识库和资料页面需要登录，文章管理还需管理员或文章编辑角色，角色管理仅限管理员。登录成功后进入首页或恢复原目标页面。

## 附件与文档规格

聊天附件与知识库文档采用不同的处理流程：聊天附件随消息提交，知识库文档上传后保存并切片。

| 场景 | 支持格式 | 大小与数量限制 |
| --- | --- | --- |
| 聊天图片 | PNG、JPEG、WebP | 单张最大 2 MB |
| 聊天文档 | UTF-8 TXT、Markdown | 单份最大 100 KB（100,000 字节） |
| 聊天 Office / PDF 文档 | DOCX、XLSX、PDF、PPTX | 单份原文件最大 10 MB，由后端提取文本 |
| 单条消息 | 上述聊天附件 | 最多 4 个；图片数据与文档文本合计最大 6 MB |
| 知识库文档 | UTF-8 TXT、Markdown | 单份最大 1 MB |

图片理解取决于后端所选模型是否支持多模态输入。Office / PDF 附件通过 `/api/conversations/attachments/extract` 上传并提取文本后加入消息，需要后端实现该接口；总大小限制按提取后的文本计算。旧版 DOC / XLS / PPT 请先另存为新版格式，图片暂不支持 GIF。

## 工程结构

```text
src/
├── api/                 # 按业务划分的接口与数据类型
├── assets/              # 图片、图标、地区数据与全局样式
├── components/          # 通用 UI 与业务组件
├── layout/              # 页面布局与 Dock 导航
├── lib/                 # 认证、聊天、资料、朗读、流程图与表格逻辑
├── router/              # 路由定义与访问控制
├── store/               # 全局状态
├── utils/               # 请求封装等基础工具
└── views/               # 登录、主页、聊天、知识库与资料页面
test/                    # 单元测试与浏览器交互测试
```

### 接口约定

业务接口集中于 `src/api`，页面通过具名函数访问服务。`src/utils/request.ts` 统一处理 `/api` 前缀、认证头、默认超时与错误信息；聊天流式接口使用独立的超时和取消机制。

| 模块 | 接口范围 |
| --- | --- |
| 认证 | 登录、注册、退出与会话校验 |
| 用户资料 | `GET /api/users/me`、`PATCH /api/users/me` |
| AI 对话 | `/api/conversations`、模型列表、历史消息与消息流 |
| 知识库 | `/api/knowledge-bases`、文档、切片与向量化 |
| 文章 | `/api/articles` 公开阅读与管理员文章管理 |
| 角色 | `/api/admin/users` 用户查询与角色配置 |

登录令牌存储于 `localStorage.myblob_token`，公开用户资料缓存于 `sessionStorage.userInfo`。路由访问权限仍由后端会话校验决定；退出或登录失效时清理对应状态。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 执行 TypeScript 检查并生成生产构建 |
| `npm test` | 运行认证、权限、请求、聊天、模型、资料、朗读、流程图与表格等单元测试 |
| `npm run test:chat-ui` | 验证聊天交互 |
| `npm run test:speech-ui` | 验证回复朗读 |
| `npm run test:profile-ui` | 验证资料编辑与展示 |
| `npm run test:articles-ui` | 验证文章阅读、文章管理与角色管理 |
| `node test/attachments-ui.mjs` | 验证附件选择、粘贴、拖放与发送 |
| `node test/spreadsheet-ui.mjs` | 验证表格展示与文件下载 |
| `node test/image-progress-ui.mjs` | 验证图片生成进度展示 |
| `node test/roles-ui.mjs` | 验证角色管理 |
| `node test/message-ui.mjs` | 验证全局消息提示 |

浏览器测试需先启动前端，并安装本机 Google Chrome。测试使用模拟接口，不创建真实账号，也不调用付费模型。

聊天、朗读与附件测试默认访问 `http://127.0.0.1:8082`，表格与图片生成测试默认使用端口 `8083`，均可通过 `CHAT_UI_BASE` 指定地址：

```bash
CHAT_UI_BASE=http://127.0.0.1:8082 npm run test:chat-ui
```

资料测试可通过 `PROFILE_UI_BASE` 指定地址；文章与角色测试使用 `ARTICLE_UI_BASE`（分别默认端口 `8082`、`8083`）。运行默认使用 `8083` 的脚本时，可设置对应变量指向已启动的 `8082` 服务。

聊天、朗读和资料测试截图分别输出至 `.artifacts/chat/`、`.artifacts/speech/`、`.artifacts/profile/`；表格与图片生成测试截图分别输出至 `.artifacts/spreadsheet/`、`.artifacts/image-generation/`，附件测试截图输出至 `output/playwright/`，文章测试截图输出至 `output/playwright/articles/`。

## 生产部署

```bash
npm ci
npm run build
```

构建产物位于 `dist/`。部署时需要：

1. 使用静态服务器托管 `dist/`，并通过 HTTPS 提供访问。
2. 为前端路由配置 SPA 回退，将页面请求回退至 `index.html`。
3. 将 `/api` 反向代理至后端服务，并与开发环境一致移除 `/api` 前缀；Vite 的开发代理不会进入生产构建。
4. 为 SSE 接口关闭代理缓冲，并设置足够长的读取超时，保证流式回复及时到达。
5. 在后端配置数据库、认证与模型服务，避免将服务端密钥写入前端构建。

## 数据来源

省市联动数据来自 [Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China)，相关许可保留于 [`src/assets/regions.LICENSE`](./src/assets/regions.LICENSE)。
