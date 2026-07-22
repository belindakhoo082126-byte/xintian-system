import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ProductsV2 from "./pages/ProductsV2";
import Categories from "./pages/Categories";
import MemberLinkPreview from "./pages/MemberLinkPreview";
import ProductPreview from "./pages/ProductPreview";
import Orders from "./pages/Orders";
import Membership from "./pages/Membership";
import Customers from "./pages/Customers";
import Flows from "@/pages/Flows";
import Suppliers from "@/pages/Suppliers";
import PurchaseOrders from "@/pages/PurchaseOrders";
import ProfitReport from "@/pages/ProfitReport";
import FacebookSettings from "@/pages/FacebookSettings";

/** Public routes — no auth required, no dashboard layout */
function PublicRoutes() {
  return (
    <Switch>
      <Route path={"/m/:token"} component={(params: any) => <MemberLinkPreview token={params.token} />} />
      <Route path={"/product/:id"} component={(params: any) => <ProductPreview productId={parseInt(params.id)} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** Dashboard routes — wrapped in DashboardLayout with auth */
function DashboardRoutes() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/products"} component={ProductsV2} />
      <Route path={"/categories"} component={Categories} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/membership"} component={Membership} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/flows"} component={Flows} />
      <Route path={"/suppliers"} component={Suppliers} />
      <Route path={"/purchase-orders"} component={PurchaseOrders} />
      <Route path={"/profit-report"} component={ProfitReport} />
      <Route path={"/facebook-settings"} component={FacebookSettings} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {/* Public routes bypass DashboardLayout (no auth gate) */}
          <Switch>
            <Route path={"/m/:token"} nest component={(params: any) => <MemberLinkPreview token={params.token} />} />
            <Route path={"/product/:id"} nest component={(params: any) => <ProductPreview productId={parseInt(params.id)} />} />
            <Route>
              <DashboardLayout>
                <DashboardRoutes />
              </DashboardLayout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
