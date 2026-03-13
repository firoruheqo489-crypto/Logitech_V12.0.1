import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import GanttV3 from "./pages/GanttV3";
import DashboardHome from "./pages/dashboard/DashboardHome";
import FaultDashboard from "./pages/FaultDashboard";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={DashboardHome} />
      <Route path={"/dashboard"} component={DashboardHome} />
      <Route path={"/fault"} component={FaultDashboard} />
      <Route path={"/gantt"} component={GanttV3} />
      <Route path={"/v3/gantt"} component={GanttV3} />
      <Route path={"/v2"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
        <ThemeProvider
          defaultTheme="dark"
          // switchable
        >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
