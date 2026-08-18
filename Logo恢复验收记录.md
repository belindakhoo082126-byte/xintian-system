# 心田 Logo 恢复验收记录

## 恢复结果

- 用户提供的原始 Logo 已保存至项目静态资源，并使用 `/manus-storage/xintian-logo-original_ad60e3c3.png`。
- `system_settings` 的唯一记录（`id = 1`）已保存同一 `companyLogoUrl`。
- 后台左上角通过 `system_settings.companyLogoUrl` 读取已保存的 Logo；在设置数据尚未返回时才使用同一图片作为默认后备资源。

## 单例与真实登录态验收

- 通过既有 `updateSystemSettings` 函数连续保存同一 Logo 两次，三次读取的记录 ID 均为 `1`；随后数据库复核 `settingCount = 1`。
- 2026-08-18 在真实登录后台页面 `/system-settings` 验收：登录用户显示为 Enabelle Khoo，左上角侧边栏和“公司 Logo 预览”均显示 `/manus-storage/xintian-logo-original_ad60e3c3.png`，页面提示“当前 Logo 已保存，并会在重新进入此页面时回显”。

## 自动化验证

- `pnpm test`：13 个测试文件、33 项测试通过。
- `pnpm check`：TypeScript 检查通过。

