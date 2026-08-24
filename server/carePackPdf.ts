import { readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { CarePackPublicDocument } from "../shared/orderCarePackRules";

const CJK_FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Light.otf";
const CJK_FONT_BYTES = readFileSync(CJK_FONT_PATH);

function textOrDash(value: string | null | undefined) {
  return value?.trim() || "-";
}

async function getImage(url: string | null | undefined, assetOrigin?: string | null) {
  if (!url) return null;
  try {
    const sourceUrl = /^https?:\/\//i.test(url) ? url : assetOrigin ? new URL(url, assetOrigin).toString() : null;
    if (!sourceUrl) return null;
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function collectFields(product: CarePackPublicDocument["products"][number]) {
  if (product.content.profileType === "plant") {
    return [
      ["光线", textOrDash(product.content.plant?.light)],
      ["水分／浇水", textOrDash(product.content.plant?.water)],
      ["施肥", textOrDash(product.content.plant?.fertilizer)],
      ["修剪", textOrDash(product.content.plant?.pruning)],
      ["注意事项", textOrDash(product.content.plant?.notes)],
    ] as const;
  }
  return [
    ["用途", textOrDash(product.content.use?.purpose)],
    ["使用方法", textOrDash(product.content.use?.usageMethod)],
    ["剂量", textOrDash(product.content.use?.dosage)],
    ["频率", textOrDash(product.content.use?.frequency)],
    ["适用对象", textOrDash(product.content.use?.suitableFor)],
    ["安全注意事项", textOrDash(product.content.use?.safetyNotes)],
  ] as const;
}

function addPageHeader(pdf: PDFKit.PDFDocument, title: string, logo: Buffer | null) {
  const left = pdf.page.margins.left;
  const top = pdf.page.margins.top;
  if (logo) {
    try {
      pdf.image(logo, left, top, { fit: [36, 36] });
    } catch {
      // An unreadable logo must not block downloading the safe text document.
    }
  }
  pdf.fillColor("#0f5132").font("CarePackCJK").fontSize(9).text("XINTIAN · 心田", left + 48, top + 2);
  pdf.fillColor("#1c1917").font("CarePackCJK").fontSize(18).text(title, left + 48, top + 15);
  pdf.moveTo(left, top + 48).lineTo(pdf.page.width - pdf.page.margins.right, top + 48).strokeColor("#d6d3d1").stroke();
  pdf.y = top + 66;
}

/** Generates only the allow-listed customer care-pack fields; it has no order/customer/payment/address inputs. */
export async function generateCustomerCarePackPdf(document: CarePackPublicDocument, logoUrl?: string | null, assetOrigin?: string | null): Promise<Buffer> {
  const pdf = new PDFDocument({ size: "A4", margin: 36, bufferPages: true, info: { Title: document.title, Author: "心田 Xin Tian" } });
  pdf.registerFont("CarePackCJK", CJK_FONT_BYTES);
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  const logo = await getImage(logoUrl, assetOrigin);
  addPageHeader(pdf, document.title || "商品养护／使用知识包", logo);

  for (const product of document.products) {
    const fields = collectFields(product);
    const pageWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const photoWidth = 104;
    const contentX = pdf.page.margins.left + photoWidth + 18;
    const contentWidth = pageWidth - photoWidth - 36;
    const columnWidth = (contentWidth - 16) / 2;
    const rows = fields.map(([label, value]) => ({ label, value, height: Math.max(34, pdf.heightOfString(value, { width: columnWidth }) + 20) }));
    const fieldHeight = rows.reduce((total, row, index) => total + (index % 2 === 0 ? Math.max(row.height, rows[index + 1]?.height ?? 0) : 0), 0);
    const cardHeight = Math.max(132, 42 + fieldHeight + 14);
    const bottom = pdf.page.height - pdf.page.margins.bottom;
    if (pdf.y + cardHeight > bottom) {
      pdf.addPage();
      addPageHeader(pdf, document.title || "商品养护／使用知识包", logo);
    }

    const cardY = pdf.y;
    pdf.roundedRect(pdf.page.margins.left, cardY, pageWidth, cardHeight, 10).fillAndStroke("#ffffff", "#d6d3d1");
    const image = await getImage(product.images[0], assetOrigin);
    if (image) {
      try {
        pdf.image(image, pdf.page.margins.left + 14, cardY + 16, { fit: [photoWidth - 28, 100], align: "center", valign: "center" });
      } catch {
        pdf.roundedRect(pdf.page.margins.left + 14, cardY + 16, photoWidth - 28, 100, 8).fillAndStroke("#f5f5f4", "#e7e5e4");
      }
    } else {
      pdf.roundedRect(pdf.page.margins.left + 14, cardY + 16, photoWidth - 28, 100, 8).fillAndStroke("#f5f5f4", "#e7e5e4");
    }

    pdf.fillColor("#1c1917").font("CarePackCJK").fontSize(14).text(product.productName, contentX, cardY + 16, { width: contentWidth });
    if (product.variationName) pdf.fillColor("#065f46").fontSize(10).text(product.variationName, contentX, cardY + 34, { width: contentWidth });

    let rowY = cardY + 58;
    for (let index = 0; index < rows.length; index += 2) {
      const leftRow = rows[index];
      const rightRow = rows[index + 1];
      const rowHeight = Math.max(leftRow.height, rightRow?.height ?? 0);
      pdf.fillColor("#065f46").font("CarePackCJK").fontSize(9).text(leftRow.label, contentX, rowY, { width: columnWidth });
      pdf.fillColor("#44403c").fontSize(10).text(leftRow.value, contentX, rowY + 13, { width: columnWidth });
      if (rightRow) {
        const rightX = contentX + columnWidth + 16;
        pdf.fillColor("#065f46").fontSize(9).text(rightRow.label, rightX, rowY, { width: columnWidth });
        pdf.fillColor("#44403c").fontSize(10).text(rightRow.value, rightX, rowY + 13, { width: columnWidth });
      }
      rowY += rowHeight;
    }
    pdf.y = cardY + cardHeight + 18;
  }

  pdf.end();
  return done;
}
