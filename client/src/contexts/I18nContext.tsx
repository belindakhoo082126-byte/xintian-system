import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "zh" | "en";

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
  "status.pending": { zh: "挂单", en: "Pending" },
  "status.receipt_uploaded": { zh: "确认汇款", en: "Payment Confirmed" },
  "status.partial_payment": { zh: "部分汇款", en: "Partial Payment" },
  "status.hold_order": { zh: "保留订单", en: "Hold Order" },
  "status.packing": { zh: "待包货", en: "Packing" },
  "status.shipped": { zh: "已发货", en: "Shipped" },
  "status.partial_shipped": { zh: "部分发货", en: "Partial Shipped" },
  "status.completed": { zh: "完成订单", en: "Completed" },
  "status.cancelled": { zh: "已取消", en: "Cancelled" },

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
};

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "zh",
  setLang: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("xintian-lang");
    return (saved === "en" || saved === "zh") ? saved : "zh";
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("xintian-lang", newLang);
  };

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry.zh || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
