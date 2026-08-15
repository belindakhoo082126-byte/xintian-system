import { useI18n } from "@/contexts/I18nContext";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/** This component is mounted by DashboardLayout only. Keep public routes explicitly excluded for testability. */
const PUBLIC_PATHS = ["/mall", "/privacy-policy", "/terms-of-service", "/data-deletion"];

/** Static interface terms only. Customer messages, names, order content and AI content are never translated here. */
export const BACKEND_ENGLISH_TEXT: Record<string, string> = {
  "营销中心": "Marketing Center", "营销活动与自动化管理中心": "Campaign and automation hub", "新增活动": "New Campaign",
  "活动概览": "Campaign Overview", "进行中": "Active", "已结束": "Completed", "草稿": "Draft",
  "活动规则": "Campaign Rules", "幸运抽奖": "Lucky Draw", "自动营销": "Marketing Automation", "效果分析": "Performance Analysis",
  "创建活动": "Create Campaign", "编辑活动": "Edit Campaign", "活动名称": "Campaign Name", "活动类型": "Campaign Type",
  "开始日期": "Start Date", "结束日期": "End Date", "保存": "Save", "取消": "Cancel", "删除": "Delete", "编辑": "Edit",
  "全部": "All", "加载中...": "Loading...", "暂无数据": "No data available", "暂无记录": "No records yet",
  "中国采购": "China Purchase", "进货批次": "Import Batch", "采购单": "Purchase Order", "新建采购单": "New Purchase Order",
  "编辑采购单": "Edit Purchase Order", "关联订单": "Linked Orders", "关联订单数": "Linked Orders", "采购商品": "Purchase Items",
  "供应商": "Supplier", "采购数量": "Purchase Quantity", "采购单价": "Purchase Unit Price", "中国境内运费": "China Domestic Shipping",
  "国际运费": "International Shipping", "其他费用": "Other Costs", "供应商订单号": "Supplier Order No.", "中国快递单号": "China Tracking No.",
  "等待到货": "Awaiting Arrival", "部分到货": "Partially Received", "已完成入库": "Stocked In", "已锁定": "Locked", "已解锁": "Unlocked",
  "完成验货": "Complete Inspection", "新增分批到货": "Add Partial Arrival", "打印预览": "Print Preview", "解锁原因": "Unlock Reason",
  "草稿订单": "Draft Orders", "订单变更请求": "Order Change Requests", "AI 生成": "AI Generated", "待审核": "Pending Review",
  "已批准": "Approved", "已拒绝": "Rejected", "已失效": "Expired", "查看详情": "View Details", "查看正式订单": "View Order",
  "批准": "Approve", "拒绝": "Reject", "标记失效": "Mark Expired", "拒绝原因": "Rejection Reason", "变更类型": "Change Type",
  "组合包管理": "Product Bundles", "新增组合包": "New Product Bundle", "编辑组合包": "Edit Product Bundle", "组合包名称": "Bundle Name",
  "组合商品": "Bundle Items", "组合价格": "Bundle Price", "库存日志": "Inventory Log", "库存调整": "Inventory Adjustment",
  "商品": "Product", "数量": "Quantity", "操作人": "Operator", "操作时间": "Operation Time", "备注": "Notes",
  "商品 #": "Product #", "AI 客服": "AI Customer Service", "Chat 客服": "Chat Support", "AI 转人工通知": "AI Handover Alerts",
  "AI 大脑": "AI Brain", "自动通知": "Automated Notifications", "Flow 管理": "Flow Management", "直播AI": "Live AI",
  "会话": "Conversations", "客户资料": "Customer Details", "最近订单": "Recent Orders", "暂无订单": "No recent orders", "快捷操作": "Quick Actions",
  "发送消息": "Send Message", "输入消息...": "Type a message...", "未结账订单": "Unpaid Orders", "已发货订单": "Shipped Orders",
  "人工接手": "Human Handover", "等待人工处理": "Awaiting Human Support", "最久等待": "Longest Wait", "接手": "Take Over",
  "打开对话": "Open Chat", "转人工原因": "Handover Reason", "AI摘要": "AI Summary", "未知客户": "Unknown Customer",
  "AI 知识库": "AI Knowledge Base", "新增知识": "Add Knowledge", "编辑知识": "Edit Knowledge", "知识内容": "Knowledge Content",
  "触发关键词": "Trigger Keywords", "优先级": "Priority", "使用次数": "Usage Count", "审核发布": "Review & Publish",
  "AI 回复规则": "AI Reply Rules", "新增规则": "Add Rule", "回复规则": "Reply Rules", "规则名称": "Rule Name", "匹配条件": "Match Conditions",
  "自动通知中心": "Automated Notifications", "通知记录": "Notification History", "通知预览": "Notification Preview", "待发送": "Pending Send", "已发送": "Sent", "发送失败": "Failed",
  "新增 Flow": "New Flow", "编辑 Flow": "Edit Flow", "Flow 名称": "Flow Name", "Flow 编辑器": "Flow Editor", "Flow 模板": "Flow Templates", "启用": "Enabled", "停用": "Disabled",
  "人工审核并修订 AI 聊天回复": "Review and refine AI chat replies", "聊天训练草稿": "Chat Training Drafts", "保存训练草稿": "Save Training Draft",
  "训练草稿已审核发布": "Training draft published", "草稿未启用，需在 AI 知识库审核发布后才会影响自动回复。": "This draft is inactive and will affect auto-replies only after review and publishing in AI Knowledge Base.",
  "语音欢迎讯息（可选）": "Voice welcome message (optional)", "上传语音": "Upload voice", "移除语音": "Remove voice", "语音已上传": "Voice uploaded",
  "物流整合": "Logistics Integration", "物流供应商": "Logistics Provider", "测试连接": "Test Connection", "刷新余额": "Refresh Balance",
  "环境": "Environment", "账户余额": "Account Balance", "最后同步": "Last Synced", "已配置（服务器端存储）": "Configured (stored server-side)",
  "支持的快递": "Supported Couriers", "启用手动发货": "Enable Manual Shipping", "可用服务列表": "Available Services",
  "付款设置": "Payment Settings", "新增付款方式": "New Payment Method", "付款方式": "Payment Method", "银行名称": "Bank Name",
  "户口号码": "Account Number", "户口持有人": "Account Holder", "系统设置": "System Settings", "公司资料": "Company Profile",
  "编号规则": "Numbering Rules", "保存设置": "Save Settings", "客户时间线": "Customer Timeline", "订单": "Order", "Credit 流水": "Credit Ledger",
  "创建时间": "Created At", "更新时间": "Updated At", "状态": "Status", "金额": "Amount", "客户": "Customer", "平台": "Platform",
  "确认": "Confirm", "返回": "Back", "关闭": "Close", "重试": "Retry", "搜索": "Search", "筛选": "Filter",
  "是": "Yes", "否": "No", "成功": "Success", "失败": "Failed", "错误": "Error", "说明": "Description",
};

