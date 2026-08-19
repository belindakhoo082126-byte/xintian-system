/** TiDB/MySQL 的 DECIMAL 列不能接受空字符串；空价格代表继承商品价格。 */
export function normalizeVariantDecimal(value: string | null | undefined) {
  return value === undefined || value === null || value.trim() === "" ? null : value;
}

