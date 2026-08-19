import { describe, expect, it } from "vitest";
import { removeVariantFromList, upsertVariantInList } from "../shared/variantListSync";

describe("规格列表即时同步", () => {
  it("新增、更新和删除规格后立即产生正确的当前列表", () => {
    const created = upsertVariantInList([], { id: 1, name: "粉白色", stockQuantity: 0 });
    expect(created).toEqual([{ id: 1, name: "粉白色", stockQuantity: 0 }]);
    const updated = upsertVariantInList(created, { id: 1, name: "粉白色", stockQuantity: 5 });
    expect(updated).toEqual([{ id: 1, name: "粉白色", stockQuantity: 5 }]);
    expect(removeVariantFromList(updated, 1)).toEqual([]);
  });
});

