import { describe, expect, it } from "vitest";
import { getSalesModeFromPresale, isPresaleSalesMode } from "../shared/presaleSalesMode";

describe("预购销售模式", () => {
  it("以销售模式作为普通预购的单一来源", () => {
    expect(getSalesModeFromPresale(true, "normal")).toBe("presale");
    expect(getSalesModeFromPresale(false, "presale")).toBe("normal");
    expect(isPresaleSalesMode("presale")).toBe(true);
  });

  it("不以普通预购逻辑覆盖中国进口代购模式", () => {
    expect(getSalesModeFromPresale(true, "import_preorder")).toBe("import_preorder");
  });
});

