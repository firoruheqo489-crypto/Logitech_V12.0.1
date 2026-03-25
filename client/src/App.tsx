import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const NotFound = lazy(() => import("@/pages/NotFound"));
const Home = lazy(() => import("./pages/Home"));
const GanttV3 = lazy(() => import("./pages/GanttV3"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));


function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path={"/"} component={DashboardHome} />
        <Route path={"/dashboard"} component={DashboardHome} />
        <Route path={"/gantt"} component={GanttV3} />
        <Route path={"/v3/gantt"} component={GanttV3} />
        <Route path={"/v2"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
