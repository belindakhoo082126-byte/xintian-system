import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Languages, Leaf, Sun, Moon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Package, ShoppingCart, Crown, Users,
  MessageSquare, BarChart3, Truck, PackagePlus, TrendingUp, Facebook,
  FolderTree, ChevronRight, DollarSign, ShoppingBag, Boxes, Settings,
  Ship, Warehouse, CreditCard, Store, PackageCheck, Search, AlertTriangle, AlertCircle,
  ClipboardList, Video, Plane, ChevronDown, Bot, Home, FileText, Receipt, Brain, FileEdit,
  Megaphone,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

type MenuChild = {
  icon: any;
  label: string | { zh: string; en: string };
  path?: string;
  children?: MenuChild[];
  accent?: MenuAccent;
};
type MenuGroup = {
  icon: any;
  label: string | { zh: string; en: string };
  children: MenuChild[];
  accent?: MenuAccent;
};

type MenuEntry = MenuChild | MenuGroup;

type MenuAccent = {
  iconClass: string;
  activeClass: string;
};

const MENU_ACCENTS = {
  dashboard: { iconClass: "text-rose-600", activeClass: "data-[active=true]:bg-rose-50 data-[active=true]:text-rose-900 dark:data-[active=true]:bg-rose-950/35 dark:data-[active=true]:text-rose-100" },
  live: { iconClass: "text-amber-600", activeClass: "data-[active=true]:bg-amber-50 data-[active=true]:text-amber-900 dark:data-[active=true]:bg-amber-950/35 dark:data-[active=true]:text-amber-100" },
  campaign: { iconClass: "text-blue-600", activeClass: "data-[active=true]:bg-blue-50 data-[active=true]:text-blue-900 dark:data-[active=true]:bg-blue-950/35 dark:data-[active=true]:text-blue-100" },
  orders: { iconClass: "text-orange-600", activeClass: "data-[active=true]:bg-orange-50 data-[active=true]:text-orange-900 dark:data-[active=true]:bg-orange-950/35 dark:data-[active=true]:text-orange-100" },
  packing: { iconClass: "text-[#7B3F00]", activeClass: "data-[active=true]:bg-[#FFF2E6] data-[active=true]:text-[#5A2D0C] dark:data-[active=true]:bg-[#5A2D0C]/35 dark:data-[active=true]:text-[#FFE4CC]" },
  products: { iconClass: "text-emerald-600", activeClass: "data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-900 dark:data-[active=true]:bg-emerald-950/35 dark:data-[active=true]:text-emerald-100" },
  customers: { iconClass: "text-violet-600", activeClass: "data-[active=true]:bg-violet-50 data-[active=true]:text-violet-900 dark:data-[active=true]:bg-violet-950/35 dark:data-[active=true]:text-violet-100" },
  ai: { iconClass: "text-indigo-600", activeClass: "data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-900 dark:data-[active=true]:bg-indigo-950/35 dark:data-[active=true]:text-indigo-100" },
  import: { iconClass: "text-pink-600", activeClass: "data-[active=true]:bg-pink-50 data-[active=true]:text-pink-900 dark:data-[active=true]:bg-pink-950/35 dark:data-[active=true]:text-pink-100" },
  reports: { iconClass: "text-purple-600", activeClass: "data-[active=true]:bg-purple-50 data-[active=true]:text-purple-900 dark:data-[active=true]:bg-purple-950/35 dark:data-[active=true]:text-purple-100" },
  logistics: { iconClass: "text-cyan-600", activeClass: "data-[active=true]:bg-cyan-50 data-[active=true]:text-cyan-900 dark:data-[active=true]:bg-cyan-950/35 dark:data-[active=true]:text-cyan-100" },
  settings: { iconClass: "text-slate-600", activeClass: "data-[active=true]:bg-slate-100 data-[active=true]:text-slate-900 dark:data-[active=true]:bg-slate-800 dark:data-[active=true]:text-slate-100" },
} satisfies Record<string, MenuAccent>;

function isGroup(item: MenuEntry): item is MenuGroup {
  return (item as MenuGroup).children !== undefined;
}

function isMenuPathActive(location: string, path?: string) {
  if (!path || path === '/') return location === '/';
  if (path.includes('?')) return location === path;
  return location === path || location.startsWith(`${path}/`);
}

