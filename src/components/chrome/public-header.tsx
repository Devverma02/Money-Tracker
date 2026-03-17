import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="shell-card relative rounded-[1rem] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-700/20 bg-emerald-900 text-sm font-bold text-white">
              MM
            </span>
            <div>
              <span className="block text-base font-semibold text-slate-950">
                MoneyManage
              </span>
              <span className="block text-xs text-slate-500">
                Trust-first finance workspace
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
              <Link href="/" className="nav-link rounded-lg px-3 py-2">
                Home
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="nav-link rounded-lg px-3 py-2">
                    Dashboard
                  </Link>
                  <Link href="/reminders" className="nav-link rounded-lg px-3 py-2">
                    Reminders
                  </Link>
                  <Link href="/history" className="nav-link rounded-lg px-3 py-2">
                    History
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              {user ? (
                <>
                  <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                  </span>
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  className="primary-button rounded-lg px-4 py-2.5 text-sm font-semibold !text-white"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          <details className="group lg:hidden">
            <summary className="flex list-none items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Menu
            </summary>
            <div className="absolute right-4 top-[4.75rem] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-[1rem] border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(16,24,40,0.12)] sm:right-6">
              <nav className="grid gap-1 text-sm font-semibold text-slate-700">
                <Link href="/" className="nav-link rounded-lg px-3 py-2">
                  Home
                </Link>
                {user ? (
                  <>
                    <Link href="/dashboard" className="nav-link rounded-lg px-3 py-2">
                      Dashboard
                    </Link>
                    <Link href="/reminders" className="nav-link rounded-lg px-3 py-2">
                      Reminders
                    </Link>
                    <Link href="/history" className="nav-link rounded-lg px-3 py-2">
                      History
                    </Link>
                  </>
                ) : null}
              </nav>

              <div className="mt-3 border-t border-slate-200 pt-3">
                {user ? (
                  <div className="grid gap-2">
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                    </span>
                    <SignOutButton />
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="primary-button inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold !text-white"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
