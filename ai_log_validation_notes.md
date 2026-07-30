# AI日志浏览器验收记录

- 管理员已于 2026-07-30 10:54 GMT+8 登录开发预览。AI大脑页面可正常打开，新增「AI日志」为第 5 个 Tab。
- 2026-07-30 10:55 验证 AI日志 Tab：统计卡、日期/客户/关键词筛选、渠道/来源/发送状态/转人工下拉筛选、筛选及重置按钮、空状态均正确显示；当前数据库无 AI日志，统计均为 0。
- 2026-07-30 10:58 验证总控制台「查看 AI日志」快捷入口：点击后正确切换至 AI日志 Tab。
- 发现并修复：前端 `useRealtimeSync` 缺少 `aiLog` 分类映射；现已加入 `aiLog: ["aiLog"]` 并为其新增回归测试。
- 现有固定回复真实触发关键词：
  - 运费咨询：`运费`、`免邮`、`shipping`、`delivery fee`、`邮费`
  - 付款方式：`付款`、`payment`、`怎么还钱`、`银行转账`、`bank transfer`
  - 营业时间：`营业时间`、`几点开门`、`几点关门`、`open hours`、`operating hours`
  - 发货时间：`发货`、`几时到`、`什么时候到`、`shipping time`、`delivery time`、`几天到`
  - 问候语：`hi`、`hello`、`你好`、`hai`、`selamat`
  - 感谢：`谢谢`、`感谢`、`thank`、`thanks`、`terima kasih`
- 现有知识库真实触发关键词：
  - 会员制度：`会员`、`membership`、`加入会员`、`会员费`、`member`
  - 换盆服务：`换盆`、`repot`、`花盆`、`pot`
  - 植物养护：`养护`、`怎么养`、`浇水`、`光照`、`care`、`water`、`sunlight`
  - 退换货政策：`退货`、`换货`、`refund`、`exchange`、`退钱`
- 可截图的浏览器原始路径：
  - AI日志完整空状态：`/home/ubuntu/screenshots/3000-itmhn17401sdk81_2026-07-30_10-55-53_1144.webp`
  - AI大脑/固定回复已加载：`/home/ubuntu/screenshots/3000-itmhn17401sdk81_2026-07-30_10-59-20_6021.webp`
  - AI大脑/知识库已加载：`/home/ubuntu/screenshots/3000-itmhn17401sdk81_2026-07-30_10-59-41_1141.webp`

真实私聊/发送/转人工等数据相关验收尚缺少受控的 Messenger 测试客户消息；不能为截图伪造或回算日志。
