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
import BusinessReport from "@/pages/BusinessReport";
import SalesPaymentReport from "@/pages/SalesPaymentReport";
import ProductSalesReport from "@/pages/ProductSalesReport";
import CustomerSpendingReport from "@/pages/CustomerSpendingReport";
import PurchaseInventoryReport from "@/pages/PurchaseInventoryReport";
import FacebookSettings from "@/pages/FacebookSettings";
import SystemSettings from "@/pages/SystemSettings";
import ShippingRules from "@/pages/ShippingRules";
import LogisticsIntegration from "@/pages/LogisticsIntegration";
import PaymentSettings from "@/pages/PaymentSettings";
import OrderDetail from "@/pages/OrderDetail";
import CustomerPayment from "@/pages/CustomerPayment";
import MallSettings from "@/pages/MallSettings";
import MallHome from "@/pages/mall/MallHome";
import MallProductDetail from "@/pages/mall/MallProductDetail";
import MallCart from "@/pages/mall/MallCart";
import MallCheckout from "@/pages/mall/MallCheckout";
import MallOrderQuery from "@/pages/mall/MallOrderQuery";
import MallPayment from "@/pages/mall/MallPayment";
import Packing from "@/pages/Packing";
import PackingDetail from "@/pages/PackingDetail";
import CustomerOrderTracking from "@/pages/CustomerOrderTracking";

/** Public routes — no auth required, no dashboard layout */
function PublicRoutes() {
  return (
    <Switch>
      <Route path={"/m/:token"} component={(params: any) => <MemberLinkPreview token={params.token} />} />
      <Route path={"/product/:id"} component={(params: any) => <ProductPreview productId={parseInt(params.id)} />} />
      {/* Mall public routes */}
      <Route path={"/mall"} component={MallHome} />
      <Route path={"/mall/product/:id"} component={(params: any) => <MallProductDetail />} />
      <Route path={"/mall/cart"} component={MallCart} />
      <Route path={"/mall/checkout"} component={MallCheckout} />
      <Route path={"/mall/order-query"} component={MallOrderQuery} />
      <Route path={"/mall/payment/:orderNumber"} component={MallPayment} />
      <Route path={"/order-tracking"} component={CustomerOrderTracking} />
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
      <Route path={"/profit-report"} component={BusinessReport} />
      <Route path={"/reports/sales-payment"} component={SalesPaymentReport} />
      <Route path={"/reports/product-sales"} component={ProductSalesReport} />
      <Route path={"/reports/customer-spending"} component={CustomerSpendingReport} />
      <Route path={"/reports/purchase-inventory"} component={PurchaseInventoryReport} />
      <Route path={"/facebook-settings"} component={FacebookSettings} />
      <Route path={"/system-settings"} component={SystemSettings} />
      <Route path={"/shipping-rules"} component={ShippingRules} />
      <Route path={"/logistics"} component={LogisticsIntegration} />
      <Route path={"/payment-settings"} component={PaymentSettings} />
      <Route path={"/mall-settings"} component={MallSettings} />
      <Route path={"/packing"} component={Packing} />
      <Route path={"/packing/:id"} component={PackingDetail} />
      <Route path={"/orders/:id"} component={(params: any) => <OrderDetail orderId={parseInt(params.id)} onBack={() => window.history.back()} />} />
      <Route path={"/pay/:id"} component={(params: any) => <CustomerPayment orderId={parseInt(params.id)} onBack={() => window.history.back()} />} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="nature">
        <TooltipProvider>
          <Toaster />
          {/* Public routes bypass DashboardLayout (no auth gate) */}
          <Switch>
            <Route path={"/m/:token"} nest component={(params: any) => <MemberLinkPreview token={params.token} />} />
            <Route path={"/product/:id"} nest component={(params: any) => <ProductPreview productId={parseInt(params.id)} />} />
            <Route path={"/mall"} nest component={MallHome} />
            <Route path={"/mall/product/:id"} nest component={MallProductDetail} />
            <Route path={"/mall/cart"} nest component={MallCart} />
            <Route path={"/mall/checkout"} nest component={MallCheckout} />
            <Route path={"/mall/order-query"} nest component={MallOrderQuery} />
            <Route path={"/mall/payment/:orderNumber"} nest component={MallPayment} />
            <Route path={"/order-tracking"} nest component={CustomerOrderTracking} />
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
