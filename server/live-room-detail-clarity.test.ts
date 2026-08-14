import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "client/src/pages/LiveRoomDetail.tsx"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const liveRoomsSource = fs.readFileSync(path.join(root, "client/src/pages/LiveRooms.tsx"), "utf8");

describe("直播详情的操作口径与商品预览", () => {
  it("直播间备忘录经专用接口保存、数据库回读并立即回显，不影响留言备注机制", () => {
    expect(routerSource).toContain("saveRoomNotes: adminProcedure");
    expect(routerSource).toContain("await db.updateLiveRoom(input.liveRoomId, { notes: input.content })");
    expect(routerSource).toContain("const savedRoom = await db.getLiveRoomById(input.liveRoomId)");
    expect(source).toContain("const saveRoomNotesMutation = trpc.liveRooms.saveRoomNotes.useMutation");
    expect(source).toContain("saveRoomNotesMutation.mutate({ liveRoomId: roomId, content: roomNotes })");
    expect(source).toContain("queryClient.liveRooms.getById.setData({ id: roomId }");
    expect(source).toContain("已载入最近保存的备忘录");
  });

  it("为商品照片提供可访问的放大预览，并明确直播价与数量口径", () => {
    expect(source).toContain("点击放大商品照片");
    expect(source).toContain("onPreview={(url: string, name: string)");
    expect(source).toContain("直播价只用于本场新建订单");
    expect(source).toContain("商品数为本场已加入的独立商品；商品数量为本场成功捉单的总件数。");
  });

  it("直播管理列表明确标示商品种类与成功捉单件数", () => {
    expect(liveRoomsSource).toContain("const productCountLabel");
    expect(liveRoomsSource).toContain("const totalItemsLabel");
    expect(liveRoomsSource).toContain("本场直播已上架的不同商品种类数。");
    expect(liveRoomsSource).toContain("本场直播成功捉单的商品总件数，不是剩余库存。");
  });
});
