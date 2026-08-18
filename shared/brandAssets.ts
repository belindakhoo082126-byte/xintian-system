/**
 * 心田系统的统一品牌资源地址。
 * 该文件只保存已上传到项目静态存储的资源路径，避免页面使用失效的临时本地路径。
 */
export const XINTIAN_LOGO_URL = "/manus-storage/xintian-logo-original_ad60e3c3.png";

/**
 * 公司资料尚未完成加载或尚未保存 Logo 时，仍保持心田的默认品牌图；
 * 已保存后则以 `system_settings.companyLogoUrl` 为唯一优先来源。
 */
export function getCompanyLogoUrl(
  settings: { companyLogoUrl?: string | null } | null | undefined,
) {
  return settings?.companyLogoUrl?.trim() || XINTIAN_LOGO_URL;
}
