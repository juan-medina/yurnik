// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Navigate, Outlet } from "react-router";
import { isAuthenticated } from "@/services/auth";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Shell() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