const menuStructure: MenuEntry[] = [
  // 1. Dashboard
  { icon: LayoutDashboard, label: "nav.dashboard", path: "/", accent: MENU_ACCENTS.dashboard },

  // 2. 直播管理
  {
    icon: Video,
    label: { zh: "直播管理", en: "Live Management" },
    path: "/live-rooms",
    accent: MENU_ACCENTS.live,
  },

  // 2b. Facebook Campaign
  {
    icon: Megaphone,
    label: { zh: "FB Campaign", en: "FB Campaign" },
    path: "/campaigns",
    accent: MENU_ACCENTS.campaign,
  },

  // 3. 订单管理
  {
    icon: ShoppingCart,
    label: { zh: "订单管理", en: "Order Management" },
    accent: MENU_ACCENTS.orders,
    children: [
      { icon: Home, label: { zh: "本地订单", en: "Local Orders" }, path: "/orders/local" },
      { icon: Plane, label: { zh: "中国代购订单", en: "Import Orders" }, path: "/orders/import" },
      { icon: Crown, label: { zh: "会员订单", en: "Membership Orders" }, path: "/membership" },
      { icon: Search, label: { zh: "订单查询", en: "Order Search" }, path: "/orders/search" },
      { icon: FileEdit, label: { zh: "草稿订单", en: "Draft Orders" }, path: "/draft-orders" },
      { icon: FileEdit, label: { zh: "订单变更请求", en: "Change Requests" }, path: "/order-change-requests" },
    ],
  },

  // 4. 包货工作台
  { icon: Truck, label: "nav.packing", path: "/packing", accent: MENU_ACCENTS.packing },

  // 5. 商品管理
  {
    icon: Package,
    label: { zh: "商品管理", en: "Product Management" },
    accent: MENU_ACCENTS.products,
    children: [
      { icon: Package, label: "nav.products", path: "/products" },
      { icon: Boxes, label: { zh: "组合包管理", en: "Product Bundles" }, path: "/product-bundles" },
      { icon: FolderTree, label: { zh: "分类管理", en: "Categories" }, path: "/categories" },
      { icon: PackagePlus, label: { zh: "进货管理", en: "Purchase Orders" }, path: "/purchase-orders" },
      { icon: Truck, label: { zh: "供应商管理", en: "Suppliers" }, path: "/suppliers" },
      { icon: ClipboardList, label: { zh: "库存日志", en: "Inventory Log" }, path: "/inventory-log" },
    ],
  },

  // 6. 客户管理
  { icon: Users, label: "nav.customers", path: "/customers", accent: MENU_ACCENTS.customers },

  // 7. AI 客服
  {
    icon: Bot,
    label: { zh: "AI 客服", en: "AI Customer Service" },
    accent: MENU_ACCENTS.ai,
    children: [
      { icon: MessageSquare, label: { zh: "Chat 客服", en: "Chat" }, path: "/chat" },
      { icon: AlertCircle, label: { zh: "AI 转人工通知", en: "AI Handover" }, path: "/ai-handover" },
      { icon: Brain, label: { zh: "AI 大脑", en: "AI Brain" }, path: "/ai-brain" },
      { icon: Bot, label: { zh: "Flow 管理", en: "Flow Management" }, path: "/flows" },
      { icon: Video, label: { zh: "直播AI", en: "Live AI" }, path: "/live-ai-flows" },
    ],
  },

  // 8. 中国代购采购
  {
    icon: Plane,
    label: { zh: "中国代购采购", en: "Import Purchasing" },
    accent: MENU_ACCENTS.import,
    children: [
      { icon: FileText, label: { zh: "CN（中国采购）", en: "CN (China Purchase)" }, path: "/import-batches?tab=cn" },
      { icon: Boxes, label: { zh: "IB（Import Batch）", en: "IB (Import Batch)" }, path: "/import-batches?tab=ib" },
    ],
  },

  // 9. 报告
  {
    icon: BarChart3,
    label: { zh: "报告", en: "Reports" },
    accent: MENU_ACCENTS.reports,
    children: [
      { icon: DollarSign, label: { zh: "销售与收款", en: "Sales & Payment" }, path: "/reports/sales-payment" },
      { icon: ShoppingBag, label: { zh: "商品销售", en: "Product Sales" }, path: "/reports/product-sales" },
      { icon: Users, label: { zh: "客户消费", en: "Customer Spending" }, path: "/reports/customer-spending" },
      { icon: Boxes, label: { zh: "进货与库存", en: "Purchase & Inventory" }, path: "/reports/purchase-inventory" },
      { icon: TrendingUp, label: { zh: "利润分析", en: "Profit Analysis" }, path: "/reports/profit-analysis" },
      { icon: AlertTriangle, label: { zh: "损耗分析", en: "Loss Analysis" }, path: "/reports/loss-analysis" },
      { icon: Receipt, label: { zh: "Payment Record", en: "Payment Record" }, path: "/profit-report" },
    ],
  },

  // 10. 物流
  {
    icon: Ship,
    label: { zh: "物流", en: "Logistics" },
    accent: MENU_ACCENTS.logistics,
    children: [
      { icon: Ship, label: { zh: "运费规则", en: "Shipping Rules" }, path: "/shipping-rules" },
      { icon: Warehouse, label: "nav.logistics", path: "/logistics" },
    ],
  },

  // 11. Setting
  {
    icon: Settings,
    label: "nav.systemSettings",
    accent: MENU_ACCENTS.settings,
    children: [
      { icon: Facebook, label: "nav.facebookSettings", path: "/facebook-settings" },
      { icon: CreditCard, label: "nav.paymentSettings", path: "/payment-settings" },
      { icon: Settings, label: "nav.systemSettings", path: "/system-settings" },
      { icon: Store, label: "nav.mallSettings", path: "/mall-settings" },
    ],
  },
];

