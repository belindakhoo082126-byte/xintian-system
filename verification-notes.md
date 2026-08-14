# Verification Notes

## 2026-08-14 — 商品中国代购资格

- 商品管理的实际后台路由为 `/products`；`/products-v2` 会正确显示 404，未改动路由。
- 商品列表接口已成功返回 `allowImportOrder` 字段；肥料示例资料可读到 `allowImportOrder: true`，普通本地商品为 `false`。
- 全页截图捕捉在列表请求完成前的短暂「加载中」状态；网络日志确认请求成功，未发现由本轮字段造成的页面或接口错误。
