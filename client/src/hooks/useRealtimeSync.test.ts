import { describe, expect, it } from "vitest";
import { CATEGORY_TO_QUERY_KEYS } from "./useRealtimeSync";

describe("AI日志实时同步映射", () => {
  it("invalidates all aiLog tRPC queries when the server broadcasts an aiLog event", () => {
    expect(CATEGORY_TO_QUERY_KEYS.aiLog).toEqual(["aiLog"]);
  });
});
