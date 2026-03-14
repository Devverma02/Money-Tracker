import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-8 lg:px-10">
      <div className="shell-card rounded-[1.8rem] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-[0_16px_40px_rgba(10,17,40,0.18)]">
                MM
              </span>
              <span>
                <span className="block text-lg font-semibold text-slate-950">
                  MoneyManage
                </span>
                <span className="block text-sm text-slate-500">
                  Secure personal finance workspace
                </span>
              </span>
            </Link>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
              <Link href="/" className="nav-link rounded-full px-4 py-2">
                Home
              </Link>
              <Link href="/dashboard" className="nav-link rounded-full px-4 py-2">
                Dashboard
              </Link>
              <Link href="/reminders" className="nav-link rounded-full px-4 py-2">
                Reminders
              </Link>
              <Link href="/history" className="nav-link rounded-full px-4 py-2">
                History
              </Link>
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  <span className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700">
                    {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                  </span>
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  className="primary-button rounded-full px-5 py-3 text-sm font-semibold text-white"
                >
                  Sign in with Google
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
