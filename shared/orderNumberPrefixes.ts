export const LOCAL_ORDER_PREFIX = "XT";
export const IMPORT_ORDER_PREFIX = "XTD";
export const LEGACY_IMPORT_ORDER_PREFIX = "XTC";

/** 旧XTC订单仍可查询；只有新建代购订单使用XTD。 */
export function isImportOrderNumber(orderNumber: string | null | undefined): boolean {
  return /^(?:XTD|XTC)\d+$/i.test((orderNumber || "").trim());
}
