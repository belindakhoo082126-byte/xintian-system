import { useI18n } from "@/contexts/I18nContext";

const SHIPPING_LABELS: Record<string, { zh: string; en: string }> = {
  west_malaysia: { zh: "西马", en: "West Malaysia" },
  east_malaysia_poslaju: { zh: "东马 Pos Laju", en: "East Malaysia Pos Laju" },
  east_malaysia_shopee: { zh: "东马 Shopee", en: "East Malaysia Shopee" },
  lalamove: { zh: "Lalamove", en: "Lalamove" },
  self_pickup: { zh: "自取", en: "Self Pickup" },
};

/**
 * OrderDocument — A clean, single-page order document layout for export image and print.
 * Does NOT use Card components or system UI chrome. Pure document-style layout.
 */
export function OrderDocument({ order, remarks }: { order: any; remarks?: any[] }) {
  const { translate, lang } = useI18n();
  const o = order;
  const shippingCfg = SHIPPING_LABELS[o.shippingMethod] || { zh: o.shippingMethod, en: o.shippingMethod };

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

  return (
    <div
      id="order-document"
      style={{
        width: "800px",
        padding: "40px",
        background: "#ffffff",
        fontFamily: "'Noto Sans SC', 'Segoe UI', sans-serif",
        color: "#1a1a1a",
        fontSize: "14px",
        lineHeight: "1.6",
      }}
    >
      {/* Header: Logo + Brand + Order Number */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #1E3F20", paddingBottom: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src="/manus-storage/xintian-logo-transparent_58bbaf5e.png" alt="Logo" style={{ width: "56px", height: "56px" }} crossOrigin="anonymous" />
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#1E3F20" }}>心田 Xin Tian</div>
            <div style={{ fontSize: "11px", color: "#888" }}>融合植物 · 草本DIY · 情绪疗愈与手作共创</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#333" }}>#{o.orderNumber}</div>
          <div style={{ fontSize: "12px", color: "#888" }}>{fmtDate(o.createdAt)}</div>
        </div>
      </div>

      {/* Customer Info */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3F20", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>
          {translate("客户资料", "Customer Info")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 24px" }}>
          <div><span style={{ color: "#888" }}>{translate("客户姓名", "Name")}:</span> <strong>{o.customerName || o.facebookName || "-"}</strong></div>
          <div><span style={{ color: "#888" }}>{translate("电话号码", "Phone")}:</span> {o.customerPhone || "-"}</div>
          <div><span style={{ color: "#888" }}>{translate("客户Credit", "Credit")}:</span> RM {parseFloat(o.creditBalance || "0").toFixed(2)}</div>
        </div>
      </div>

      {/* Recipient Info */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3F20", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>
          {translate("收件人资料", "Recipient Info")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 24px" }}>
          <div><span style={{ color: "#888" }}>{translate("收件人姓名", "Recipient")}:</span> <strong>{o.recipientName || "-"}</strong></div>
          <div><span style={{ color: "#888" }}>{translate("收件人电话", "Phone")}:</span> {o.recipientPhone || "-"}</div>
          <div><span style={{ color: "#888" }}>{translate("配送方式", "Shipping")}:</span> {translate(shippingCfg.zh, shippingCfg.en)}</div>
        </div>
        <div style={{ marginTop: "4px" }}>
          <span style={{ color: "#888" }}>{translate("收件地址", "Address")}:</span> {o.shippingAddress || "-"}
        </div>
      </div>

      {/* Order Items */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3F20", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>
          {translate("商品明细", "Order Items")}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666" }}>{translate("商品名称", "Product")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666" }}>{translate("规格", "Variation")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666", textAlign: "right" }}>{translate("数量", "Qty")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666", textAlign: "right" }}>{translate("单价", "Price")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666", textAlign: "right" }}>{translate("小计", "Subtotal")}</th>
            </tr>
          </thead>
          <tbody>
            {(o.items || []).map((item: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 8px" }}>{item.productName}</td>
                <td style={{ padding: "6px 8px", color: "#888" }}>{item.variationName || "-"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>RM {parseFloat(item.unitPrice).toFixed(2)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>RM {parseFloat(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
            {(!o.items || o.items.length === 0) && (
              <tr><td colSpan={5} style={{ padding: "12px", textAlign: "center", color: "#999" }}>{translate("无商品", "No items")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Amount Details */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3F20", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>
          {translate("金额详情", "Amount Details")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "350px", marginLeft: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("商品小计", "Subtotal")}</span>
            <span>RM {itemsSubtotal.toFixed(2)}</span>
          </div>
          {promotionDiscount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9333ea" }}>
              <span>{translate("促销优惠", "Promotion")}</span>
              <span>-RM {promotionDiscount.toFixed(2)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
              <span>{translate("折扣", "Discount")}{o.discountReason ? ` (${o.discountReason})` : ""}</span>
              <span>-RM {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {extraCharge > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("额外收费", "Extra Charge")}{o.extraChargeDescription ? ` (${o.extraChargeDescription})` : ""}</span>
              <span>+RM {extraCharge.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("运费", "Shipping")}</span>
            <span>RM {shippingFee.toFixed(2)}</span>
          </div>
          {creditUsed > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#2563eb" }}>
              <span>{translate("使用Credit", "Credit Used")}</span>
              <span>-RM {creditUsed.toFixed(2)}</span>
            </div>
          )}
          <div style={{ borderTop: "2px solid #1E3F20", marginTop: "4px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "15px" }}>
            <span>{translate("总金额", "Total")}</span>
            <span>RM {totalAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("已付", "Paid")}</span>
            <span>RM {paidAmount.toFixed(2)}</span>
          </div>
          {balance > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ea580c", fontWeight: 600 }}>
              <span>{translate("尚欠款", "Outstanding")}</span>
              <span>RM {balance.toFixed(2)}</span>
            </div>
          ) : balance < 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: 600 }}>
              <span>{translate("客户多付", "Overpaid")}</span>
              <span>RM {Math.abs(balance).toFixed(2)}</span>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: 600 }}>
              <span>{translate("已付清", "Fully Paid")}</span>
              <span>RM 0.00</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Records */}
      {(o.payments && o.payments.length > 0) && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3F20", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>
            {translate("付款记录", "Payment Records")}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666" }}>{translate("日期", "Date")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666", textAlign: "right" }}>{translate("金额", "Amount")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666" }}>{translate("付款方式", "Method")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, color: "#666" }}>{translate("备注", "Notes")}</th>
              </tr>
            </thead>
            <tbody>
              {o.payments.map((p: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "6px 8px" }}>{fmtDate(p.paymentDate || p.createdAt)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>RM {parseFloat(p.amount).toFixed(2)}</td>
                  <td style={{ padding: "6px 8px" }}>{p.paymentMethodName || p.paymentMethod || "-"}</td>
                  <td style={{ padding: "6px 8px", color: "#888" }}>{p.notes || p.purpose || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Remarks */}
      {(remarks && remarks.length > 0) && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3F20", borderBottom: "1px solid #e0e0e0", paddingBottom: "4px", marginBottom: "8px" }}>
            {translate("备注", "Remarks")}
          </div>
          {remarks.map((r: any, idx: number) => (
            <div key={idx} style={{ padding: "6px 0", borderBottom: idx < remarks.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              {r.remarkCategory === "repotting" && r.repottingData ? (
                <div>
                  <p style={{ margin: "0 0 4px 0" }}>{r.content}</p>
                  {(() => {
                    try {
                      const entries = JSON.parse(r.repottingData);
                      return entries.map((e: any, i: number) => (
                        <div key={i} style={{ fontSize: "12px", color: "#666", paddingLeft: "12px" }}>
                          🌱 {e.plantName} → {e.potName} ×{e.quantity}
                        </div>
                      ));
                    } catch { return null; }
                  })()}
                </div>
              ) : r.remarkCategory === "desired_delivery_date" ? (
                <div style={{ fontSize: "13px" }}>
                  {translate("希望收货日期", "Desired Delivery Date")}: {r.desiredDeliveryDate ? new Date(r.desiredDeliveryDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : "-"}
                  {r.desiredDeliveryReason && <span> — {r.desiredDeliveryReason}</span>}
                </div>
              ) : (
                <p style={{ margin: 0 }}>{r.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e0e0e0", textAlign: "center" }}>
        <div style={{ fontSize: "11px", color: "#aaa" }}>
          心田 Xin Tian · {translate("融合植物、草本DIY、情绪疗愈与手作共创的平台", "A platform for plants, herbal DIY, emotional healing & handmade creations")}
        </div>
        <div style={{ fontSize: "10px", color: "#ccc", marginTop: "4px" }}>
          {translate("此单据由系统自动生成", "This document is system-generated")}
        </div>
      </div>
    </div>
  );
}