export function translateBackendStaticText(value: string) {
  const trimmed = value.trim();
  const translated = BACKEND_ENGLISH_TEXT[trimmed];
  return translated ? value.replace(trimmed, translated) : value;
}

export function isBackendEnglishFallbackPath(pathname: string) {
  const normalizedPath = pathname.split(/[?#]/, 1)[0];
  return !PUBLIC_PATHS.some(path => normalizedPath === path || normalizedPath.startsWith(`${path}/`));
}

export function BackendEnglishFallback({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const [location] = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const originalsRef = useRef(new WeakMap<Text, string>());
  const attributeOriginalsRef = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isBackendEnglishFallbackPath(location)) return;

    const syncText = (text: Text) => {
      const original = originalsRef.current.get(text) ?? text.nodeValue ?? "";
      if (lang === "en") {
        const translated = translateBackendStaticText(original);
        if (translated !== original) {
          originalsRef.current.set(text, original);
          if (text.nodeValue !== translated) text.nodeValue = translated;
        }
      } else if (originalsRef.current.has(text) && text.nodeValue !== original) {
        text.nodeValue = original;
      }
    };

    const syncSubtree = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        syncText(node as Text);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        ["placeholder", "aria-label", "title", "value"].forEach(attribute => {
          const current = element.getAttribute(attribute);
          if (!current) return;
          const originals = attributeOriginalsRef.current.get(element) ?? new Map<string, string>();
          const original = originals.get(attribute) ?? current;
          const translated = lang === "en" ? translateBackendStaticText(original) : original;
          if (translated !== original || originals.has(attribute)) {
            originals.set(attribute, original);
            attributeOriginalsRef.current.set(element, originals);
            if (current !== translated) element.setAttribute(attribute, translated);
          }
        });
      }
      node.childNodes.forEach(syncSubtree);
    };

    syncSubtree(root);
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === "characterData") syncText(record.target as Text);
        record.addedNodes.forEach(syncSubtree);
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [lang, location]);

  return <div ref={rootRef} className="contents">{children}</div>;
}
