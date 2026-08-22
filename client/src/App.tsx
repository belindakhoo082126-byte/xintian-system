import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ProductsV2 from "./pages/ProductsV2";
import ProductBundles from "./pages/ProductBundles";
import Categories from "./pages/Categories";
import MemberLinkPreview from "./pages/MemberLinkPreview";
import ProductPreview from "./pages/ProductPreview";
import Orders from "./pages/Orders";
import Membership from "./pages/Membership";
import Customers from "./pages/Customers";
import Flows from "@/pages/Flows";
import Chat from "@/pages/Chat";
import AiHandover from "@/pages/AiHandover";
import DraftOrders from "@/pages/DraftOrders";
import OrderChangeRequests from "@/pages/OrderChangeRequests";
import PaymentProofReviews from "@/pages/PaymentProofReviews";
import ReplyRules from "@/pages/ReplyRules";
import AiKnowledge from "@/pages/AiKnowledge";
import AiBrain from "@/pages/AiBrain";
import AiNotificationCenter from "@/pages/AiNotificationCenter";
import Suppliers from "@/pages/Suppliers";
import PurchaseOrders from "@/pages/PurchaseOrders";
import BusinessReport from "@/pages/BusinessReport";
import SalesPaymentReport from "@/pages/SalesPaymentReport";
import ProductSalesReport from "@/pages/ProductSalesReport";
import CustomerSpendingReport from "@/pages/CustomerSpendingReport";
import PurchaseInventoryReport from "@/pages/PurchaseInventoryReport";
import PaymentRecord from "@/pages/PaymentRecord";
import FacebookSettings from "@/pages/FacebookSettings";
import SystemSettings from "@/pages/SystemSettings";
import ShippingRules from "@/pages/ShippingRules";
import LogisticsIntegration from "@/pages/LogisticsIntegration";
import PaymentSettings from "@/pages/PaymentSettings";
import OrderDetail from "@/pages/OrderDetail";
import CustomerPayment from "@/pages/CustomerPayment";
import MallSettings from "@/pages/MallSettings";
import MallHome from "@/pages/mall/MallHome";
import MallBundleDetail from "@/pages/mall/MallBundleDetail";
import MallProductDetail from "@/pages/mall/MallProductDetail";
import MallCart from "@/pages/mall/MallCart";
import MallFavorites from "@/pages/mall/MallFavorites";
import MallCheckout from "@/pages/mall/MallCheckout";
import MallOrderQuery from "@/pages/mall/MallOrderQuery";
import MallPayment from "@/pages/mall/MallPayment";
import Packing from "@/pages/Packing";
import PackingDetail from "@/pages/PackingDetail";
import CustomerOrderTracking from "@/pages/CustomerOrderTracking";
import CustomerOrderPage from "@/pages/CustomerOrderPage";
import ProfitAnalysisReport from "@/pages/ProfitAnalysisReport";
import LiveRooms from "@/pages/LiveRooms";
import LiveRoomDetail from "@/pages/LiveRoomDetail";
import LiveAiFlows from "@/pages/LiveAiFlows";
import ImportBatches from "@/pages/ImportBatches";
import Campaigns from "@/pages/Campaigns";
import LossAnalysisReport from "@/pages/LossAnalysisReport";
import InventoryLog from "@/pages/InventoryLog";
import OrderCreatePage from "@/pages/OrderCreatePage";
import OrderBrowsePage from "@/pages/OrderBrowsePage";
import OrderEditPage from "@/pages/OrderEditPage";
import MarketingCenter from "@/pages/MarketingCenter";
import RefundManagement from "@/pages/RefundManagement";
import PublicPolicy from "@/pages/PublicPolicy";
import VirtualDelivery from "@/pages/VirtualDelivery";

