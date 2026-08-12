import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "client/src/pages/LiveRoomDetail.tsx"), "utf8");

describe("直播详情的操作口径与商品预览", () => {
  it("保留可保存的后台直播备忘录，不影响留言备注机制", () => {
    expect(source).toContain('updateRoomMutation.mutate({ id: roomId, notes: roomNotes.trim() })');
    expect(source).toContain("直播备忘录（仅后台可见");
  });

  it("为商品照片提供可访问的放大预览，并明确直播价与数量口径", () => {
    expect(source).toContain("点击放大商品照片");
    expect(source).toContain("onPreview={(url: string, name: string)");
    expect(source).toContain("直播价只用于本场新建订单");
    expect(source).toContain("商品数为本场已加入的独立商品；商品数量为本场成功捉单的总件数。");
  });
});
