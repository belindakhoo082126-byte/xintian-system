export type PackingSlipRemark = {
  category?: string | null;
  type?: string | null;
  remarkCategory?: string | null;
  content?: string | null;
  scheduledDate?: string | Date | null;
  desiredDeliveryDate?: string | Date | null;
  desiredDeliveryReason?: string | null;
};

export type PackingSlipRemarkRow = {
  label: string;
  content: string;
};

const REMARK_LABELS: Record<string, { zh: string; en: string }> = {
  shipping_date: { zh: "发货日期", en: "Shipping Date" },
  repotting: { zh: "换盆", en: "Repotting" },
  select_tree: { zh: "选树身", en: "Plant Selection" },
  desired_delivery_date: { zh: "发货日期", en: "Shipping Date" },
  other: { zh: "其他", en: "Other" },
  customer: { zh: "客户备注", en: "Customer Note" },
  internal: { zh: "内部备注", en: "Internal Note" },
};

function formatScheduledDate(value: PackingSlipRemark["scheduledDate"], locale: "zh" | "en") {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-MY" : "en-MY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 将订单备注转换为包货单唯一的显示口径。
 * 同一类别及相同内容只显示一次，避免两个打印入口出现数量或格式差异。
 */
export function getPackingSlipRemarkRows(
  remarks: PackingSlipRemark[] | null | undefined,
  locale: "zh" | "en" = "zh",
): PackingSlipRemarkRow[] {
  const seen = new Set<string>();
  return (remarks || []).flatMap((remark) => {
    const category = String(remark.remarkCategory || remark.category || remark.type || "other");
    const dateText = ["shipping_date", "desired_delivery_date"].includes(category)
      ? formatScheduledDate(remark.scheduledDate || remark.desiredDeliveryDate, locale)
      : "";
    const content = [String(remark.content || "").trim(), dateText, String(remark.desiredDeliveryReason || "").trim()]
      .filter(Boolean)
      .join(" · ");
    if (!content) return [];

    const dedupeKey = `${category}:${content}`;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);
    const label = REMARK_LABELS[category]?.[locale] || (locale === "zh" ? "其他" : "Other");
    return [{ label, content }];
  });
}

export function escapePackingSlipHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** 供工作台窗口打印使用；所有动态内容均进行转义。 */
export function renderPackingSlipRemarkHtml(rows: PackingSlipRemarkRow[]) {
  if (!rows.length) return "";
  return rows.map((row) => `
    <div style="font-size:11px;margin-left:8px;margin-bottom:3px;white-space:pre-wrap;"><strong>${escapePackingSlipHtml(row.label)}：</strong>${escapePackingSlipHtml(row.content).replace(/\n/g, "<br />")}</div>`).join("");
}
