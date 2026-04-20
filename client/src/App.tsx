import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const Home = lazy(() => import("./pages/Home"));
const GanttV3 = lazy(() => import("./pages/GanttV3"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const ProjectProgress = lazy(() => import("./pages/dashboard/ProjectProgress"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000] text-white/45 text-sm">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
        页面加载中...
      </span>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={DashboardHome} />
      <Route path={"/dashboard/progress"} component={ProjectProgress} />
      <Route path={"/dashboard"} component={DashboardHome} />
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
          <Suspense fallback={<RouteLoadingState />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
