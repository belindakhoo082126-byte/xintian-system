import { useI18n } from "@/contexts/I18nContext";
import { AUDITED_BACKEND_ENGLISH_TEXT } from "@/components/AuditedBackendEnglishText";
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
  "草稿订单": "Draft Orders", "草稿订单（AI 生成）": "Draft Orders (AI-generated)", "订单变更请求": "Order Change Requests", "订单变更请求（AI 生成）": "Order Change Requests (AI-generated)", "AI 生成": "AI Generated", "待审核": "Pending Review",
  "已批准": "Approved", "已拒绝": "Rejected", "已失效": "Expired", "查看详情": "View Details", "查看正式订单": "View Order",
  "批准": "Approve", "拒绝": "Reject", "标记失效": "Mark Expired", "拒绝原因": "Rejection Reason", "变更类型": "Change Type",
  "采购批次管理": "Import Batch Management", "组合包管理": "Product Bundles", "新增组合包": "New Product Bundle", "编辑组合包": "Edit Product Bundle", "组合包名称": "Bundle Name",
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
  "付款设置": "Payment Settings", "付款设定": "Payment Settings", "新增付款方式": "New Payment Method", "付款方式": "Payment Method", "银行名称": "Bank Name",
  "户口号码": "Account Number", "户口持有人": "Account Holder", "系统设置": "System Settings", "公司资料": "Company Profile",
  "编号规则": "Numbering Rules", "保存设置": "Save Settings", "客户时间线": "Customer Timeline", "订单": "Order", "Credit 流水": "Credit Ledger",
  "付款凭据审核": "Payment Proof Review", "商品管理": "Product Management", "利润报表": "Profit Report", "运费规则": "Shipping Rules",
  "创建时间": "Created At", "更新时间": "Updated At", "排序": "Sort Order", "名称": "Name", "类型": "Type", "QR / 银行资料": "QR / Bank Details", "状态": "Status", "金额": "Amount", "客户": "Customer", "平台": "Platform",
  "确认": "Confirm", "返回": "Back", "关闭": "Close", "重试": "Retry", "搜索": "Search", "筛选": "Filter",
  "是": "Yes", "否": "No", "成功": "Success", "失败": "Failed", "错误": "Error", "说明": "Description",
  "统一管理活动、优惠、抽奖、客户召回与营销消息。所有实体赠品、加价购和奖品会在加入原订单时才通过既有库存服务占用库存。": "Manage campaigns, offers, prize draws, customer re-engagement, and marketing messages in one place. Physical gifts, add-on purchases, and prizes reserve stock only when added to the original order.",
  "启用规则": "Enabled Rules", "成功投递": "Successful Deliveries", "客户分群": "Customer Segments", "营销活动": "Campaigns",
  "活动与优惠规则": "Campaigns & Offer Rules", "先建立活动，再加入可叠加或互斥的优惠规则。": "Create a campaign first, then add stackable or mutually exclusive offer rules.",
  "正在读取营销活动…": "Loading marketing campaigns…", "尚未建立活动。可先从右上角新增营销活动开始。": "No campaigns yet. Start by creating a campaign from the top-right.",
  "未填写活动说明": "No campaign description", "商城展示": "Shown in Mall", "后台活动": "Back-office Campaign", "开始：": "Starts:", "结束：": "Ends:", "每客限制：": "Per-customer limit:", "总使用上限：": "Total usage limit:", "不限": "Unlimited", "尚未加入优惠规则": "No offer rules added",
  "幸运轮盘与直播抽奖": "Lucky Wheel & Live Draw", "实体奖品仅于领取并合并到原订单时占用库存；抽奖本身不会先扣库存。": "Physical prizes reserve stock only when claimed and merged into the original order; the draw itself does not reserve stock.",
  "选择活动": "Select campaign", "请先建立营销活动，才可配置抽奖奖品与资格。": "Create a marketing campaign first to configure prizes and eligibility.",
  "可用奖品": "Available Prizes", "概率与数量上限由后台配置，开奖后保留完整审计。": "Probability and quantity limits are configured in the back office; the draw keeps a complete audit trail.",
  "权重": "Weight", "剩余": "Remaining", "件": "items", "尚未配置奖品。": "No prizes configured.",
  "抽奖资格": "Draw Eligibility", "符合活动门槛后建立资格；管理员针对某一资格执行开奖。": "Eligibility is created after campaign criteria are met; an administrator runs the draw for a selected entry.",
  "资格 #": "Entry #", "客户 #": "Customer #", "开奖": "Draw", "该活动目前没有符合条件的抽奖资格。": "There are currently no eligible draw entries for this campaign.",
  "请输入要模拟的留言内容": "Enter a comment to simulate", "以客户类别、回购条件和互动状态建立可复用受众。": "Create reusable audiences using customer type, purchase conditions, and engagement status.",
  "新增分群": "New Segment", "营销消息": "Marketing Messages", "建立 Messenger 或人工复制用的合规文案模板。": "Create compliant templates for Messenger or manual copy.", "新增模板": "New Template",
  "新规则预设为暂停；发送前可预演名单与合规窗口。": "New rules are paused by default; preview recipients and compliance windows before sending.",
  "自动营销控制台": "Automation Console", "新规则先暂停。请先运行启用前检查，再开启自动排程；近期没有 Messenger 合规互动窗口的客户不会自动私聊，会生成可审计的人工发送文案。": "New rules start paused. Run the preflight check before enabling a schedule; customers without a recent Messenger compliance window will not be messaged automatically and will receive an auditable manual-send copy.",
  "自动排程": "Automated schedule", "单次排程": "One-time schedule", "事件触发": "Event trigger", "已绑定后台任务": "Background task linked", "上次执行：": "Last run:", "设定时间：": "Scheduled for:",
  "启用前检查": "Preflight check", "预演名单": "Preview recipients", "立即执行": "Run now", "暂停": "Pause", "尚未建立自动营销规则。": "No automation rules yet.",
  "最近执行记录": "Recent Execution Records", "按每一笔实际投递审计显示自动发送、失败和人工回退结果；一次执行涉及多位客户时会保留多笔客户级记录，方便追查。": "Shows automated sends, failures, and manual fallbacks by actual delivery audit. Runs involving multiple customers retain one record per customer for traceability.",
  "规则 #": "Rule #", "人工发送文案": "Manual-send copy", "Messenger 自动发送": "Messenger automated send", "尚未产生营销投递记录。启用规则后，系统会在这里保留每位客户的实际投递结果。": "No marketing delivery records yet. Once a rule is enabled, this area retains each customer's actual delivery outcome.",
  "营销效果分析": "Marketing Performance Analysis", "所有金额、订单与投递数据均读取实际活动归因和投递审计记录；未使用任何模拟指标。": "All amounts, orders, and delivery data come from actual campaign attribution and delivery audit records; no simulated metrics are used.",
  "归因订单": "Attributed Orders", "状态为已应用的活动归因记录": "Campaign attribution records with applied status", "归因营收": "Attributed Revenue", "来自活动关联订单的实际金额": "Actual amount from campaign-linked orders", "营销优惠": "Marketing Discounts", "不包含客户 Credit": "Excludes customer Credit", "次点击": "clicks", "次转化": "conversions",
  "活动效果明细": "Campaign Performance Details", "按营销活动汇总实际归因订单、营收、优惠、运费补贴和投递互动。": "Summarises actual attributed orders, revenue, discounts, shipping subsidies, and delivery engagement by campaign.",
  "订单：": "Orders:", "营收：": "Revenue:", "优惠：": "Discounts:", "投递：": "Deliveries:", "点击": "clicks", "转化": "conversions", "尚未产生可归因的营销订单或投递记录。": "No attributable marketing orders or delivery records yet.",
  "归因边界": "Attribution Boundaries", "实体赠品、加价购与中奖商品只在写入原订单项目时占用库存；开奖或营销提示不会预扣商品。": "Physical gifts, add-on purchases, and prize items reserve stock only when written to the original order; draws and marketing prompts do not reserve products in advance.", "系统将营销优惠、运费补贴与客户 Credit 分开记录。Credit 不是活动折扣，利润与报表计算不会重复扣除。": "Marketing discounts, shipping subsidies, and customer Credit are recorded separately. Credit is not a campaign discount and is not deducted twice in profit or report calculations.",
  "操作说明": "Operating Guide", "营销中心管理员操作说明": "Marketing Center Administrator Guide", "此入口汇总当前营销中心的实际操作边界；不会替代 Campaign Flow 的独立流程配置说明。": "This guide summarises the current operating boundaries of Marketing Center; it does not replace the separate Campaign Flow configuration guide.",
  "关键词模拟测试": "Keyword Simulation", "使用真实的关键词解析与商品匹配规则预览触发效果；本工具只读，不会发送消息、建立订单或预留库存。": "Preview trigger results using the real keyword parsing and product-matching rules. This read-only tool does not send messages, create orders, or reserve stock.",
  "模拟中…": "Simulating…", "开始模拟": "Start Simulation", "已匹配关键词": "Keywords Matched", "没有匹配商品": "No Products Matched", "解析词：": "Parsed terms:", "未识别": "Not recognised", "匹配关键词": "Matched keyword", "请检查商品关键词、留言格式或直播商品配置。": "Check product keywords, comment format, or live product configuration.", "未匹配：": "Unmatched:",
  "预计触发边界": "Expected Trigger Boundaries", "公开回复：": "Public reply:", "私聊：": "Private message:",
};

export function translateBackendStaticText(value: string) {
  const trimmed = value.trim();
  const translated = BACKEND_ENGLISH_TEXT[trimmed] ?? AUDITED_BACKEND_ENGLISH_TEXT[trimmed];
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
