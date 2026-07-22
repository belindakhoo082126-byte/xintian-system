export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // ParcelDaily
  parceldailyMerchantId: process.env.PARCELDAILY_MERCHANT_ID ?? "",
  parceldailyToken: process.env.PARCELDAILY_TOKEN ?? "",
  parceldailyEnv: (process.env.PARCELDAILY_ENV as "production" | "sandbox") ?? "production",
  // Facebook
  fbAppId: process.env.FB_APP_ID ?? "",
  fbAppSecret: process.env.FB_APP_SECRET ?? "",
  fbPageId: process.env.FB_PAGE_ID ?? "",
  fbPageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN ?? "",
  fbVerifyToken: process.env.FB_VERIFY_TOKEN ?? "",
};
