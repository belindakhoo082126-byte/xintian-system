import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Membership from "./pages/Membership";
import Customers from "./pages/Customers";
import Flows from "./pages/Flows";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/products"} component={Products} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/membership"} component={Membership} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/flows"} component={Flows} />
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
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
