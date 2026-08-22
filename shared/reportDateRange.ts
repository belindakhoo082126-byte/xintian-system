export function toLocalDateInput(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * 日期输入控件只提供日历日；后端利润查询必须覆盖“到”日期整天，
 * 否则当天较晚发生的付款、发货成本和退款会被错误排除。
 */
export function buildInclusiveReportDateRange(dateFrom: string, dateTo: string) {
  return {
    dateFrom: `${dateFrom}T00:00:00.000`,
    dateTo: `${dateTo}T23:59:59.999`,
  };
}
