import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ImportBatches state initialization", () => {
  it("declares selectedBatchId before navigation effects and batch lookups use it", () => {
    const source = readFileSync(new URL("./ImportBatches.tsx", import.meta.url), "utf8");
    const selectedStateIndex = source.indexOf("const [selectedBatchId, setSelectedBatchId]");
    const popStateEffectIndex = source.indexOf("useEffect(() => {");
    const selectedBatchLookupIndex = source.indexOf("const selectedBatch =");

    expect(selectedStateIndex).toBeGreaterThan(-1);
    expect(popStateEffectIndex).toBeGreaterThan(-1);
    expect(selectedBatchLookupIndex).toBeGreaterThan(-1);
    expect(selectedStateIndex).toBeLessThan(popStateEffectIndex);
    expect(selectedStateIndex).toBeLessThan(selectedBatchLookupIndex);
  });
});
