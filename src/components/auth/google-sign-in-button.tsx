"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = () => {
    startTransition(async () => {
      setError(null);

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (signInError) {
        setError("Google sign-in could not start. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleLogin}
        disabled={isPending}
        className="primary-button inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Signing you in..." : "Continue with Google"}
      </button>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <p className="text-xs leading-6 text-slate-500">
          After sign-in, you will land directly inside the protected dashboard.
        </p>
      )}
    </div>
  );
}
