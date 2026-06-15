// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { RouterProvider, createBrowserRouter } from "react-router";
import Shell from "@/components/layout/Shell";
import AuthComplete from "@/pages/AuthComplete";
import Home from "@/pages/Home";
import Journeys from "@/pages/Journeys";
import Players from "@/pages/Players";
import Echoes from "@/pages/Echoes";
import JourneyDetail from "@/pages/JourneyDetail";
import GameDetail from "@/pages/GameDetail";
import PlayerProfile from "@/pages/PlayerProfile";
import Settings from "@/pages/Settings";
import Hero from "@/pages/Hero";
import Horizon from "@/pages/Horizon";
import AgentAuth from "@/pages/AgentAuth";
import Lore from "@/pages/Lore";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import NotFound from "@/pages/NotFound";

const router = createBrowserRouter([
  { path: "/lore", element: <Lore /> },
  { path: "/terms", element: <Terms /> },
  { path: "/privacy", element: <Privacy /> },
  { path: "/auth/complete", element: <AuthComplete /> },
  { path: "/auth/agent", element: <AgentAuth /> },
  {
    element: <Shell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "journeys", element: <Journeys /> },
      { path: "players", element: <Players /> },
      { path: "journey/:id", element: <JourneyDetail /> },
      { path: "game/:igdbId", element: <GameDetail /> },
      { path: "player/:handle", element: <PlayerProfile /> },
      { path: "echoes", element: <Echoes /> },
      { path: "settings", element: <Settings /> },
      { path: "hero", element: <Hero /> },
      { path: "horizon", element: <Horizon /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
