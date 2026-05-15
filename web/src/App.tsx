// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { RouterProvider, createBrowserRouter } from "react-router";
import Shell from "@/components/layout/Shell";
import Realm from "@/pages/Realm";
import Quests from "@/pages/Quests";
import Players from "@/pages/Players";
import Hero from "@/pages/Hero";
import Echoes from "@/pages/Echoes";
import QuestDetail from "@/pages/QuestDetail";
import Settings from "@/pages/Settings";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Realm /> },
      { path: "quests", element: <Quests /> },
      { path: "players", element: <Players /> },
      { path: "hero", element: <Hero /> },
      { path: "quest/:id", element: <QuestDetail /> },
      { path: "echoes", element: <Echoes /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
