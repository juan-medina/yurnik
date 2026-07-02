// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { lazy, Suspense } from "react";
import { RouterProvider, createBrowserRouter } from "react-router";
import Shell from "@/components/layout/Shell";

const AuthComplete = lazy(() => import("@/pages/AuthComplete"));
const Home = lazy(() => import("@/pages/Home"));
const Journeys = lazy(() => import("@/pages/Journeys"));
const Players = lazy(() => import("@/pages/Players"));
const Echoes = lazy(() => import("@/pages/Echoes"));
const JourneyDetail = lazy(() => import("@/pages/JourneyDetail"));
const GameDetail = lazy(() => import("@/pages/GameDetail"));
const PlayerProfile = lazy(() => import("@/pages/PlayerProfile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Hero = lazy(() => import("@/pages/Hero"));
const Horizon = lazy(() => import("@/pages/Horizon"));
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

const router = createBrowserRouter([
  { path: "/lore", element: withSuspense(<Lore />) },
  { path: "/terms", element: withSuspense(<Terms />) },
  { path: "/privacy", element: withSuspense(<Privacy />) },
  { path: "/whats-new", element: withSuspense(<WhatsNew />) },
  { path: "/auth/complete", element: withSuspense(<AuthComplete />) },
  { path: "/auth/agent", element: withSuspense(<AgentAuth />) },
  {
    element: <Shell />,
    children: [
      { path: "/", element: withSuspense(<Home />) },
      { path: "journeys", element: withSuspense(<Journeys />) },
      { path: "players", element: withSuspense(<Players />) },
      { path: "journey/:id", element: withSuspense(<JourneyDetail />) },
      { path: "game/:igdbId", element: withSuspense(<GameDetail />) },
      { path: "player/:handle", element: withSuspense(<PlayerProfile />) },
      { path: "echoes", element: withSuspense(<Echoes />) },
      { path: "settings", element: withSuspense(<Settings />) },
      { path: "hero", element: withSuspense(<Hero />) },
      { path: "horizon", element: withSuspense(<Horizon />) },
      { path: "admin", element: withSuspense(<Admin />) },
      { path: "*", element: withSuspense(<NotFound />) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
