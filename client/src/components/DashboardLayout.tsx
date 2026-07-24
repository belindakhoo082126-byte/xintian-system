import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Languages, Sun, Moon, Leaf } from "lucide-react";
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Package, ShoppingCart, Crown, Users, MessageSquare, BarChart3, Truck, PackagePlus, TrendingUp, Facebook, FolderTree, ChevronRight, DollarSign, ShoppingBag, Boxes, Settings, Ship, Warehouse, CreditCard, Store, PackageCheck, Search } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "nav.dashboard", path: "/" },
  { icon: Package, label: "nav.products", path: "/products" },
  { icon: FolderTree, label: { zh: "分类管理", en: "Categories" }, path: "/categories" },
  { icon: ShoppingCart, label: "nav.orders", path: "/orders" },
  { icon: Crown, label: { zh: "会员订单", en: "Membership Orders" }, path: "/membership" },
  { icon: Users, label: "nav.customers", path: "/customers" },
  { icon: MessageSquare, label: { zh: "Flow 编辑器", en: "Flow Editor" }, path: "/flows" },
  { icon: Truck, label: { zh: "供应商管理", en: "Suppliers" }, path: "/suppliers" },
  { icon: PackagePlus, label: { zh: "进货管理", en: "Purchase Orders" }, path: "/purchase-orders" },
  { icon: TrendingUp, label: "nav.businessReport", path: "/profit-report" },
  { icon: DollarSign, label: { zh: "销售与收款", en: "Sales & Payment" }, path: "/reports/sales-payment" },
  { icon: ShoppingBag, label: { zh: "商品销售", en: "Product Sales" }, path: "/reports/product-sales" },
  { icon: Users, label: { zh: "客户消费", en: "Customer Spending" }, path: "/reports/customer-spending" },
  { icon: Boxes, label: { zh: "进货与库存", en: "Purchase & Inventory" }, path: "/reports/purchase-inventory" },
  { icon: Facebook, label: "nav.facebookSettings", path: "/facebook-settings" },
  { icon: Ship, label: { zh: "运费规则", en: "Shipping Rules" }, path: "/shipping-rules" },
  { icon: Warehouse, label: "nav.logistics", path: "/logistics" },
  { icon: CreditCard, label: "nav.paymentSettings", path: "/payment-settings" },
  { icon: Settings, label: "nav.systemSettings", path: "/system-settings" },
  { icon: Store, label: "nav.mallSettings", path: "/mall-settings" },
  { icon: PackageCheck, label: "nav.packing", path: "/packing" },
  { icon: Search, label: { zh: "订单查询", en: "Order Tracking" }, path: "/order-tracking" },
];

const SHIPPING_STAFF_MENU_PATHS = new Set(["/packing", "/order-tracking"]);

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
  const visibleMenuItems = isShippingStaff
    ? menuItems.filter((item) => SHIPPING_STAFF_MENU_PATHS.has(item.path))
    : menuItems;

  const resolveLabel = (label: string | { zh: string; en: string }): string =>
    typeof label === "string" ? t(label) : (lang === "zh" ? label.zh : label.en);
  const activeMenuItem = visibleMenuItems.find((item) => item.path === location);
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

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Leaf className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold tracking-tight truncate text-primary">
                    心田 XLCS
                  </span>
                </div>
              ) : (
                <Leaf className="h-5 w-5 text-primary mx-auto" />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={resolveLabel(item.label)}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{resolveLabel(item.label)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
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
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem ? resolveLabel(activeMenuItem.label) : "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">
          {/* Top-right language toggle — always visible */}
          <div className="fixed top-3 right-4 z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="h-8 px-3 text-xs gap-1.5 bg-background/80 backdrop-blur shadow-sm"
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "zh" ? "EN" : "中文"}
            </Button>
          </div>
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
