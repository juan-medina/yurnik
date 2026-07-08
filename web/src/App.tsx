// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { lazy, Suspense, useEffect } from "react";
import { RouterProvider, createBrowserRouter, useRouteError } from "react-router";
import { AlertTriangle } from "lucide-react";
import Shell from "@/components/layout/Shell";

const AuthComplete = lazy(() => import("@/pages/AuthComplete"));
const Home = lazy(() => import("@/pages/Home"));
const Journeys = lazy(() => import("@/pages/Journeys"));
const Explore = lazy(() => import("@/pages/Explore"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const JourneyDetail = lazy(() => import("@/pages/JourneyDetail"));
const GameDetail = lazy(() => import("@/pages/GameDetail"));
const PlayerProfile = lazy(() => import("@/pages/PlayerProfile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const Backlog = lazy(() => import("@/pages/Backlog"));
const AgentAuth = lazy(() => import("@/pages/AgentAuth"));
const Lore = lazy(() => import("@/pages/Lore"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const WhatsNew = lazy(() => import("@/pages/WhatsNew"));
const Admin = lazy(() => import("@/pages/Admin"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function GlobalErrorBoundary() {
  const error = useRouteError();
  const isChunkError = error instanceof Error && error.message.includes("dynamically imported module");
  const hasReloaded = sessionStorage.getItem("chunk_reload");
  const shouldReload = isChunkError && !hasReloaded;

  useEffect(() => {
    if (shouldReload) {
      sessionStorage.setItem("chunk_reload", "true");
      window.location.reload();
    } else if (isChunkError) {
      sessionStorage.removeItem("chunk_reload");
    }
  }, [shouldReload, isChunkError]);

  if (shouldReload) return null;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle size={32} className="text-muted-foreground" />
      <div>
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">An unexpected error occurred while loading this page.</p>
      </div>
      <button
        onClick={() => {
          sessionStorage.removeItem("chunk_reload");
          window.location.reload();
        }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Reload page
      </button>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/lore", element: withSuspense(<Lore />), errorElement: <GlobalErrorBoundary /> },
  { path: "/terms", element: withSuspense(<Terms />), errorElement: <GlobalErrorBoundary /> },
  { path: "/privacy", element: withSuspense(<Privacy />), errorElement: <GlobalErrorBoundary /> },
  { path: "/whats-new", element: withSuspense(<WhatsNew />), errorElement: <GlobalErrorBoundary /> },
  { path: "/auth/complete", element: withSuspense(<AuthComplete />), errorElement: <GlobalErrorBoundary /> },
  { path: "/auth/agent", element: withSuspense(<AgentAuth />), errorElement: <GlobalErrorBoundary /> },
  {
    element: <Shell />,
    errorElement: <GlobalErrorBoundary />,
    children: [
      { path: "/", element: withSuspense(<Home />) },
      { path: "journeys", element: withSuspense(<Journeys />) },
      { path: "explore", element: withSuspense(<Explore />) },
      { path: "journey/:id", element: withSuspense(<JourneyDetail />) },
      { path: "game/:igdbId", element: withSuspense(<GameDetail />) },
      { path: "player/:handle", element: withSuspense(<PlayerProfile />) },
      { path: "notifications", element: withSuspense(<Notifications />) },
      { path: "settings", element: withSuspense(<Settings />) },
      { path: "profile", element: withSuspense(<Profile />) },
      { path: "backlog", element: withSuspense(<Backlog />) },
      { path: "admin", element: withSuspense(<Admin />) },
      { path: "*", element: withSuspense(<NotFound />) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