// Flatten all paths for shipping staff filtering
const ALL_PATHS = new Set<string>();
const SHIPPING_STAFF_MENU_PATHS = new Set(["/packing", "/order-tracking"]);
menuStructure.forEach(item => {
  if (isGroup(item)) {
    item.children.forEach(child => {
      if (child.path) ALL_PATHS.add(child.path);
      if (child.children) child.children.forEach(sub => { if (sub.path) ALL_PATHS.add(sub.path); });
    });
  } else {
    const p = (item as MenuChild).path;
    if (p) ALL_PATHS.add(p);
  }
});

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isShippingStaff = user?.role !== "admin";

  // For shipping staff, only show packing and order-tracking
  const visibleMenu = isShippingStaff
    ? menuStructure.filter(item => {
        if (isGroup(item)) {
          return item.children.some(child => child.path && SHIPPING_STAFF_MENU_PATHS.has(child.path));
        }
        return (item as MenuChild).path ? SHIPPING_STAFF_MENU_PATHS.has((item as MenuChild).path!) : false;
      })
    : menuStructure;

  const resolveLabel = (label: string | { zh: string; en: string }): string =>
    typeof label === "string" ? t(label) : (lang === "zh" ? label.zh : label.en);

  // Find active label for header
  let activeLabel = "Menu";
  for (const item of visibleMenu) {
    if (isGroup(item)) {
      for (const child of item.children) {
        if (isMenuPathActive(location, child.path)) {
          activeLabel = resolveLabel(child.label);
          break;
        }
      }
    } else {
      const itemPath = (item as MenuChild).path;
      if (itemPath && location === itemPath) {
        activeLabel = resolveLabel(item.label);
        break;
      }
    }
  }

  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (isShippingStaff && !SHIPPING_STAFF_MENU_PATHS.has(location)) {
      setLocation("/packing");
    }
  }, [isShippingStaff, location, setLocation]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Check if a group has an active child
  const isGroupActive = (group: MenuGroup): boolean => {
    return group.children.some(child => {
      if (!child.path) return false;
      const childPath = child.path.split('?')[0];
      return childPath !== '/' && location.startsWith(childPath);
    });
  };

  return (
    <>
      <div className="relative no-print" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 no-print"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-2 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className={`flex items-center min-w-0 ${isCollapsed ? "flex-1 justify-center" : "flex-1 gap-2"}`}>
                <img
                  src="/manus-storage/xintian-logo_701b1761.png"
                  alt="心田 Xin Tian"
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/20 shrink-0"
                />
                {!isCollapsed && (
                  <span className="font-bold tracking-tight truncate text-primary">
                    心田 Xin Tian
                  </span>
                )}
              </div>
              <button
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                className={`h-8 rounded-md border border-primary/20 bg-primary/5 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isCollapsed ? "absolute right-1 top-1" : "shrink-0"}`}
                aria-label={lang === "zh" ? "Switch to English" : "切换为中文"}
                title={lang === "zh" ? "English" : "中文"}
              >
                {lang === "zh" ? "EN" : "中文"}
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            <SidebarMenu className="px-2 py-1">
              {visibleMenu.map((item, idx) => {
                if (isGroup(item)) {
                  const groupActive = isGroupActive(item);
                  return (
                    <SidebarMenuItem key={`group-${idx}`}>
                      <CollapsibleMenuGroup
                        icon={item.icon}
                        label={resolveLabel(item.label)}
                        isActive={groupActive}
                        isCollapsed={isCollapsed}
                        children={item.children}
                        location={location}
                        setLocation={setLocation}
                        resolveLabel={resolveLabel}
                        accent={item.accent}
                      />
                    </SidebarMenuItem>
                  );
                } else {
                  const child = item as MenuChild;
                  const isActive = child.path ? location === child.path : false;
                  return (
                    <SidebarMenuItem key={child.path || `item-${idx}`}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => child.path && setLocation(child.path)}
                        tooltip={resolveLabel(child.label)}
                        className={`h-10 transition-all font-normal ${child.accent?.activeClass ?? ""}`}
                      >
                        <child.icon className={`h-4 w-4 ${child.accent?.iconClass ?? (isActive ? "text-primary" : "")}`} />
                        <span>{resolveLabel(child.label)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">主题 Theme</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setTheme("nature")}
                  className="cursor-pointer"
                >
                  <Leaf className="mr-2 h-4 w-4" />
                  <span>🌿 Xintian Nature</span>
                  {theme === "nature" && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="cursor-pointer"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  <span>🌙 Dark Mode</span>
                  {theme === "dark" && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                  className="cursor-pointer"
                >
                  <Languages className="mr-2 h-4 w-4" />
                  <span>{lang === "zh" ? "English" : "中文"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 no-print">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

// Collapsible menu group component
function CollapsibleMenuGroup({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  children,
  location,
  setLocation,
  resolveLabel,
  accent,
}: {
  icon: any;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  children: MenuChild[];
  location: string;
  setLocation: (path: string) => void;
  resolveLabel: (label: string | { zh: string; en: string }) => string;
  accent?: MenuAccent;
}) {
  const [open, setOpen] = useState(true);

  // Auto-open if group is active
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  if (isCollapsed) {
    // When collapsed, show icon only and expand on hover via tooltip
    return (
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => setOpen(!open)}
        tooltip={label}
        className={`h-10 transition-all font-normal ${accent?.activeClass ?? ""}`}
      >
        <Icon className={`h-4 w-4 ${accent?.iconClass ?? (isActive ? "text-primary" : "")}`} />
        <span>{label}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => setOpen(!open)}
        className={`h-10 transition-all font-normal ${accent?.activeClass ?? ""}`}
      >
        <Icon className={`h-4 w-4 ${accent?.iconClass ?? (isActive ? "text-primary" : "")}`} />
        <span>{label}</span>
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub className="ml-4">
          {children.map((child, ci) => {
            const childActive = isMenuPathActive(location, child.path);
            // If this child has its own children (nested submenu like AI大脑)
            if (child.children && child.children.length > 0) {
              return (
                <SidebarMenuSubItem key={`child-${ci}`}>
                  <CollapsibleMenuGroup
                    icon={child.icon}
                    label={resolveLabel(child.label)}
                    isActive={child.children.some(sub => isMenuPathActive(location, sub.path))}
                    isCollapsed={false}
                    children={child.children}
                    location={location}
                    setLocation={setLocation}
                    resolveLabel={resolveLabel}
                  />
                </SidebarMenuSubItem>
              );
            }
            return (
              <SidebarMenuSubItem key={`child-${ci}`}>
                <SidebarMenuSubButton
                  isActive={childActive}
                  asChild
                  className="h-9 text-sm"
                >
                  <button
                    onClick={() => {
                      if (child.path && child.path.includes('?')) {
                        window.history.pushState({}, '', child.path);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      } else if (child.path) {
                        setLocation(child.path);
                      }
                    }}
                    className="w-full flex items-center gap-2 h-9 text-sm"
                  >
                    <child.icon className={`h-3.5 w-3.5 ${childActive ? "text-primary" : ""}`} />
                    <span>{resolveLabel(child.label)}</span>
                  </button>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </>
  );
}
