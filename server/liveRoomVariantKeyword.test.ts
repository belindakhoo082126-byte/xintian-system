import { describe, expect, it } from "vitest";
import { composeLiveVariantKeyword } from "../shared/liveRoomVariantKeyword";

describe("直播房规格客户关键词", () => {
  it("将商品关键词与规格关键词组合为客户实际喊单关键词", () => {
    expect(composeLiveVariantKeyword("AS", "1")).toBe("AS1");
    expect(composeLiveVariantKeyword("LS", "28")).toBe("LS28");
  });

  it("规格关键词已含商品前缀时不重复拼接", () => {
    expect(composeLiveVariantKeyword("AS", "AS1")).toBe("AS1");
  });
});
