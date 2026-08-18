import { describe, expect, it } from "vitest";
import { getCompanyLogoUrl, XINTIAN_LOGO_URL } from "./brandAssets";

describe("心田品牌资源", () => {
  it("使用项目静态存储中的 Logo 地址", () => {
    expect(XINTIAN_LOGO_URL).toBe("/manus-storage/xintian-logo-original_ad60e3c3.png");
  });

  it("优先使用公司资料中已保存的 Logo", () => {
    expect(getCompanyLogoUrl({ companyLogoUrl: "/manus-storage/company-logo.png" })).toBe(
      "/manus-storage/company-logo.png",
    );
    expect(getCompanyLogoUrl({ companyLogoUrl: "  " })).toBe(XINTIAN_LOGO_URL);
  });
});
