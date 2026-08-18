import { describe, expect, it } from "vitest";
import { parseCommentKeywords } from "./db";

describe("Facebook 直播捉单留言解析", () => {
  it("解析多个关键字、规格关键字和显式数量，并统一关键字大小写", () => {
    expect(parseCommentKeywords("rose+2, pot_red + 3\nsoil")).toEqual([
      { keyword: "ROSE", quantity: 2 },
      { keyword: "POT_RED", quantity: 3 },
      { keyword: "SOIL", quantity: 1 },
    ]);
  });

  it("忽略零数量、负数量和不符合关键字格式的留言片段", () => {
    expect(parseCommentKeywords("ROSE+0; POT+-1; hello world; A1+2")).toEqual([
      { keyword: "A1", quantity: 2 },
    ]);
  });
});
