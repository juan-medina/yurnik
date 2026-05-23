// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { RouterProvider, createBrowserRouter } from "react-router";
import Shell from "@/components/layout/Shell";
import Login from "@/pages/Login";
import Realm from "@/pages/Realm";
import Journeys from "@/pages/Journeys";
import Players from "@/pages/Players";
import Hero from "@/pages/Hero";
import Echoes from "@/pages/Echoes";
import JourneyDetail from "@/pages/JourneyDetail";
import PlayerProfile from "@/pages/PlayerProfile";
import Settings from "@/pages/Settings";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Realm /> },
      { path: "journeys", element: <Journeys /> },
      { path: "players", element: <Players /> },
      { path: "hero", element: <Hero /> },
      { path: "journey/:id", element: <JourneyDetail /> },
      { path: "player/:handle", element: <PlayerProfile /> },
      { path: "echoes", element: <Echoes /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
