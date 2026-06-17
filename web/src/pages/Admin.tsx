// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { ShieldAlert } from "lucide-react";

export default function Admin() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert size={32} className="text-muted-foreground" />
      <div>
        <p className="font-semibold">Admin</p>
        <p className="mt-1 text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </div>
  );
}