/** Public routes — no auth required, no dashboard layout */
function PublicRoutes() {
  return (
    <Switch>
      <Route path={"/m/:token"} component={({ params }: any) => <MemberLinkPreview token={params.token} />} />
      <Route path={"/product/:id"} component={({ params }: any) => <ProductPreview productId={parseInt(params.id)} />} />
      {/* Mall public routes */}
      <Route path={"/mall"} component={MallHome} />
      <Route path={"/mall/bundle/:id"} component={MallBundleDetail} />
      <Route path={"/mall/product/:id"} component={(params: any) => <MallProductDetail />} />
      <Route path={"/mall/cart"} component={MallCart} />
      <Route path={"/mall/favorites"} component={MallFavorites} />
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
      <Route path={"/orders/local"} component={() => <Orders orderCategory="local" />} />
      <Route path={"/orders/import"} component={() => <Orders orderCategory="import" />} />
      <Route path={"/orders/search"} component={() => <Orders orderCategory="all" />} />
      <Route path={"/refunds"} component={RefundManagement} />
      <Route path={"/admin/refunds"} component={RefundManagement} />
      <Route path={"/orders/create"} component={() => <OrderCreatePage orderCategory="local" />} />
      <Route path={"/orders/create/local"} component={() => <OrderCreatePage orderCategory="local" />} />
      <Route path={"/orders/create/import"} component={() => <OrderCreatePage orderCategory="import" />} />
      <Route path={"/membership"} component={Membership} />
      <Route path={"/virtual-delivery"} component={VirtualDelivery} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/ai-handover"} component={AiHandover} />
      <Route path={"/auto-notifications"} component={AiNotificationCenter} />
      <Route path={"/draft-orders"} component={DraftOrders} />
      <Route path={"/order-change-requests"} component={OrderChangeRequests} />
      <Route path={"/payment-proof-reviews"} component={PaymentProofReviews} />
      <Route path={"/ai-brain"} component={AiBrain} />
      <Route path={"/reply-rules"} component={ReplyRules} />
      <Route path={"/ai-knowledge"} component={AiKnowledge} />
      <Route path={"/flows"} component={Flows} />
      <Route path={"/suppliers"} component={Suppliers} />
      <Route path={"/purchase-orders"} component={PurchaseOrders} />
      <Route path={"/profit-report"} component={BusinessReport} />
      <Route path={"/reports/sales-payment"} component={SalesPaymentReport} />
      <Route path={"/reports/product-sales"} component={ProductSalesReport} />
      <Route path={"/reports/customer-spending"} component={CustomerSpendingReport} />
      <Route path="/reports/purchase-inventory" component={PurchaseInventoryReport} />
      <Route path="/reports/profit-analysis" component={ProfitAnalysisReport} />
      <Route path="/reports/loss-analysis" component={LossAnalysisReport} />
      <Route path="/reports/payment-record" component={PaymentRecord} />
      <Route path="/inventory-log" component={InventoryLog} />
      <Route path="/product-bundles" component={ProductBundles} />
      <Route path="/live-rooms" component={LiveRooms} />
      <Route path="/live-room/:id" component={LiveRoomDetail} />
      <Route path="/live-ai-flows" component={LiveAiFlows} />
      <Route path="/import-batches" component={ImportBatches} />
      <Route path={"/campaigns"} component={Campaigns} />
      <Route path={"/marketing"} component={MarketingCenter} />
      <Route path={"/facebook-settings"} component={FacebookSettings} />
      <Route path={"/system-settings"} component={SystemSettings} />
      <Route path={"/shipping-rules"} component={ShippingRules} />
      <Route path={"/logistics"} component={LogisticsIntegration} />
      <Route path={"/payment-settings"} component={PaymentSettings} />
      <Route path={"/mall-settings"} component={MallSettings} />
      <Route path={"/packing"} component={Packing} />
      <Route path={"/packing/:id"} component={PackingDetail} />
      <Route path={"/orders/browse/:id"} component={({ params }: any) => <OrderBrowsePage orderId={parseInt(params.id)} onBack={() => window.history.back()} />} />
      <Route path={"/orders/:id/edit"} component={({ params }: any) => <OrderEditPage orderId={parseInt(params.id)} onBack={() => window.history.back()} />} />
      <Route path={"/orders/:id"} component={({ params }: any) => <OrderBrowsePage orderId={parseInt(params.id)} onBack={() => window.history.back()} />} />
      <Route path={"/pay/:id"} component={({ params }: any) => <CustomerPayment orderId={parseInt(params.id)} onBack={() => window.history.back()} />} />
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
          <RealtimeSyncWrapper>
          <Toaster />
          {/* Public routes bypass DashboardLayout (no auth gate) */}
          <Switch>
            <Route path={"/m/:token"} component={({ params }: any) => <MemberLinkPreview token={params.token} />} />
            <Route path={"/product/:id"} component={({ params }: any) => <ProductPreview productId={parseInt(params.id)} />} />
            <Route path={"/mall/payment/:orderNumber"} component={MallPayment} />
            <Route path={"/mall/order-query"} component={MallOrderQuery} />
            <Route path={"/mall/checkout"} component={MallCheckout} />
            <Route path={"/mall/cart"} component={MallCart} />
            <Route path={"/mall/favorites"} component={MallFavorites} />
            <Route path={"/mall/bundle/:id"} component={MallBundleDetail} />
            <Route path={"/mall/product/:id"} component={MallProductDetail} />
            <Route path={"/mall"} component={MallHome} />
            <Route path={"/privacy-policy"} component={() => <PublicPolicy kind="privacy" />} />
            <Route path={"/terms-of-service"} component={() => <PublicPolicy kind="terms" />} />
            <Route path={"/data-deletion"} component={() => <PublicPolicy kind="dataDeletion" />} />
            <Route path={"/order-tracking"} component={CustomerOrderTracking} />
            <Route path={"/order/:orderNumber/:token"} component={({ params }: any) => <CustomerOrderPage orderNumber={params.orderNumber} token={params.token} />} />
            <Route>
              <DashboardLayout>
                <DashboardRoutes />
              </DashboardLayout>
            </Route>
          </Switch>
          </RealtimeSyncWrapper>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/** Wrapper that establishes SSE connection for real-time data sync */
function RealtimeSyncWrapper({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}

export default App;
