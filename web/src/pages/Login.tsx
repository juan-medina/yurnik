// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { signIn } from "@/services/auth";

export default function Login() {
  function handleSignIn() {
    signIn();
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 px-6">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl font-bold tracking-tight text-primary">Yurnik</span>
          <p className="text-center text-sm text-muted-foreground">
            An open social network for gaming journeys
          </p>
        </div>
        <div className="w-full space-y-3">
          <button
            onClick={handleSignIn}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in with Discord
          </button>
        </div>
      </div>
    </div>
  );
}
