export const notificationLogChannels = ["messenger", "whatsapp", "email", "system"] as const;
export type NotificationLogChannel = typeof notificationLogChannels[number];

/** 将外部发送平台或“无联系方式”状态转换为数据库允许的审计频道。 */
export function normalizeNotificationLogChannel(platform?: string | null): NotificationLogChannel {
  if (platform === "facebook" || platform === "messenger") return "messenger";
  if (platform === "whatsapp") return "whatsapp";
  if (platform === "email") return "email";
  return "system";
}
