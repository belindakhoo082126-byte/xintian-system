import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ordersPage = readFileSync(new URL("../client/src/pages/Orders.tsx", import.meta.url), "utf8");

describe("订单管理页面级合并订单入口", () => {
  it("提供独立页面操作入口，并要求从列表单选来源订单", () => {
    expect(ordersPage).toContain("data-page-merge-entry");
    expect(ordersPage).toContain('translate("合并订单", "Merge Orders")');
    expect(ordersPage).toContain("if (selectedIds.size !== 1)");
    expect(ordersPage).toContain("setMergeSourceOrderId(sourceOrderId)");
  });

  it("复用既有合单候选与确认接口，不绕过服务端资格保护", () => {
    expect(ordersPage).toContain("trpc.orders.mergeCandidates.useQuery");
    expect(ordersPage).toContain("enabled: mergeDialogOpen && mergeSourceOrderId !== null");
    expect(ordersPage).toContain("trpc.orders.merge.useMutation");
    expect(ordersPage).toContain("sourceOrderId: mergeSourceOrderId, targetOrderId: Number(mergeTargetId)");
    expect(ordersPage).toContain("utils.orders.invalidate()");
  });

  it("将来源订单、不同客户合并资格与目标订单客户资料均呈现在页面级对话框中", () => {
    expect(ordersPage).toContain("data-page-merge-dialog");
    expect(ordersPage).toContain('translate("要并入的来源订单", "Source order to merge")');
    expect(ordersPage).toContain('translate("合并至订单", "Merge into order")');
    expect(ordersPage).toContain("mergeCandidates.map");
    expect(ordersPage).toContain("不同客户也可合并");
    expect(ordersPage).toContain("candidate.customerName");
  });
});
