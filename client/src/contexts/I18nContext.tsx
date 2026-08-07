import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "zh" | "en";
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Replaces named placeholders such as {count} without changing a missing value.
 * Keeping this helper independent makes it safe to use for dynamic business labels,
 * toasts, and confirmation messages throughout the admin system.
 */
export function interpolateTranslation(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{([\w.-]+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

const translations: Record<string, Record<Lang, string>> = {
  // Dashboard
  "dashboard.title": { zh: "仪表板", en: "Dashboard" },
  "dashboard.orderAlerts": { zh: "订单提醒", en: "Order Alerts" },
  "dashboard.pendingPayment": { zh: "待审核付款", en: "Pending Payment" },
  "dashboard.pendingShipment": { zh: "待出货", en: "Pending Shipment" },
  "dashboard.partialShipped": { zh: "部分发货", en: "Partial Shipped" },
  "dashboard.unpaidOrders": { zh: "未汇款订单", en: "Unpaid Orders" },
  "dashboard.paidThisMonth": { zh: "本月已汇款", en: "Paid This Month" },
  "dashboard.holdOrders": { zh: "保留订单", en: "Hold Orders" },
  "dashboard.lowStock": { zh: "库存不足", en: "Low Stock" },
  "dashboard.outOfStock": { zh: "缺货商品", en: "Out of Stock" },
  "dashboard.todayOrders": { zh: "今日订单", en: "Today's Orders" },
  "dashboard.todayShipped": { zh: "今日已发货", en: "Today's Shipped" },
  "dashboard.todaySales": { zh: "今日销售额", en: "Today's Sales" },
  "dashboard.monthSales": { zh: "本月销售额", en: "Month Sales" },
  "dashboard.scheduledToday": { zh: "今日预约发货", en: "Scheduled Today" },
  "dashboard.repotOrders": { zh: "换盆安排", en: "Repot Orders" },
  "dashboard.holdExpiring": { zh: "保留订单", en: "Hold Expiring" },

  // Navigation
  "nav.dashboard": { zh: "仪表板", en: "Dashboard" },
  "nav.orders": { zh: "订单管理", en: "Orders" },
  "nav.packing": { zh: "包货工作台", en: "Packing" },
  "nav.products": { zh: "商品管理", en: "Products" },
  "nav.inventory": { zh: "进货库存", en: "Inventory" },
  "nav.customers": { zh: "客户管理", en: "Customers" },
  "nav.membership": { zh: "会员系统", en: "Membership" },
  "nav.businessReport": { zh: "经营报告", en: "Business Report" },
  "nav.paymentSettings": { zh: "付款设定", en: "Payment Settings" },
  "nav.shippingRules": { zh: "运费规则", en: "Shipping Rules" },
  "nav.logistics": { zh: "物流整合", en: "Logistics" },
  "nav.mallSettings": { zh: "商城管理", en: "Mall Settings" },
  "nav.systemSettings": { zh: "系统设置", en: "System Settings" },
  "nav.facebookSettings": { zh: "Facebook 设置", en: "Facebook Settings" },

  // Common
  "common.loading": { zh: "加载中...", en: "Loading..." },
  "common.save": { zh: "保存", en: "Save" },
  "common.cancel": { zh: "取消", en: "Cancel" },
  "common.confirm": { zh: "确认", en: "Confirm" },
  "common.delete": { zh: "删除", en: "Delete" },
  "common.edit": { zh: "编辑", en: "Edit" },
  "common.add": { zh: "新增", en: "Add" },
  "common.back": { zh: "返回", en: "Back" },
  "common.search": { zh: "搜索", en: "Search" },
  "common.status": { zh: "状态", en: "Status" },
  "common.actions": { zh: "操作", en: "Actions" },
  "common.remark": { zh: "备注", en: "Remark" },
  "common.date": { zh: "日期", en: "Date" },
  "common.quantity": { zh: "数量", en: "Quantity" },
  "common.price": { zh: "价格", en: "Price" },
  "common.total": { zh: "总计", en: "Total" },

  // Order Status
  "status.pending": { zh: "未汇款订单", en: "Unpaid Order" },
  "status.receipt_uploaded": { zh: "待审核付款凭证", en: "Pending Payment Verification" },
  "status.hold_order": { zh: "保留订单", en: "Hold Order" },
  "status.packing": { zh: "待包货", en: "Pending Packing" },
  "status.shipped": { zh: "已发货", en: "Shipped" },
  "status.partial_shipped": { zh: "部分发货", en: "Partial Shipped" },
  "status.completed": { zh: "已完成", en: "Completed" },
  "status.cancelled": { zh: "已取消", en: "Cancelled" },
  "status.partial_payment": { zh: "部分汇款", en: "Partial Payment" },
  "status.special": { zh: "特别订单", en: "Special Order" },

  // Order Detail
  "order.detail": { zh: "订单详情", en: "Order Detail" },
  "order.items": { zh: "商品明细", en: "Order Items" },
  "order.summary": { zh: "订单摘要", en: "Order Summary" },
  "order.paymentMethod": { zh: "付款方式", en: "Payment Method" },
  "order.remarks": { zh: "订单备注", en: "Order Remarks" },
  "order.repot": { zh: "换盆安排", en: "Repot Arrangement" },
  "order.scheduledShipping": { zh: "预约发货", en: "Scheduled Shipping" },
  "order.statusHistory": { zh: "状态变更记录", en: "Status History" },
  "order.notifications": { zh: "通知记录", en: "Notifications" },
  "order.confirmPayment": { zh: "确认汇款", en: "Confirm Payment" },
  "order.holdOrder": { zh: "保留订单", en: "Hold Order" },
  "order.changeStatus": { zh: "手动变更状态", en: "Change Status" },

  // Remark types
  "remark.live": { zh: "直播备注", en: "Live Remark" },
  "remark.customer": { zh: "客户备注", en: "Customer Remark" },
  "remark.internal": { zh: "内部备注", en: "Internal Remark" },

  // Live Studio
  "live.products": { zh: "商品", en: "Products" },
  "live.orders": { zh: "订单", en: "Orders" },
  "live.items": { zh: "件数", en: "Items" },
  "live.revenue": { zh: "业绩", en: "Revenue" },
  "live.startLive": { zh: "开始直播", en: "Start Live" },
  "live.endLive": { zh: "结束直播", en: "End Live" },
  "live.back": { zh: "返回", en: "Back" },
  "live.backToConsole": { zh: "返回控制台", en: "Back to Console" },
  "live.localLive": { zh: "本地直播", en: "Local Live" },
  "live.chinaProxy": { zh: "中国代购", en: "China Proxy" },
  "live.preparing": { zh: "准备中", en: "Preparing" },
  "live.live": { zh: "直播中", en: "Live" },
  "live.ended": { zh: "已结束", en: "Ended" },
  "live.closed": { zh: "已截止", en: "Closed" },
  "live.liveControl": { zh: "直播控制", en: "Live Control" },
  "live.aiAutoReply": { zh: "AI 自动回复", en: "AI Auto Reply" },
  "live.continuousMonitor": { zh: "持续监控留言", en: "Continuous Monitor" },
  "live.keepCapturing": { zh: "直播结束后继续捉单", en: "Keep Capturing After Live Ends" },
  "live.productArea": { zh: "商品区", en: "Products" },
  "live.searchProducts": { zh: "搜索商品名称/SKU/关键词...", en: "Search product name/SKU/keyword..." },
  "live.largeCard": { zh: "大卡", en: "Large Card" },
  "live.compact": { zh: "紧凑", en: "Compact" },
  "live.inStock": { zh: "现货:", en: "Stock:" },
  "live.called": { zh: "已喊:", en: "Called:" },
  "live.available": { zh: "可卖:", en: "Avail:" },
  "live.changePrice": { zh: "改价", en: "Price" },
  "live.adjustStock": { zh: "库存", en: "Stock" },
  "live.copyKeyword": { zh: "复制", en: "Copy" },
  "live.removeProduct": { zh: "取消", en: "Remove" },
  "live.preorder": { zh: "预购", en: "Preorder" },
  "live.noImage": { zh: "无图", en: "No Image" },
  "live.noProducts": { zh: "暂无商品，点击「加入商品」", en: "No products yet. Click \"Add Products\"" },
  "live.addProducts": { zh: "加入商品", en: "Add Products" },
  "live.batchAdd": { zh: "批量加入", en: "Batch Add" },
  "live.commentArea": { zh: "留言区", en: "Comments" },
  "live.inputComment": { zh: "输入留言内容发送到直播...", en: "Type comment to send to live..." },
  "live.send": { zh: "发送", en: "Send" },
  "live.paste": { zh: "贴上", en: "Paste" },
  "live.searchComments": { zh: "搜索客户/内容/关键词/商品...", en: "Search customer/content/keyword/product..." },
  "live.allStatus": { zh: "全部状态", en: "All Status" },
  "live.blacklist": { zh: "黑名单", en: "Blacklist" },
  "live.staffNote": { zh: "工作人员备注", en: "Staff Note" },
  "live.reply": { zh: "回复", en: "Reply" },
  "live.order": { zh: "下单", en: "Order" },
  "live.addToBlacklist": { zh: "加入黑名单", en: "Add to Blacklist" },
  "live.noComments": { zh: "暂无留言", en: "No comments yet" },
  "live.noNotes": { zh: "暂无备注", en: "No notes yet" },
  "live.winningOrders": { zh: "得标订单", en: "Winning Orders" },
  "live.byCustomer": { zh: "按客户", en: "By Customer" },
  "live.byProduct": { zh: "按商品", en: "By Product" },
  "live.searchOrders": { zh: "搜索订单号/客户名...", en: "Search order#/customer..." },
  "live.queryOrder": { zh: "查询订单", en: "Query Order" },
  "live.copy": { zh: "复制", en: "Copy" },
  "live.copyWinningList": { zh: "复制得标名单", en: "Copy Winning List" },
  "live.noOrders": { zh: "暂无订单", en: "No orders yet" },
  "live.pendingPayment": { zh: "待汇款", en: "Pending Payment" },
  "live.paid": { zh: "已付", en: "Paid" },
  "live.shipped": { zh: "已发货", en: "Shipped" },
  "live.completed": { zh: "已完成", en: "Completed" },
  "live.liveReport": { zh: "直播报告", en: "Live Report" },
  "live.viewReport": { zh: "查看报告", en: "View Report" },
  "live.duration": { zh: "直播时长", en: "Duration" },
  "live.totalComments": { zh: "总留言数", en: "Total Comments" },
  "live.orderCount": { zh: "自动捉单数", en: "Auto Orders" },
  "live.successOrders": { zh: "成功订单数", en: "Successful Orders" },
  "live.productItems": { zh: "商品销售件数", en: "Items Sold" },
  "live.totalSales": { zh: "销售总额", en: "Total Sales" },
  "live.paidAmount": { zh: "已付金额", en: "Paid Amount" },
  "live.newCustomers": { zh: "新客户数量", en: "New Customers" },
  "live.messengerNotif": { zh: "Messenger 通知", en: "Messenger Notifications" },
  "live.startTime": { zh: "开始时间", en: "Start Time" },
  "live.endTime": { zh: "结束时间", en: "End Time" },
  "live.sent": { zh: "已发送", en: "Sent" },
  "live.sendFailed": { zh: "发送失败", en: "Send Failed" },
  "live.successRate": { zh: "成功率", en: "Success Rate" },
  "live.showVideo": { zh: "显示直播画面", en: "Show Live Video" },
  "live.liveVideo": { zh: "直播画面", en: "Live Video" },
  "live.confirmEnd": { zh: "确认结束直播？", en: "Confirm end live?" },
  "live.confirmEndDesc": { zh: "结束后将停止捉单，所有订单将自动整理。客户将收到结单通知。", en: "Capturing will stop and all orders will be finalized. Customers will receive a notification." },
  "live.confirm": { zh: "确认结束", en: "Confirm End" },
  "live.adjustStockTitle": { zh: "调整库存", en: "Adjust Stock" },
  "live.stockChangeReason": { zh: "数量变化（正数增加，负数减少）", en: "Quantity change (positive to add, negative to reduce)" },
  "live.reason": { zh: "原因", en: "Reason" },
  "live.confirmAdjust": { zh: "确认调整", en: "Confirm" },
  "live.changePriceTitle": { zh: "修改直播售价", en: "Change Live Price" },
  "live.livePrice": { zh: "直播售价（RM）", en: "Live Price (RM)" },
  "live.useOriginalPrice": { zh: "使用原价", en: "Use Original Price" },
  "live.customPrice": { zh: "自定义价", en: "Custom Price" },
  "live.priceNote": { zh: "此价格仅影响当前直播，不会修改正式商品售价。", en: "This price only affects this live session, not the official product price." },
  "live.save": { zh: "保存", en: "Save" },
  "live.addNote": { zh: "添加备注...", en: "Add note..." },
  "live.blacklistReason": { zh: "请输入加入黑名单的原因...", en: "Enter blacklist reason..." },
  "live.matched": { zh: "已捉单", en: "Matched" },
  "live.noMatch": { zh: "未匹配", en: "No Match" },
  "live.productPaused": { zh: "商品暂停", en: "Product Paused" },
  "live.soldOut": { zh: "已售完", en: "Sold Out" },
  "live.duplicateComment": { zh: "重复留言", en: "Duplicate" },
  "live.ignored": { zh: "已忽略", en: "Ignored" },
  "live.aiReplied": { zh: "AI回复", en: "AI Replied" },
  "live.orderMerged": { zh: "已合单", en: "Order Merged" },
  "live.normal": { zh: "正常", en: "Active" },
  "live.paused": { zh: "暂停捉单", en: "Paused" },
  "live.unknown": { zh: "未知", en: "Unknown" },
  "live.unknownCustomer": { zh: "未知客户", en: "Unknown Customer" },
  "live.loading": { zh: "加载中...", en: "Loading..." },
  "live.notFound": { zh: "直播房间不存在", en: "Live room not found" },
  "live.hotProducts": { zh: "热卖商品", en: "Hot Products" },
  "live.spec": { zh: "规格", en: "Variant" },
  "live.confirmAdd": { zh: "确认加入", en: "Confirm Add" },
  "live.allCategories": { zh: "全部分类", en: "All Categories" },
  "live.selectProducts": { zh: "请选择至少一个商品", en: "Please select at least one product" },
  "live.notFoundProduct": { zh: "未找到商品", en: "Product not found" },
  "live.noProductOrders": { zh: "暂无商品订单", en: "No product orders" },
  "live.markProcessed": { zh: "标记已处理", en: "Mark Processed" },
  "live.commentDetail": { zh: "留言详情", en: "Comment Detail" },
  "live.close": { zh: "关闭", en: "Close" },
  "live.other": { zh: "其他", en: "Other" },
  "live.scrap": { zh: "报废", en: "Scrap" },
  "live.damaged": { zh: "损坏", en: "Damaged" },
  "live.restock": { zh: "补货", en: "Restock" },
  "live.retry": { zh: "重试", en: "Retry" },
  "live.notification": { zh: "通知", en: "Notification" },
  "live.removed": { zh: "已移除", en: "Removed" },
  "live.streamer": { zh: "主播:", en: "Streamer:" },
  "live.productUnit": { zh: "个", en: "items" },
  "live.orderUnit": { zh: "笔", en: "orders" },
  "live.pasteClipboard": { zh: "贴上剪贴板内容", en: "Paste clipboard content" },
  "live.addProductsToRoom": { zh: "加入商品到直播房", en: "Add Products to Live Room" },
  "live.inputLivePrice": { zh: "输入直播特价", en: "Enter live special price" },
  "live.stockCorrection": { zh: "库存修正", en: "Stock Correction" },
  "live.pause": { zh: "暂停", en: "Pause" },
  "live.resume": { zh: "恢复", en: "Resume" },
  "live.hours": { zh: "小时", en: "h" },
  "live.minutes": { zh: "分钟", en: "m" },
  "live.selected": { zh: "已选", en: "Selected" },
  "live.added": { zh: "已加入", en: "Added" },
  "live.customer": { zh: "客户:", en: "Customer:" },
  "live.keywords": { zh: "关键词:", en: "Keywords:" },
  "live.product": { zh: "商品:", en: "Product:" },
  "live.price": { zh: "价格", en: "Price" },
  "live.quantity": { zh: "数量:", en: "Qty:" },
  "live.operationFailed": { zh: "操作失败", en: "Operation failed" },
  "live.removeFailed": { zh: "移除失败", en: "Remove failed" },
  "live.adjustFailed": { zh: "调整失败", en: "Adjust failed" },
  "live.copyFailed": { zh: "复制失败", en: "Copy failed" },
  "live.addFailed": { zh: "添加失败", en: "Add failed" },
  "live.deleteFailed": { zh: "删除失败", en: "Delete failed" },
  "live.batchAddFailed": { zh: "批量加入失败", en: "Batch add failed" },
  "live.batchAdded": { zh: "已批量加入", en: "Batch added" },
  "live.stockAdjusted": { zh: "库存已调整，当前库存:", en: "Stock adjusted, current stock:" },
  "live.noteDeleted": { zh: "备注已删除", en: "Note deleted" },
  "live.noteAdded": { zh: "备注已添加", en: "Note added" },
  "live.statusUpdated": { zh: "直播状态已更新", en: "Live status updated" },
  "live.liveStarted": { zh: "直播已开始", en: "Live started" },
  "live.liveEnded": { zh: "直播已结束，捉单已停止", en: "Live ended, capturing stopped" },
  "live.preorderUpdated": { zh: "预购设置已更新", en: "Preorder setting updated" },
  "live.clipboardReadFailed": { zh: "无法读取剪贴板", en: "Cannot read clipboard" },
  "live.commentSent": { zh: "留言已发送到 Facebook 直播", en: "Comment sent to Facebook Live" },
  "live.commentMarked": { zh: "留言已标记为已处理", en: "Comment marked as processed" },
  "live.blacklistUpdated": { zh: "黑名单状态已更新", en: "Blacklist status updated" },
  "live.blacklistNeedCustomerId": { zh: "黑名单功能需要客户ID，请通过客户管理页面操作", en: "Blacklist requires customer ID. Please use customer management page." },
  "live.dmFailed": { zh: "私聊失败", en: "DM failed" },
  "live.unknownError": { zh: "未知错误", en: "Unknown error" },
  "live.noMatchingOrder": { zh: "未找到匹配订单", en: "No matching order found" },
  "live.videoLoadFailed": { zh: "直播画面加载失败，捉单功能不受影响", en: "Live video load failed. Capturing is not affected." },
  "live.noVideoId": { zh: "未设置 Facebook 视频 ID，无法发送留言", en: "No Facebook Video ID set. Cannot send comments." },
    "live.copyWinningListToast": { zh: "得标名单已复制", en: "Winner list copied" },
  "live.copyKeywordToast": { zh: "关键词文案已复制到剪贴板", en: "Keywords copied to clipboard" },
  // Live Rooms list page
  "liveRooms.title": { zh: "直播控制中心", en: "Live Control Center" },
  "liveRooms.subtitle": { zh: "开播前整理商品 · 直播期间自动捉单 · 直播结束自动结算", en: "Prepare products before live · Auto-capture during live · Auto-settle after live" },
  "liveRooms.createRoom": { zh: "建立直播房", en: "Create Live Room" },
  "liveRooms.editRoom": { zh: "编辑直播房", en: "Edit Live Room" },
  "liveRooms.roomName": { zh: "直播名称", en: "Live Name" },
  "liveRooms.roomNamePlaceholder": { zh: "例如: 7月直播", en: "e.g. July Live" },
  "liveRooms.liveDate": { zh: "直播日期", en: "Live Date" },
  "liveRooms.liveType": { zh: "直播类型", en: "Live Type" },
  "liveRooms.localLive": { zh: "本地直播", en: "Local Live" },
  "liveRooms.importPreorder": { zh: "中国代购", en: "China Pre-order" },
  "liveRooms.streamer": { zh: "主播", en: "Streamer" },
  "liveRooms.streamerPlaceholder": { zh: "主播名称", en: "Streamer name" },
  "liveRooms.streamerOptional": { zh: "主播（可选）", en: "Streamer (optional)" },
  "liveRooms.notes": { zh: "备注", en: "Notes" },
  "liveRooms.cancel": { zh: "取消", en: "Cancel" },
  "liveRooms.save": { zh: "保存", en: "Save" },
  "liveRooms.createAndEnter": { zh: "建立并进入直播房", en: "Create & Enter Live Room" },
  "liveRooms.all": { zh: "全部", en: "All" },
  "liveRooms.loading": { zh: "加载中...", en: "Loading..." },
  "liveRooms.noImportPreorder": { zh: "暂无中国代购直播", en: "No China pre-order live sessions" },
  "liveRooms.noLocalLive": { zh: "暂无本地直播", en: "No local live sessions" },
  "liveRooms.noLiveAtAll": { zh: "暂无直播，点击右上角建立直播房", en: "No live sessions yet. Click 'Create Live Room' to start." },
  "liveRooms.colName": { zh: "直播名称", en: "Live Name" },
  "liveRooms.colType": { zh: "类型", en: "Type" },
  "liveRooms.colDate": { zh: "直播日期", en: "Date" },
  "liveRooms.colStreamer": { zh: "主播", en: "Streamer" },
  "liveRooms.colStatus": { zh: "状态", en: "Status" },
  "liveRooms.colProductCount": { zh: "商品数", en: "Products" },
  "liveRooms.colOrderCount": { zh: "订单数", en: "Orders" },
  "liveRooms.colTotalItems": { zh: "商品数量", en: "Items" },
  "liveRooms.colRevenue": { zh: "喊单业绩", en: "Revenue" },
  "liveRooms.colActions": { zh: "操作", en: "Actions" },
  "liveRooms.statusPreparing": { zh: "准备中", en: "Preparing" },
  "liveRooms.statusLive": { zh: "直播中", en: "Live" },
  "liveRooms.statusEnded": { zh: "已结束", en: "Ended" },
  "liveRooms.statusClosed": { zh: "已截止", en: "Closed" },
  "liveRooms.confirmDelete": { zh: "确认删除？", en: "Confirm delete?" },
  "liveRooms.createSuccess": { zh: "直播房创建成功，正在进入直播房...", en: "Live room created, entering..." },
  "liveRooms.updateSuccess": { zh: "直播房间更新成功", en: "Live room updated successfully" },
  "liveRooms.deleted": { zh: "已删除", en: "Deleted" },
  "liveRooms.createFailed": { zh: "创建失败", en: "Create failed" },
  "liveRooms.updateFailed": { zh: "更新失败", en: "Update failed" },
  "liveRooms.deleteFailed": { zh: "删除失败", en: "Delete failed" },
  "liveRooms.fillRequired": { zh: "请填写直播名称和日期", en: "Please fill in live name and date" },
  "liveRooms.importBatch": { zh: "所属采购批次", en: "Import Batch" },
  "liveRooms.selectBatch": { zh: "选择批次", en: "Select batch" },
  "liveRooms.estimatedWait": { zh: "预计等待时间", en: "Estimated Wait Time" },
  "liveRooms.estimatedWaitPlaceholder": { zh: "例如: 30~45天", en: "e.g. 30~45 days" },
  "liveRooms.preorderStart": { zh: "代购开始日期", en: "Pre-order Start Date" },
  "liveRooms.preorderEnd": { zh: "代购截止日期", en: "Pre-order End Date" },
  "liveRooms.fbLiveLink": { zh: "Facebook Live Link", en: "Facebook Live Link" },
  "liveRooms.fbLiveLinkPlaceholder": { zh: "https://www.facebook.com/...（可填写，也可自动取得）", en: "https://www.facebook.com/... (optional, auto-fetched if empty)" },
  "liveRooms.fbVideoId": { zh: "Facebook Video ID", en: "Facebook Video ID" },
  "liveRooms.fbVideoIdPlaceholder": { zh: "系统自动取得", en: "Auto-fetched by system" },
  "liveRooms.fbPageId": { zh: "Facebook Page", en: "Facebook Page" },
  "liveRooms.fbPageIdPlaceholder": { zh: "Facebook Page ID", en: "Facebook Page ID" },

  // Campaigns page
  "campaigns.title": { zh: "Facebook Campaign", en: "Facebook Campaign" },
  "campaigns.create": { zh: "新建 Campaign", en: "Create Campaign" },
  "campaigns.searchPlaceholder": { zh: "搜索 Campaign 名称、类型、链接...", en: "Search campaign name, type, link..." },
  "campaigns.loading": { zh: "加载中...", en: "Loading..." },
  "campaigns.empty": { zh: "暂无 Campaign，点击「新建 Campaign」创建第一个", en: "No campaigns yet. Click \"Create Campaign\" to create your first one" },
  "campaigns.contentCount": { zh: "个内容绑定", en: "content links" },
  "campaigns.statOrders": { zh: "建单", en: "Orders" },
  "campaigns.statMerged": { zh: "合并", en: "Merged" },
  "campaigns.statQuantity": { zh: "销量", en: "Qty Sold" },
  "campaigns.statRevenue": { zh: "营业额", en: "Revenue" },
  "campaigns.start": { zh: "启动", en: "Activate" },
  "campaigns.end": { zh: "结束", en: "End" },
  "campaigns.archive": { zh: "封存", en: "Archive" },
  "campaigns.restore": { zh: "恢复", en: "Restore" },
  "campaigns.delete": { zh: "删除", en: "Delete" },
  "campaigns.confirmDelete": { zh: "确定要永久删除此 Campaign 吗？相关的 Flow 和 Button 也会被删除。", en: "Are you sure you want to permanently delete this campaign? Related Flows and Buttons will also be deleted." },
  "campaigns.confirmArchive": { zh: "确定要封存此 Campaign 吗？", en: "Archive this campaign?" },
  "campaigns.deleted": { zh: "Campaign 已删除", en: "Campaign deleted" },
  "campaigns.duplicated": { zh: "Campaign 已复制", en: "Campaign duplicated" },
  "campaigns.deleteFailed": { zh: "删除失败", en: "Delete failed" },
  "campaigns.duplicateFailed": { zh: "复制失败", en: "Duplicate failed" },
  "campaigns.statusUpdated": { zh: "状态已更新为: {status}", en: "Status updated: {status}" },
  "campaigns.updateFailed": { zh: "更新失败", en: "Update failed" },
  "campaigns.filterAll": { zh: "全部", en: "All" },
  "campaigns.filterActive": { zh: "进行中", en: "Active" },
  "campaigns.filterEnded": { zh: "已结束", en: "Ended" },
  "campaigns.filterArchived": { zh: "已封存", en: "Archived" },
  "campaigns.statusDraft": { zh: "草稿", en: "Draft" },
  "campaigns.statusActive": { zh: "进行中", en: "Active" },
  "campaigns.statusEnded": { zh: "已结束", en: "Ended" },
  "campaigns.statusArchived": { zh: "已封存", en: "Archived" },
  "campaigns.editTitle": { zh: "编辑 Campaign", en: "Edit Campaign" },
  "campaigns.createTitle": { zh: "新建 Campaign", en: "Create Campaign" },
  "campaigns.tabSettings": { zh: "基本设置", en: "Basic Settings" },
  "campaigns.tabContentIds": { zh: "内容绑定", en: "Content Links" },
  "campaigns.tabFlows": { zh: "Messenger Flow", en: "Messenger Flow" },
  "campaigns.tabButtons": { zh: "Product Button", en: "Product Button" },
  "campaigns.nameLabel": { zh: "Campaign 名称", en: "Campaign Name" },
  "campaigns.namePlaceholder": { zh: "例: 8月新品发布", en: "e.g. August New Product Launch" },
  "campaigns.autoReplyLabel": { zh: "自动回复留言", en: "Auto-reply to Comments" },
  "campaigns.autoReplyDesc": { zh: "当客户留言无匹配关键词时自动回复", en: "Auto-reply when no keyword matches" },
  "campaigns.autoReplyTextLabel": { zh: "自动回复内容", en: "Auto-reply Text" },
  "campaigns.autoReplyTextPlaceholder": { zh: "例: 感谢您的留言！请输入商品关键词+数量下单，如 MON+1。如有疑问请联系客服。", en: "e.g. Thank you for your comment! To order, type product keyword + quantity, e.g. MON+1. Contact us for any questions." },
  "campaigns.messengerFlowLabel": { zh: "Messenger Flow", en: "Messenger Flow" },
  "campaigns.messengerFlowDesc": { zh: "无关键词匹配时发送 Messenger Flow", en: "Send Messenger Flow when no keyword matches" },
  "campaigns.nameRequired": { zh: "请输入 Campaign 名称", en: "Please enter campaign name" },
  "campaigns.updated": { zh: "Campaign 已更新", en: "Campaign updated" },
  "campaigns.created": { zh: "Campaign 已创建，现在可以编辑其他 Tab", en: "Campaign created, you can now edit other tabs" },
  "campaigns.saveFailed": { zh: "保存失败", en: "Save failed" },
  "campaigns.cancel": { zh: "取消", en: "Cancel" },
  "campaigns.save": { zh: "保存", en: "Save" },
  "campaigns.saving": { zh: "保存中...", en: "Saving..." },
  "campaigns.contentAddLabel": { zh: "添加 Facebook 内容链接", en: "Add Facebook Content Link" },
  "campaigns.contentAddDesc": { zh: "贴上 Facebook Post / Reel / Video 链接，系统自动识别类型和 ID。一个 Campaign 可绑定多个内容。", en: "Paste Facebook Post / Reel / Video link. The system auto-detects type and ID. One campaign can bind multiple content links." },
  "campaigns.contentAddPlaceholder": { zh: "https://www.facebook.com/...", en: "https://www.facebook.com/..." },
  "campaigns.contentAddBtn": { zh: "添加", en: "Add" },
  "campaigns.contentAdding": { zh: "添加中...", en: "Adding..." },
  "campaigns.contentBound": { zh: "内容已绑定", en: "Content linked" },
  "campaigns.contentBindFailed": { zh: "绑定失败", en: "Link failed" },
  "campaigns.contentLinkRequired": { zh: "请输入 Facebook 链接", en: "Please enter a Facebook link" },
  "campaigns.contentBoundList": { zh: "已绑定的 Facebook 内容", en: "Linked Facebook Content" },
  "campaigns.contentEmpty": { zh: "尚未绑定任何 Facebook 内容。请在上方添加链接。", en: "No Facebook content linked yet. Add a link above." },
  "campaigns.contentOpenLink": { zh: "打开链接", en: "Open link" },
  "campaigns.flowTitle": { zh: "Messenger Flow 步骤", en: "Messenger Flow Steps" },
  "campaigns.flowAddStep": { zh: "添加步骤", en: "Add Step" },
  "campaigns.flowEmpty": { zh: "暂无 Flow 步骤，点击「添加步骤」创建", en: "No flow steps yet. Click \"Add Step\" to create one" },
  "campaigns.flowAdded": { zh: "Flow 步骤已添加", en: "Flow step added" },
  "campaigns.flowAddFailed": { zh: "添加失败", en: "Add failed" },
  "campaigns.flowDeleteConfirm": { zh: "确定删除此 Flow 步骤？", en: "Delete this flow step?" },
  "campaigns.flowDeleted": { zh: "已删除", en: "Deleted" },
  "campaigns.flowDeleteFailed": { zh: "删除失败", en: "Delete failed" },
  "campaigns.flowReorderFailed": { zh: "排序失败", en: "Reorder failed" },
  "campaigns.flowTypeLabel": { zh: "类型", en: "Type" },
  "campaigns.flowContentLabel": { zh: "内容", en: "Content" },
  "campaigns.flowMediaUrlLabel": { zh: "媒体 URL", en: "Media URL" },
  "campaigns.flowTypeText": { zh: "文字", en: "Text" },
  "campaigns.flowTypeImage": { zh: "图片", en: "Image" },
  "campaigns.flowTypeVideo": { zh: "视频", en: "Video" },
  "campaigns.flowTypeProductIntro": { zh: "商品介绍", en: "Product Intro" },
  "campaigns.flowTypeButton": { zh: "商品按钮", en: "Button" },
  "campaigns.buttonTitle": { zh: "Product Button", en: "Product Button" },
  "campaigns.buttonAdd": { zh: "添加按钮", en: "Add Button" },
  "campaigns.buttonEmpty": { zh: "暂无按钮，点击「添加按钮」创建", en: "No buttons yet. Click \"Add Button\" to create one" },
  "campaigns.buttonAdded": { zh: "按钮已添加", en: "Button added" },
  "campaigns.buttonAddFailed": { zh: "添加失败", en: "Add failed" },
  "campaigns.buttonDeleteConfirm": { zh: "确定删除此按钮？", en: "Delete this button?" },
  "campaigns.buttonDeleted": { zh: "已删除", en: "Deleted" },
  "campaigns.buttonDeleteFailed": { zh: "删除失败", en: "Delete failed" },
  "campaigns.buttonUpdateFailed": { zh: "更新失败", en: "Update failed" },
  "campaigns.buttonNameLabel": { zh: "按钮名称", en: "Button Name" },
  "campaigns.buttonNamePlaceholder": { zh: "例: 立即购买 MON", en: "e.g. Buy Now MON" },
  "campaigns.buttonProductLabel": { zh: "绑定商品", en: "Linked Product" },
  "campaigns.buttonProductPlaceholder": { zh: "选择商品", en: "Select product" },
  "campaigns.buttonQtyLabel": { zh: "数量", en: "Quantity" },
  "campaigns.buttonQty": { zh: "数量", en: "Qty" },
  // Checkout & Notification
  "orders.checkoutLink": { zh: "Checkout 链接", en: "Checkout Link" },
  "orders.copyLink": { zh: "复制链接", en: "Copy Link" },
  "orders.openLink": { zh: "打开链接", en: "Open Link" },
  "orders.shareWhatsApp": { zh: "WhatsApp 分享", en: "Share via WhatsApp" },
  "orders.shareMessenger": { zh: "Messenger 分享", en: "Share via Messenger" },
  "orders.sendCheckoutMessenger": { zh: "发送 Checkout 到 Messenger", en: "Send Checkout to Messenger" },
  "orders.sendCheckoutSuccess": { zh: "Checkout 链接已发送到 Messenger", en: "Checkout link sent to Messenger" },
  "orders.sendCheckoutFailed": { zh: "发送失败: {message}", en: "Send failed: {message}" },
  "orders.checkoutCopied": { zh: "链接已复制到剪贴板", en: "Link copied to clipboard" },
  "orders.notifStatus": { zh: "通知状态", en: "Notification Status" },
  "orders.notifPending": { zh: "待发送", en: "Pending" },
  "orders.notifSent": { zh: "已发送", en: "Sent" },
  "orders.notifFailed": { zh: "发送失败", en: "Failed" },
  "orders.batchSendCheckout": { zh: "批量发送 Checkout 链接", en: "Batch Send Checkout Links" },
  "orders.sendAllPending": { zh: "发送全部未发送订单", en: "Send All Pending" },
  "orders.resendCheckout": { zh: "重新发送", en: "Resend" },
  "orders.notifError": { zh: "失败原因", en: "Error" },
  "orders.checkoutMessage": { zh: "老板娘您好，这是您的订单，请点击以下链接完成资料填写及付款，谢谢。", en: "Hello, here is your order. Please click the link below to fill in your details and complete payment. Thank you." },
  "orders.productImage": { zh: "商品图片", en: "Image" },
  "orders.sku": { zh: "SKU", en: "SKU" },
};
interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: TranslationParams) => string;
  /** Use for page-local text while the shared dictionary is being expanded. */
  translate: (zh: string, en: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "zh",
  setLang: () => {},
  t: (key: string) => key,
  translate: (zh: string) => zh,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with localStorage for instant first paint, then sync with server
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("xintian-lang");
    return (saved === "en" || saved === "zh") ? saved : "zh";
  });
  const [serverLang, setServerLang] = useState<Lang | null>(null);

  // Listen for auth state changes to sync language from server
  useEffect(() => {
    const checkServerLang = () => {
      try {
        const cookie = document.cookie;
        // If user is logged in, fetch their preferred language from the server
        // We use a lightweight fetch to avoid circular dependency with trpc
        fetch("/api/trpc/auth.me", {
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => res.json())
          .then((data) => {
            const user = data?.result?.data;
            if (user?.preferredLanguage) {
              const serverPref = user.preferredLanguage as Lang;
              setServerLang(serverPref);
              // Only override if server has a preference (not default) or if different from local
              if (serverPref !== lang) {
                setLangState(serverPref);
                localStorage.setItem("xintian-lang", serverPref);
              }
            }
          })
          .catch(() => {
            // Not logged in or error — keep localStorage value
          });
      } catch {
        // Keep localStorage value
      }
    };
    checkServerLang();
    // Re-check on window focus (multi-device sync)
    window.addEventListener("focus", checkServerLang);
    return () => window.removeEventListener("focus", checkServerLang);
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("xintian-lang", newLang);
    // Persist to server so each user has their own language preference
    try {
      fetch("/api/trpc/auth.updateLanguage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      }).catch(() => {
        // Non-critical: language is saved locally even if server call fails
      });
    } catch {
      // Non-critical
    }
  };

  const t = (key: string, params?: TranslationParams): string => {
    const entry = translations[key];
    const value = entry?.[lang] || entry?.zh || key;
    return interpolateTranslation(value, params);
  };

  const translate = (zh: string, en: string, params?: TranslationParams): string =>
    interpolateTranslation(lang === "zh" ? zh : en, params);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, translate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
