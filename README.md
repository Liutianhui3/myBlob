# 我的博客

登录页 `/login`，注册页 `/register`，首页底部导航提供退出登录入口。
默认入口为 `/login`，首页和文章页需要登录。登录成功进入首页或原目标页，退出后回到登录页；登录和注册之间有平滑过渡，支持减少动态效果设置。
前端 `npm run dev` 默认运行于 `http://localhost:8082`；Vite 将 `/api` 代理到 `http://localhost:3000`，请同时启动相邻的 `my-blob-api` 项目。
生产部署需要将 `/api` 反向代理到后端，并通过 HTTPS 提供服务。

用户名为 3–32 位字母、数字或下划线，注册密码为 8–128 位且包含字母、数字；注册还需填写邮箱与确认密码。
登录成功后在 localStorage 的 `myblob_token` 中缓存令牌，接口请求通过 `Authorization: Bearer <token>` 认证，有效期一天。退出立即清除本地令牌并请求后端注销；密码不会保存到浏览器存储。令牌过期会自动清除，跨标签页退出会同步回到登录页。

### 博客搭建

目前博客刚完成框架搭建，后续会实时同步开发进度。已完成：

- 整体页面布局
- 暗黑模式切换

### 目前使用到的前端技术栈

- Vue3
- Typescript
- Pinia
- Tippy
- Tailwindcss
- motion-v
- Echarts
- Inspira UI

如果喜欢或者有所启发，欢迎 star，对作者也是一种鼓励。
