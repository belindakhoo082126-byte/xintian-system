# 版本2合并与 API 恢复记录

## 2026-08-25 开发预览故障

在将最新稳定版本2历史以普通方式整合至 GitHub `version2` 主线时，Git 合并未完成的冲突标记进入了 `server/db.ts`、手动订单页和商城结账页。开发服务器无法解析 `server/db.ts` 的 `<<<<<<<` 标记，因而返回 HTML 错误页；浏览器中的 tRPC 客户端随后把 HTML 当作 JSON 解析，显示 `Unexpected token '<'`。

## 修复与核对

已保留本地已发布且经完整测试的最新版本2运费逻辑，清除五个冲突文件中的合并标记，并完成普通合并提交；没有执行强制推送、重置或任何版本1分支／Tag操作。重启开发服务后，本地根路径返回 `200 text/html`，`/api/trpc/auth.me` 返回 `200 application/json`；开发首页已加载Dashboard真实数据，没有再次出现HTML作为JSON解析的错误。
