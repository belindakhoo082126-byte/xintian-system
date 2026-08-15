import type { ReactNode } from "react";
import { Languages } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared header for every back-office content page.
 *
 * Actions and the language selector intentionally live in the same flex group:
 * no fixed positioning, manual top offset or negative margin is needed.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  className = "",
}: AdminPageHeaderProps) {
  const { lang, setLang } = useI18n();

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-language-selector
              className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 text-sm font-semibold leading-none text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={lang === "zh" ? "选择语言，目前为中文" : "Select language, currently English"}
            >
              <Languages className="h-4 w-4" aria-hidden="true" />
              <span>{lang === "zh" ? "中文" : "EN"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-36">
            <DropdownMenuLabel>语言 / Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setLang("zh")} className="cursor-pointer">
              <span>中文</span>
              {lang === "zh" && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLang("en")} className="cursor-pointer">
              <span>English</span>
              {lang === "en" && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
