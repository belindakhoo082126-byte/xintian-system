import { describe, expect, it } from "vitest";
import { buildSystemLink, getCompanyLogoChange, getPersistedCompanyLogoUrl, isSupportedCompanyLogo } from "./settingsLinks";

describe("系统设置链接与Logo校验", () => {
  it("使用当前站点域名生成商城与包货链接，并避免双斜线", () => {
    expect(buildSystemLink("https://www.xintian.com.my", "/mall")).toBe("https://www.xintian.com.my/mall");
    expect(buildSystemLink("https://www.xintian.com.my/", "packing")).toBe("https://www.xintian.com.my/packing");
    expect(buildSystemLink(undefined, "/packing")).toBe("https://www.xintian.com.my/packing");
    expect(buildSystemLink("http://127.0.0.1:3000", "/mall")).toBe("https://www.xintian.com.my/mall");
  });

  it("只接受图片类型作为公司Logo上传文件", () => {
    expect(isSupportedCompanyLogo({ type: "image/png" } as File)).toBe(true);
    expect(isSupportedCompanyLogo({ type: "image/svg+xml" } as File)).toBe(true);
    expect(isSupportedCompanyLogo({ type: "application/pdf" } as File)).toBe(false);
    expect(isSupportedCompanyLogo()).toBe(false);
  });

  it("明确区分新增、替换、移除与未变更的Logo保存动作", () => {
    expect(getCompanyLogoChange("/manus-storage/old.png", "/manus-storage/old.png")).toBe("unchanged");
    expect(getCompanyLogoChange(undefined, "/manus-storage/new.png")).toBe("new");
    expect(getCompanyLogoChange("/manus-storage/old.png", "/manus-storage/new.png")).toBe("replace");
    expect(getCompanyLogoChange("/manus-storage/old.png", "")).toBe("remove");
  });

  it("只以设置接口返回的已保存Logo更新回填值", () => {
    expect(getPersistedCompanyLogoUrl({ companyLogoUrl: " /manus-storage/logo.png " })).toBe("/manus-storage/logo.png");
    expect(getPersistedCompanyLogoUrl({ companyLogoUrl: null })).toBe("");
    expect(getPersistedCompanyLogoUrl(undefined)).toBe("");
  });
});
