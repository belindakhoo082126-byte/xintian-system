import { useI18n } from "@/contexts/I18nContext";

const SHIPPING_LABELS: Record<string, { zh: string; en: string }> = {
  west_malaysia: { zh: "西马", en: "West Malaysia" },
  east_malaysia_poslaju: { zh: "东马 Pos Laju", en: "East Malaysia Pos Laju" },
  east_malaysia_shopee: { zh: "东马 Shopee", en: "East Malaysia Shopee" },
  lalamove: { zh: "Lalamove", en: "Lalamove" },
  self_pickup: { zh: "自取", en: "Self Pickup" },
};

const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  pending: { zh: "未汇款订单", en: "Unpaid Order" },
  receipt_uploaded: { zh: "待审核付款凭证", en: "Pending Payment Verification" },
  hold_order: { zh: "保留订单", en: "Hold Order" },
  packing: { zh: "待包货", en: "Pending Packing" },
  partial_shipped: { zh: "部分发货", en: "Partial Shipped" },
  shipped: { zh: "已发货", en: "Shipped" },
  completed: { zh: "已完成", en: "Completed" },
  cancelled: { zh: "已取消", en: "Cancelled" },
  scheduled: { zh: "预约发货", en: "Scheduled Shipping" },
  special: { zh: "特别订单", en: "Special Order" },
};

// All colors in hex/rgb — NO oklch, NO CSS variables, NO Tailwind classes
// This ensures html2canvas can parse every color without errors
const C = {
  green: "#1E3F20",
  greenLight: "#E8F0E8",
  text: "#1a1a1a",
  textLight: "#666666",
  textMuted: "#999999",
  border: "#e0e0e0",
  borderLight: "#f0f0f0",
  bgWhite: "#ffffff",
  bgGray: "#f8f8f8",
  red: "#dc2626",
  orange: "#ea580c",
  blue: "#2563eb",
  purple: "#9333ea",
  greenPaid: "#16a34a",
};

/**
 * OrderDocument — A clean, single-page order document template.
 * ALL styles are inline. ALL colors are hex/rgb. NO CSS variables, NO Tailwind, NO oklch.
 * 
 * Two variants:
 * - "customer" — clean, client-facing document (no admin-only fields)
 * - "admin" — includes Facebook ID, Messenger ID, internal notes, operation logs
 * 
 * Used for both:
 * - Export as PNG (html2canvas)
 * - Print (new window)
 */
