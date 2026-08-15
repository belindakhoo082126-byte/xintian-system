import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared header for every back-office content page.
 *
 * Page actions remain in the normal header flex group. The sole global language
 * selector is intentionally placed in the Dashboard sidebar above its navigation.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  className = "",
}: AdminPageHeaderProps) {
  return (
    <header
      data-admin-page-header
      className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div data-admin-page-header-copy className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>

      <div
        data-admin-page-header-actions
        className="header-actions flex shrink-0 flex-wrap items-center justify-end gap-3 sm:flex-nowrap"
      >
        {actions}
      </div>
    </header>
  );
}
