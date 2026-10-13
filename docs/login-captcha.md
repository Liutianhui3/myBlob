# 登录真人验证（腾讯云）

登录表单校验通过后调用腾讯云弹窗验证码，验证成功才发送登录请求。注册不受本次变更影响。取消、失败、加载失败、超时均不发送登录请求；每次重试重新获取票据。未配置时阻止登录，不以演示验证放行。

## 配置

在腾讯云验证码控制台创建 Web 验证码应用并配置站点域名。在 `.env.local` 设置 `VITE_TENCENT_CAPTCHA_APP_ID=你的应用ID`，重启开发服务或重新构建部署。此值是公开的应用 ID；AppSecretKey 和腾讯云访问密钥仅保存在后端。

## 后端必需工作

`POST /users/login` 除 username、password 外新增必填字段 `captchaTicket` 和 `captchaRandstr`。后端使用腾讯云 SDK 调用验证码服务的 `DescribeCaptchaResult`：CaptchaType=9，Ticket=captchaTicket，Randstr=captchaRandstr，CaptchaAppId=应用 ID，AppSecretKey=应用密钥，UserIp=可信来源的客户端 IP。

必须在验证密码和签发登录 token 之前校验票据；仅业务返回 `CaptchaCode === 1` 时继续。缺失、失效、重放、错误票据或服务异常均拒绝登录，不要仅检查前端发来了字段。票据一次性使用，登录失败后前端也会重新验证。不要将密钥写入 VITE 环境变量或前端代码。

相邻的 `../my-blob-api` 已实现上述票据校验。其 `.env` 还需配置腾讯云 API 访问凭证 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`，以及验证码应用配置 `TENCENT_CAPTCHA_APP_ID`、`TENCENT_CAPTCHA_APP_SECRET_KEY`。应用密钥与 API SecretKey 是两种不同凭证，不能互相替代。配置后重启后端；前端 `.env.local` 已同步 example 中的应用 ID，需重启 Vite 或重新构建。

官方接入文档：https://cloud.tencent.com/document/product/1110/36841
服务端接口：https://cloud.tencent.com/document/api/1110/36926
