# V2.1.30补充6：库存管理交互增强—调查记录

## 已确认的现有实现

- `ProductsV2.tsx` 已有低库存筛选 `stockFilter=low`，后端当前固定为 `stockQuantity < 5`。
- `OrderCreatePage.tsx` 的商品搜索结果以 `<button>` 为整张商品卡片；未开启 `allowOversold` 且 `stockQuantity <= 0` 时会被禁用并置灰。
- 现有库存调整逻辑由后端商品库存调整接口处理，应复用该接口完成快捷补货，以保留库存调整审计记录。
- `getProductsEnhanced` 已返回 `orderedCount` 与 `completedCount`，但尚无按商品及统计类别获取订单和客户明细的接口。

## 本次实现范围

1. 将低库存筛选扩展为可输入阈值，并以该阈值查询 `stockQuantity < threshold`。
2. 将零库存商品卡片由单一禁用按钮拆为展示卡与独立快捷补货操作；补货成功后刷新搜索结果。
3. 新增受管理员权限保护的商品订单明细查询，按「已下单」或「已完成」类别返回订单号、客户信息和对应商品数量，并在商品管理页弹窗展示。
