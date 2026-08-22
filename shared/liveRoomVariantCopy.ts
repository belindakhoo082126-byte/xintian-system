export type LiveRoomVariantCopyItem = {
  name: string;
  keyword: string;
  price: number;
  onHand: number;
  called: number;
  available: number;
};

export function formatLiveRoomVariantCopyText(
  productName: string,
  variants: LiveRoomVariantCopyItem[],
  footer: string,
): string {
  if (variants.length === 0) return `🌸 ${productName}\n\n${footer}`;

  if (variants.length === 1) {
    const item = variants[0];
    return `🌸 ${productName}\n💰 RM${item.price.toFixed(2)}\n📝 关键词：${item.keyword}\n\n留言格式：${item.keyword}+1\n\n${footer}`;
  }

  const lines = variants.map((item) =>
    `• ${item.name}｜关键词：${item.keyword}｜RM${item.price.toFixed(2)}\n  留言：${item.keyword}+1`,
  );

  return `🌸 ${productName}\n\n请选择规格留言：\n${lines.join("\n")}\n\n${footer}`;
}