export function OrderDocument({
  order,
  remarks,
  variant = "customer",
  logoDataUrl,
  responsive = false,
  showProductImage = true,
}: {
  order: any;
  remarks?: any[];
  variant?: "customer" | "admin";
  logoDataUrl?: string;
  /** 仅供屏幕预览使用；导出 PNG 与打印仍维持固定 800px 版面。 */
  responsive?: boolean;
  /** 是否显示商品照片（Preview 和导出图片时为 true，打印时为 false） */
  showProductImage?: boolean;
}) {
  const { translate, lang } = useI18n();
  const o = order;
  const isAdmin = variant === "admin";
  // Filter remarks for customer copy — hide internal remarks
  const visibleRemarks = isAdmin ? (remarks || []) : (remarks || []).filter((r: any) => r.type !== "internal" && r.type !== "live");
  const shippingCfg = SHIPPING_LABELS[o.shippingMethod] || { zh: o.shippingMethod, en: o.shippingMethod };
  const statusCfg = STATUS_LABELS[o.physicalStatus] || { zh: o.physicalStatus, en: o.physicalStatus };

  const physicalSubtotal = parseFloat(o.physicalSubtotal || "0");
  const membershipSubtotal = parseFloat(o.membershipSubtotal || "0");
  const itemsSubtotal = physicalSubtotal + membershipSubtotal;
  const promotionDiscount = parseFloat(o.promotionDiscount || "0");
  const extraCharge = parseFloat(o.extraCharge || "0");
  const creditUsed = parseFloat(o.creditUsed || "0");
  const shippingFee = parseFloat(o.shippingFee || "0");
  const totalAmount = parseFloat(o.totalAmount || "0");
  const paidAmount = parseFloat(o.paidAmount || "0");
  const balance = totalAmount - paidAmount;
  const discountAmount = parseFloat(o.discountAmount || "0");

  const fmtDate = (d: string | Date) => {
    if (!d) return "-";
    return new Date(d).toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
  };

  const fmtDateOnly = (d: string | Date) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US");
  };

  // Section title style
  const sectionTitle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    color: C.green,
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: "4px",
    marginBottom: "8px",
  };

  // Label style
  const labelStyle: React.CSSProperties = {
    color: C.textLight,
  };

  // Grid row
  const gridRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "6px 24px",
  };

  // Table cell styles
  const thStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontWeight: 600,
    color: C.textLight,
    textAlign: "left" as const,
    borderBottom: `2px solid ${C.border}`,
  };
  const thRight: React.CSSProperties = { ...thStyle, textAlign: "right" as const };
  const tdStyle: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: `1px solid ${C.borderLight}`,
  };
  const tdRight: React.CSSProperties = { ...tdStyle, textAlign: "right" as const };

  // Amount row
  const amtRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
  };

  return (
    <div
      style={{
        width: responsive ? "100%" : "800px",
        maxWidth: responsive ? "800px" : undefined,
        margin: responsive ? "0 auto" : undefined,
        padding: responsive ? "clamp(16px, 4vw, 40px)" : "40px",
        background: C.bgWhite,
        fontFamily: "'Noto Sans SC', 'Segoe UI', Arial, sans-serif",
        color: C.text,
        fontSize: "14px",
        lineHeight: "1.6",
        boxSizing: "border-box",
      }}
    >
      {/* ===== Header ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `3px solid ${C.green}`,
          paddingBottom: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={logoDataUrl || "/manus-storage/FB_IMG_1779824864256(2)_dbe588b7.png"}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
            alt="心田 Logo"
          />
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: C.green }}>心田 Xin Tian</div>
            <div style={{ fontSize: "11px", color: C.textMuted }}>融合植物 · 草本DIY · 情绪疗愈与手作共创</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#333333" }}>#{o.orderNumber}</div>
          <div style={{ fontSize: "12px", color: C.textMuted }}>{fmtDate(o.createdAt)}</div>
          <div style={{ fontSize: "12px", color: C.green, fontWeight: 600, marginTop: "2px" }}>
            {translate(statusCfg.zh, statusCfg.en)}
          </div>
        </div>
      </div>

      {/* ===== Customer Info ===== */}
      <div style={{ marginBottom: "20px" }}>
        <div style={sectionTitle}>{translate("客户资料", "Customer Info")}</div>
        <div style={gridRow}>
          <div><span style={labelStyle}>{translate("客户姓名", "Name")}:</span> <strong>{o.customerName || o.facebookName || "-"}</strong></div>
          <div><span style={labelStyle}>{translate("联系电话", "Phone")}:</span> {o.customerPhone || "-"}</div>
          <div><span style={labelStyle}>{translate("客户Credit", "Credit")}:</span> RM {parseFloat(o.creditBalance || "0").toFixed(2)}</div>
        </div>
        {isAdmin && (
          <div style={{ ...gridRow, marginTop: "4px" }}>
            <div><span style={labelStyle}>{translate("Facebook", "Facebook")}:</span> {o.facebookName || "-"}</div>
            <div><span style={labelStyle}>{translate("Facebook ID", "FB ID")}:</span> {o.facebookId || "-"}</div>
            <div><span style={labelStyle}>{translate("Messenger ID", "Messenger")}:</span> {o.messengerId || "-"}</div>
          </div>
        )}
      </div>

      {/* ===== Recipient Info ===== */}
      <div style={{ marginBottom: "20px" }}>
        <div style={sectionTitle}>{translate("收件资料", "Recipient Info")}</div>
        <div style={gridRow}>
          <div><span style={labelStyle}>{translate("收件人", "Recipient")}:</span> <strong>{o.recipientName || "-"}</strong></div>
          <div><span style={labelStyle}>{translate("联系电话", "Phone")}:</span> {o.recipientPhone || "-"}</div>
          <div><span style={labelStyle}>{translate("配送方式", "Shipping")}:</span> {translate(shippingCfg.zh, shippingCfg.en)}</div>
        </div>
        <div style={{ marginTop: "4px" }}>
          <span style={labelStyle}>{translate("完整地址", "Full Address")}:</span> {o.shippingAddress || "-"}
        </div>
        {(o.courierCompany || o.trackingNumber) && (
          <div style={{ ...gridRow, marginTop: "4px" }}>
            <div><span style={labelStyle}>{translate("快递公司", "Courier")}:</span> {o.courierCompany || "-"}</div>
            <div><span style={labelStyle}>{translate("追踪号码", "Tracking")}:</span> {o.trackingNumber || "-"}</div>
          </div>
        )}
      </div>

      {/* ===== Order Items ===== */}
      <div style={{ marginBottom: "20px" }}>
        <div style={sectionTitle}>{translate("商品明细", "Order Items")}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr>
              {showProductImage && (
                <th style={{ ...thStyle, width: "60px" }}>{translate("照片", "Photo")}</th>
              )}
              <th style={thStyle}>{translate("商品", "Product")}</th>
              <th style={thStyle}>{translate("规格", "Variation")}</th>
              <th style={thRight}>{translate("数量", "Qty")}</th>
              <th style={thRight}>{translate("单价", "Price")}</th>
              <th style={thRight}>{translate("小计", "Subtotal")}</th>
            </tr>
          </thead>
          <tbody>
            {(o.items || []).map((item: any, idx: number) => (
              <tr key={idx}>
                {showProductImage && (
                  <td style={{ ...tdStyle, width: "60px" }}>
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        style={{
                          width: "50px",
                          height: "50px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          display: "block",
                        }}
                      />
                    ) : (
                      <span style={{ color: C.textMuted, fontSize: "11px" }}>-</span>
                    )}
                  </td>
                )}
                <td style={tdStyle}>{item.productName}</td>
                <td style={{ ...tdStyle, color: C.textLight }}>{item.variationName || "-"}</td>
                <td style={tdRight}>{item.quantity}</td>
                <td style={tdRight}>RM {parseFloat(item.unitPrice).toFixed(2)}</td>
                <td style={{ ...tdRight, fontWeight: 500 }}>RM {parseFloat(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
            {(!o.items || o.items.length === 0) && (
              <tr>
                <td colSpan={showProductImage ? 6 : 5} style={{ ...tdStyle, textAlign: "center", color: C.textMuted }}>{translate("无商品", "No items")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Amount Details ===== */}
      <div style={{ marginBottom: "20px" }}>
        <div style={sectionTitle}>{translate("金额详情", "Amount Details")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "350px", marginLeft: "auto" }}>
          <div style={amtRow}>
            <span>{translate("商品小计", "Subtotal")}</span>
            <span>RM {itemsSubtotal.toFixed(2)}</span>
          </div>
          {promotionDiscount > 0 && (
            <div style={{ ...amtRow, color: C.purple }}>
              <span>{translate("促销优惠", "Promotion")}</span>
              <span>-RM {promotionDiscount.toFixed(2)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div style={{ ...amtRow, color: C.red }}>
              <span>{translate("折扣", "Discount")}{o.discountReason ? ` (${o.discountReason})` : ""}</span>
              <span>-RM {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {extraCharge > 0 && (
            <div style={amtRow}>
              <span>{translate("额外收费", "Extra Charge")}{o.extraChargeDescription ? ` (${o.extraChargeDescription})` : ""}</span>
              <span>+RM {extraCharge.toFixed(2)}</span>
            </div>
          )}
          <div style={amtRow}>
            <span>{translate("运费", "Shipping")}</span>
            <span>RM {shippingFee.toFixed(2)}</span>
          </div>
          {creditUsed > 0 && (
            <div style={{ ...amtRow, color: C.blue }}>
              <span>{translate("自动扣除Credit", "Auto Credit Used")}</span>
              <span>-RM {creditUsed.toFixed(2)}</span>
            </div>
          )}
          <div style={{ borderTop: `2px solid ${C.green}`, marginTop: "4px", paddingTop: "6px", ...amtRow, fontWeight: 700, fontSize: "15px" }}>
            <span>{translate("总金额", "Total")}</span>
            <span>RM {totalAmount.toFixed(2)}</span>
          </div>
          <div style={amtRow}>
            <span>{translate("已付款", "Paid")}</span>
            <span>RM {paidAmount.toFixed(2)}</span>
          </div>
          {balance > 0 ? (
            <div style={{ ...amtRow, color: C.orange, fontWeight: 600 }}>
              <span>{translate("尚欠款", "Outstanding")}</span>
              <span>RM {balance.toFixed(2)}</span>
            </div>
          ) : balance < 0 ? (
            <div style={{ ...amtRow, color: C.greenPaid, fontWeight: 600 }}>
              <span>{translate("客户多付", "Overpaid")}</span>
              <span>RM {Math.abs(balance).toFixed(2)}</span>
            </div>
          ) : (
            <div style={{ ...amtRow, color: C.greenPaid, fontWeight: 600 }}>
              <span>{translate("已付清", "Fully Paid")}</span>
              <span>RM 0.00</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Payment Records ===== */}
      {o.payments && o.payments.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={sectionTitle}>{translate("付款记录", "Payment Records")}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={thStyle}>{translate("日期", "Date")}</th>
                <th style={thRight}>{translate("金额", "Amount")}</th>
                <th style={thStyle}>{translate("付款方式", "Method")}</th>
                <th style={thStyle}>{translate("付款截图", "Receipt")}</th>
                {isAdmin && <th style={thStyle}>{translate("备注", "Notes")}</th>}
              </tr>
            </thead>
            <tbody>
              {o.payments.map((p: any, idx: number) => (
                <tr key={idx}>
                  <td style={tdStyle}>{fmtDate(p.paymentDate || p.createdAt)}</td>
                  <td style={{ ...tdRight, fontWeight: 500 }}>RM {parseFloat(p.amount).toFixed(2)}</td>
                  <td style={tdStyle}>{p.paymentMethodName || p.paymentMethod || "-"}</td>
                  <td style={tdStyle}>
                    {p.receiptUrl ? (
                      <span style={{ color: C.blue }}>[{translate("已上传", "Uploaded")}]</span>
                    ) : (
                      <span style={{ color: C.textMuted }}>-</span>
                    )}
                  </td>
                  {isAdmin && <td style={{ ...tdStyle, color: C.textLight }}>{p.notes || p.purpose || "-"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Remarks ===== */}
      {visibleRemarks && visibleRemarks.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={sectionTitle}>{translate("备注", "Remarks")}</div>
          {visibleRemarks.map((r: any, idx: number) => (
            <div key={idx} style={{ padding: "6px 0", borderBottom: idx < visibleRemarks.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
              {r.remarkCategory === "repotting" && r.repottingData ? (
                <div>
                  <p style={{ margin: "0 0 4px 0" }}>{r.content}</p>
                  {(() => {
                    try {
                      const entries = JSON.parse(r.repottingData);
                      return entries.map((e: any, i: number) => (
                        <div key={i} style={{ fontSize: "12px", color: C.textLight, paddingLeft: "12px" }}>
                          {translate("植物", "Plant")}: {e.plantName} → {translate("花盆", "Pot")}: {e.potName} ×{e.quantity}
                        </div>
                      ));
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              ) : r.remarkCategory === "desired_delivery_date" ? (
                <div style={{ fontSize: "13px" }}>
                  {translate("希望收货日期", "Desired Delivery Date")}: {r.desiredDeliveryDate ? fmtDateOnly(r.desiredDeliveryDate) : "-"}
                  {r.desiredDeliveryReason && <span> — {r.desiredDeliveryReason}</span>}
                </div>
              ) : r.remarkCategory === "select_tree" ? (
                <div style={{ fontSize: "13px" }}>
                  <span style={{ fontWeight: 600 }}>{translate("选树身", "Select Tree")}</span>: {r.content || "-"}
                </div>
              ) : (
                <p style={{ margin: 0 }}>{r.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Footer ===== */}
      <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
        <div style={{ fontSize: "11px", color: "#aaaaaa" }}>
          心田 Xin Tian · {translate("融合植物、草本DIY、情绪疗愈与手作共创的平台", "A platform for plants, herbal DIY, emotional healing & handmade creations")}
        </div>
        <div style={{ fontSize: "10px", color: "#cccccc", marginTop: "4px" }}>
          {translate("此单据由系统自动生成", "This document is system-generated")}
        </div>
      </div>
    </div>
  );
}
