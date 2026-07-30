import { describe, expect, it } from "vitest";
import { getAiBrainInitialTab } from "./AiBrain";

describe("getAiBrainInitialTab", () => {
  it("opens the AI log tab from the dashboard shortcut deep link", () => {
    expect(getAiBrainInitialTab("?tab=log")).toBe("log");
  });

  it("allows supported management tabs and safely falls back for unsupported values", () => {
    expect(getAiBrainInitialTab("?tab=knowledge")).toBe("knowledge");
    expect(getAiBrainInitialTab("?tab=analytics")).toBe("dashboard");
    expect(getAiBrainInitialTab("?tab=unknown")).toBe("dashboard");
    expect(getAiBrainInitialTab("")).toBe("dashboard");
  });
});
