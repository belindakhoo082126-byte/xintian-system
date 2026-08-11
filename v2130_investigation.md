# V2.1.30 Investigation Findings

## Problem 1: Dashboard多汇款重复计数
- Screenshot shows 多汇款 = 3, but user says only 2 orders
- Orders XT00019, XT00021, XT00023, XT00031 visible in list
- XT00021 has 多汇款 status
- Need to check: getSpecialOrderFollowUpStats in db.ts
- Previous fix added both orders table + order_special_statuses table counts → may double-count
- Need to use DISTINCT or UNION to avoid counting same order twice

## Problem 2: 异常保存乱码+重复记录
- Screenshot shows error: "创建异常失败: Failed query: select ... from `order_exceptions` where `order_exceptions`.`id` = ? limit ? params: NaN, 1"
- The NaN param means the insert returned NaN as the ID
- Also screenshot shows 2 identical exception records "商品缺货 x1 — 更换商品"
- Root cause: createOrderException may be inserting and then querying with NaN id
- Also the exception is being created twice (duplicate)

## Problem 3: 更换商品后库存数量同步
- Screenshot shows MON 龟背竹 x5, replacement ECO21 果肥 1kg x1
- User says: MON already selected as out of stock 1, so MON should become 4
- resolveOrderException needs to reduce original item quantity by the exception quantity
- Also replacement product needs stock deduction

## Problem 4: 快递公司只显示Poslaju/LineClear
- In PackingDetail, shipping company dropdown should only show Poslaju and Line Clear (ParcelDaily services)
- Need to check PackingDetail.tsx for shipping company selection

## Problem 5: Lalamove自动显示
- If order delivery method is lalamove, package info should auto-show lalamove
- No need for other shipping options

## Problem 6: 东马Shopee自动显示
- If order delivery method is east_malaysia_shopee, package info should auto-show Shopee
- No need for other shipping options
- After shipping, staff selects "确认完整发货"

## Key Files:
- /home/ubuntu/xintian_system/server/db.ts - getSpecialOrderFollowUpStats, createOrderException, resolveOrderException
- /home/ubuntu/xintian_system/server/routers.ts - orderException.create, orderException.resolve
- /home/ubuntu/xintian_system/client/src/pages/PackingDetail.tsx - shipping company display, exception handling UI
- /home/ubuntu/xintian_system/client/src/pages/Dashboard.tsx - special status display
