import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Languages } from "lucide-react";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function containsAction(element: Element) {
  return Boolean(element.matches("button, [role='button']") || element.querySelector("button, [role='button']"));
}

function resolveHeader(main: HTMLElement) {
  const sharedHeader = main.querySelector<HTMLElement>("[data-admin-page-header]");
  if (sharedHeader) return sharedHeader;

  const title = main.querySelector<HTMLElement>("h1");
  if (title) {
    let node = title.parentElement;
    let nearestFlexAncestor: HTMLElement | null = null;

    while (node && node !== main) {
      const children = Array.from(node.children);
      const titleBranch = children.find((child) => child === title || child.contains(title));
      const hasSiblingAction = children.some((child) => child !== titleBranch && containsAction(child));
      if (hasSiblingAction) return node;

      const classes = node.className;
      if (!nearestFlexAncestor && typeof classes === "string" && classes.includes("flex")) {
        nearestFlexAncestor = node;
      }
      node = node.parentElement;
    }

    return nearestFlexAncestor ?? title.parentElement;
  }

  // Some legacy list pages (for example the order list) only expose a
  // description and an action row. Prefer the first top-level flex row that
  // actually contains an action instead of anchoring to unrelated dialog text.
  const rows = Array.from(main.querySelectorAll<HTMLElement>("div"));
  return rows.find((row) => {
    const classes = row.className;
    return typeof classes === "string" && classes.includes("flex") && containsAction(row);
  }) ?? null;
}

function resolveActions(header: HTMLElement, title: HTMLElement | null) {
  const existing = header.querySelector<HTMLElement>("[data-admin-page-header-actions], [data-page-header-actions], .header-actions");
  if (existing) return existing;

  const titleBranch = title ? Array.from(header.children).find((child) => child === title || child.contains(title)) : null;
  const rightBranch = Array.from(header.children).find((child) => {
    if (child === titleBranch) return false;
    return containsAction(child);
  }) as HTMLElement | undefined;

  if (rightBranch) {
    rightBranch.classList.add("header-actions");
    return rightBranch;
  }

  const host = document.createElement("div");
  host.className = "header-actions";
  host.dataset.adminLanguageBridgeHost = "true";
  header.appendChild(host);
  return host;
}

/**
 * Supplies the language selector to legacy page headers that still render
 * their own title/actions. The selector is portaled into the same flex action
 * group instead of using a fixed or absolutely positioned toolbar.
 */
export function AdminHeaderLanguageBridge() {
  const [location] = useLocation();
  const { lang, setLang } = useI18n();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-admin-menu-content]");
    if (!main) return;

    const sync = () => {
      const header = resolveHeader(main);
      if (!header) {
        setTarget(null);
        return;
      }

      // AdminPageHeader already owns a language selector; do not add a second one.
      if (header.querySelector("[data-language-selector]")) {
        setTarget(null);
        return;
      }

      header.classList.add("header-with-actions");
      const title = header.querySelector<HTMLElement>("h1");
      setTarget(resolveActions(header, title));
    };

    const frame = window.requestAnimationFrame(sync);
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync));
    observer.observe(main, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [location]);

  if (!target) return null;

  return createPortal(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-language-selector
          className="header-language-selector"
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
    </DropdownMenu>,
    target,
  );
}
