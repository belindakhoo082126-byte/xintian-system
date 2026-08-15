# Meta 公开政策页面生产核验记录

## 2026-08-15

公开政策页面已加入前端路由并通过开发环境视觉核验，路径如下：

- `/privacy-policy`
- `/terms-of-service`
- `/data-deletion`

首次生产域名核验遇到部署传播期间的旧版本响应：`www.xintian.com.my/privacy-policy` 一度返回应用内 404；默认生产域名一度显示登录提示。自动发布完成后已重新核验，两个现象均未再出现。

## 最终生产核验

- `https://www.xintian.com.my/mall` 可由未登录访问者正常浏览，确认商城公开入口不受后台认证保护。
- `https://www.xintian.com.my/privacy-policy` 可由未登录访问者正常访问，页面含隐私政策全文、公司联络资料，以及服务条款与资料删除页面的交叉链接。
- 本次发布完成后，可将下列正式网址填写到 Meta 应用设置：

| Meta 字段 | 正式网址 |
|---|---|
| 隐私权政策网址 | `https://www.xintian.com.my/privacy-policy` |
| 服务条款网址 | `https://www.xintian.com.my/terms-of-service` |
| 用户数据删除说明网址 | `https://www.xintian.com.my/data-deletion` |

该记录不包含任何应用密钥或访问口令。
