export const XINTIAN_PUBLIC_ORIGIN = "https://www.xintian.com.my";

export function buildSystemLink(origin: string | undefined, pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const safeOrigin = !origin || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)
    ? XINTIAN_PUBLIC_ORIGIN
    : origin;
  return `${safeOrigin.replace(/\/$/, "")}${normalizedPath}`;
}

export function isSupportedCompanyLogo(file?: Pick<File, "type">) {
  return Boolean(file?.type?.startsWith("image/"));
}

export type CompanyLogoChange = "unchanged" | "new" | "replace" | "remove";

/**
 * Keeps Logo UI messaging consistent with the persisted company profile.
 * The function intentionally only compares URLs; uploading stays server-side.
 */
export function getCompanyLogoChange(
  persistedUrl?: string | null,
  nextUrl?: string | null,
): CompanyLogoChange {
  const previous = persistedUrl?.trim() ?? "";
  const next = nextUrl?.trim() ?? "";
  if (previous === next) return "unchanged";
  if (!previous && next) return "new";
  if (previous && !next) return "remove";
  return "replace";
}

/** Returns the URL confirmed by the settings mutation, keeping the form on server truth. */
export function getPersistedCompanyLogoUrl(saved: { companyLogoUrl?: string | null } | null | undefined) {
  return saved?.companyLogoUrl?.trim() || "";
}
