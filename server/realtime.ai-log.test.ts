import { describe, expect, it, vi } from "vitest";
import { addSSEClient, broadcastChange } from "./_core/realtime";

function createResponseDouble() {
  return {
    writeHead: vi.fn(),
    write: vi.fn(),
  } as any;
}

describe("AI日志 SSE 广播", () => {
  it("delivers an aiLog change event to two independent connected clients", () => {
    const firstClient = createResponseDouble();
    const secondClient = createResponseDouble();
    const cleanupFirst = addSSEClient(firstClient);
    const cleanupSecond = addSSEClient(secondClient);

    try {
      broadcastChange("aiLog", 901);

      const eventText = `data: ${JSON.stringify({
        category: "aiLog",
        timestamp: expect.any(Number),
        entityId: 901,
      })}\n\n`;

      expect(firstClient.write).toHaveBeenCalledWith(expect.stringContaining('"category":"aiLog"'));
      expect(firstClient.write).toHaveBeenCalledWith(expect.stringContaining('"entityId":901'));
      expect(secondClient.write).toHaveBeenCalledWith(expect.stringContaining('"category":"aiLog"'));
      expect(secondClient.write).toHaveBeenCalledWith(expect.stringContaining('"entityId":901'));
      expect(firstClient.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        "Content-Type": "text/event-stream",
      }));
      expect(secondClient.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        "Content-Type": "text/event-stream",
      }));
      expect(eventText).toContain("aiLog");
    } finally {
      cleanupFirst();
      cleanupSecond();
    }
  });
});
